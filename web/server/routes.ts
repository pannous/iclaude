import { Hono } from "hono";
import { execSync } from "node:child_process";
import { readdir, stat, realpath, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, join, sep, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import type { CliLauncher } from "./cli-launcher.js";
import { WsBridge } from "./ws-bridge.js";
import type { SessionStore } from "./session-store.js";
import type { WorktreeTracker } from "./worktree-tracker.js";
import * as envManager from "./env-manager.js";
import * as gitUtils from "./git-utils.js";
import * as sessionNames from "./session-names.js";
import { getUsageLimits } from "./usage-limits.js";

export function createRoutes(
  launcher: CliLauncher,
  wsBridge: WsBridge,
  sessionStore: SessionStore,
  worktreeTracker: WorktreeTracker,
) {
  const api = new Hono();

  // ─── SDK Sessions (--sdk-url) ─────────────────────────────────────

  api.post("/sessions/create", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      const backend = body.backend ?? "claude";
      if (backend !== "claude" && backend !== "codex") {
        return c.json({ error: `Invalid backend: ${String(backend)}` }, 400);
      }

      // Validate model (if provided)
      if (body.model !== undefined) {
        if (typeof body.model !== "string" || body.model.length === 0 || body.model.length > 100) {
          return c.json({ error: "Invalid model parameter" }, 400);
        }
      }

      // Validate permissionMode (if provided)
      if (body.permissionMode !== undefined) {
        const validModes = ["bypass", "bypassPermissions", "acceptEdits", "delegate", "dontAsk", "default", "plan"];
        if (typeof body.permissionMode !== "string" || !validModes.includes(body.permissionMode)) {
          return c.json({ error: "Invalid permissionMode parameter" }, 400);
        }
      }

      // Validate claudeBinary (if provided)
      if (body.claudeBinary !== undefined) {
        if (typeof body.claudeBinary !== "string" || !/^[a-zA-Z0-9_\-\/\.]+$/.test(body.claudeBinary)) {
          return c.json({ error: "Invalid claudeBinary parameter" }, 400);
        }
      }

      // Validate allowedTools (if provided)
      if (body.allowedTools !== undefined) {
        if (!Array.isArray(body.allowedTools)) {
          return c.json({ error: "allowedTools must be an array" }, 400);
        }
        if (!body.allowedTools.every((t: unknown) => typeof t === "string" && t.length > 0 && t.length < 100)) {
          return c.json({ error: "Invalid allowedTools array" }, 400);
        }
      }

      // Resolve environment variables from envSlug
      let envVars: Record<string, string> | undefined = body.env;
      if (body.envSlug) {
        if (typeof body.envSlug !== "string" || body.envSlug.length === 0) {
          return c.json({ error: "Invalid envSlug parameter" }, 400);
        }
        const companionEnv = envManager.getEnv(body.envSlug);
        if (companionEnv) {
          console.log(
            `[routes] Injecting env "${companionEnv.name}" (${Object.keys(companionEnv.variables).length} vars):`,
            Object.keys(companionEnv.variables).join(", "),
          );
          envVars = { ...companionEnv.variables, ...body.env };
        } else {
          console.warn(
            `[routes] Environment "${body.envSlug}" not found, ignoring`,
          );
        }
      }

      // Validate cwd
      let cwd = body.cwd;
      if (cwd !== undefined) {
        if (typeof cwd !== "string" || cwd.length === 0) {
          return c.json({ error: "Invalid cwd parameter" }, 400);
        }
        cwd = resolve(cwd);
      }

      let worktreeInfo:
        | {
            isWorktree: boolean;
            repoRoot: string;
            branch: string;
            actualBranch: string;
            worktreePath: string;
          }
        | undefined;

      // If worktree is requested, set up a worktree for the selected branch
      if (body.useWorktree && body.branch && cwd) {
        if (typeof body.branch !== "string" || body.branch.length === 0 || body.branch.length > 200) {
          return c.json({ error: "Invalid branch parameter" }, 400);
        }
        const repoInfo = gitUtils.getRepoInfo(cwd);
        if (repoInfo) {
          const result = gitUtils.ensureWorktree(
            repoInfo.repoRoot,
            body.branch,
            {
              baseBranch: repoInfo.defaultBranch,
              createBranch: body.createBranch,
              forceNew: true,
            },
          );
          cwd = result.worktreePath;
          worktreeInfo = {
            isWorktree: true,
            repoRoot: repoInfo.repoRoot,
            branch: body.branch,
            actualBranch: result.actualBranch,
            worktreePath: result.worktreePath,
          };
        }
      } else if (body.branch && cwd) {
        // Non-worktree: checkout the selected branch in-place
        const repoInfo = gitUtils.getRepoInfo(cwd);
        if (repoInfo) {
          const fetchResult = gitUtils.gitFetch(repoInfo.repoRoot);
          if (!fetchResult.success) {
            throw new Error(`git fetch failed before session create: ${fetchResult.output}`);
          }

          if (repoInfo.currentBranch !== body.branch) {
            gitUtils.checkoutBranch(repoInfo.repoRoot, body.branch);
          }

          const pullResult = gitUtils.gitPull(repoInfo.repoRoot);
          if (!pullResult.success) {
            throw new Error(`git pull failed before session create: ${pullResult.output}`);
          }
        }
      }

      const session = launcher.launch({
        model: body.model,
        permissionMode: body.permissionMode,
        cwd,
        claudeBinary: body.claudeBinary,
        codexBinary: body.codexBinary,
        codexInternetAccess: backend === "codex" && body.codexInternetAccess === true,
        codexSandbox: backend === "codex" && body.codexInternetAccess === true
          ? "danger-full-access"
          : "workspace-write",
        allowedTools: body.allowedTools,
        env: envVars,
        backendType: backend,
        worktreeInfo,
        resumeSessionId: body.resumeSessionId,
      });

      // If resuming, initialize the WsBridge session with message history from the CLI's session file
      if (body.resumeSessionId) {
        wsBridge.initializeResumedSession(session.sessionId, body.resumeSessionId, cwd);
      }

      // Track the worktree mapping
      if (worktreeInfo) {
        worktreeTracker.addMapping({
          sessionId: session.sessionId,
          repoRoot: worktreeInfo.repoRoot,
          branch: worktreeInfo.branch,
          actualBranch: worktreeInfo.actualBranch,
          worktreePath: worktreeInfo.worktreePath,
          createdAt: Date.now(),
        });
      }

      return c.json(session);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[routes] Failed to create session:", msg);
      return c.json({ error: msg }, 500);
    }
  });

  api.get("/sessions", (c) => {
    const sessions = launcher.listSessions();
    const names = sessionNames.getAllNames();
    const bridgeStates = wsBridge.getAllSessions();
    const bridgeMap = new Map(bridgeStates.map((s) => [s.session_id, s]));
    const enriched = sessions.map((s) => {
      const bridge = bridgeMap.get(s.sessionId);
      return {
        ...s,
        name: names[s.sessionId] ?? s.name,
        gitBranch: bridge?.git_branch || "",
        gitAhead: bridge?.git_ahead || 0,
        gitBehind: bridge?.git_behind || 0,
        totalLinesAdded: bridge?.total_lines_added || 0,
        totalLinesRemoved: bridge?.total_lines_removed || 0,
      };
    });
    return c.json(enriched);
  });

  api.post("/sessions/cleanup", (c) => {
    launcher.cleanupOldSessions();
    wsBridge.cleanupOldSessions();
    return c.json({ success: true });
  });

  api.get("/sessions/resumable", async (c) => {
    try {
      const projectsDir = join(homedir(), ".claude", "projects");
      const projEntries = await readdir(projectsDir, { withFileTypes: true }).catch(() => []);

      const candidates: { sessionId: string; project: string; mtime: number; filePath: string }[] = [];

      for (const entry of projEntries) {
        if (!entry.isDirectory()) continue;
        const projPath = join(projectsDir, entry.name);
        const project = "/" + entry.name.replace(/^-/, "").replace(/-/g, "/");
        const files = await readdir(projPath).catch(() => []);
        for (const file of files) {
          if (!file.endsWith(".jsonl")) continue;
          const sessionId = file.replace(".jsonl", "");
          const filePath = join(projPath, file);
          try {
            const s = await stat(filePath);
            candidates.push({ sessionId, project, mtime: s.mtime.getTime(), filePath });
          } catch { /* skip */ }
        }
      }

      candidates.sort((a, b) => b.mtime - a.mtime);
      const top = candidates.slice(0, 20);

      const results: { sessionId: string; project: string; lastModified: number; title: string }[] = [];
      for (const item of top) {
        const title = await extractSessionTitle(item.filePath);
        // Skip ephemeral title-generation sessions spawned by auto-namer
        if (title === "") continue;
        results.push({
          sessionId: item.sessionId,
          project: item.project,
          lastModified: item.mtime,
          title,
        });
      }

      return c.json(results);
    } catch (e: unknown) {
      console.error("[routes] Failed to list resumable sessions:", e);
      return c.json([], 500);
    }
  });

  api.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json(session);
  });

  api.post("/sessions/:id/message", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const { message, timeout = 120000 } = body;

    if (!message || typeof message !== "string") {
      return c.json({ error: "message is required" }, 400);
    }

    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);

    try {
      // Send message via WebSocket bridge by simulating browser message
      const wsSession = wsBridge.getSession(id);
      if (!wsSession) {
        return c.json({ error: "WebSocket session not initialized" }, 500);
      }

      // Track message count before sending
      const messageCountBefore = wsSession.messageHistory.length;
      const startTime = Date.now();

      // Send user message (this will trigger the CLI to respond)
      wsBridge.sendUserMessage(id, message);

      // Poll for assistant response
      const pollInterval = 500; // Check every 500ms
      const maxAttempts = Math.floor(timeout / pollInterval);

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        const currentSession = wsBridge.getSession(id);
        if (!currentSession) continue;

        // Look for new assistant messages after our message
        const newMessages = currentSession.messageHistory.slice(messageCountBefore);
        const assistantMessage = newMessages.find(m => m.type === "assistant");

        if (assistantMessage && assistantMessage.type === "assistant") {
          // Extract text content from assistant message
          let responseText = "";
          const content = assistantMessage.message?.content;

          if (typeof content === "string") {
            responseText = content;
          } else if (Array.isArray(content)) {
            responseText = content
              .filter((block: any) => block.type === "text")
              .map((block: any) => block.text)
              .join("\n");
          }

          return c.json({
            success: true,
            response: responseText,
            sessionId: id,
          });
        }
      }

      return c.json({ error: "Response timeout" }, 408);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[routes] Failed to send message:", msg);
      return c.json({ error: msg }, 500);
    }
  });

  api.patch("/sessions/:id/name", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.name !== "string" || !body.name.trim()) {
      return c.json({ error: "name is required" }, 400);
    }
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);
    sessionNames.setName(id, body.name.trim());
    return c.json({ ok: true, name: body.name.trim() });
  });

  api.post("/sessions/:id/kill", async (c) => {
    const id = c.req.param("id");
    const killed = await launcher.kill(id);
    if (!killed)
      return c.json({ error: "Session not found or already exited" }, 404);

    return c.json({ ok: true });
  });

  api.post("/sessions/:id/relaunch", async (c) => {
    const id = c.req.param("id");
    const ok = await launcher.relaunch(id);
    if (!ok) return c.json({ error: "Session not found" }, 404);
    return c.json({ ok: true });
  });

  api.delete("/sessions/:id", async (c) => {
    const id = c.req.param("id");
    await launcher.kill(id);

    // Clean up worktree if no other sessions use it (force: delete is destructive)
    const worktreeResult = cleanupWorktree(id, true);

    launcher.removeSession(id);
    wsBridge.closeSession(id);
    return c.json({ ok: true, worktree: worktreeResult });
  });

  api.post("/sessions/:id/archive", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    await launcher.kill(id);

    // Clean up worktree if no other sessions use it
    const worktreeResult = cleanupWorktree(id, body.force);

    launcher.setArchived(id, true);
    sessionStore.setArchived(id, true);
    return c.json({ ok: true, worktree: worktreeResult });
  });

  api.post("/sessions/:id/unarchive", (c) => {
    const id = c.req.param("id");
    launcher.setArchived(id, false);
    sessionStore.setArchived(id, false);
    return c.json({ ok: true });
  });

  api.post("/sessions/:id/title", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    if (!body.title || typeof body.title !== "string") {
      return c.json({ error: "Missing or invalid title" }, 400);
    }
    launcher.setTitle(id, body.title);
    wsBridge.setTitle(id, body.title);
    return c.json({ ok: true });
  });

  // ─── Available backends ─────────────────────────────────────

  api.get("/backends", (c) => {
    const backends: Array<{ id: string; name: string; available: boolean }> = [];

    // Check Claude Code
    let claudeAvailable = false;
    try {
      execSync("which claude", { encoding: "utf-8", timeout: 3000 });
      claudeAvailable = true;
    } catch {}
    backends.push({ id: "claude", name: "Claude Code", available: claudeAvailable });

    // Check Codex
    let codexAvailable = false;
    try {
      execSync("which codex", { encoding: "utf-8", timeout: 3000 });
      codexAvailable = true;
    } catch {}
    backends.push({ id: "codex", name: "Codex", available: codexAvailable });

    return c.json(backends);
  });

  api.get("/backends/:id/models", (c) => {
    const backendId = c.req.param("id");

    if (backendId === "codex") {
      // Read Codex model list from its local cache file
      const cachePath = join(homedir(), ".codex", "models_cache.json");
      if (!existsSync(cachePath)) {
        return c.json({ error: "Codex models cache not found. Run codex once to populate it." }, 404);
      }
      try {
        const raw = readFileSync(cachePath, "utf-8");
        const cache = JSON.parse(raw) as {
          models: Array<{
            slug: string;
            display_name?: string;
            description?: string;
            visibility?: string;
            priority?: number;
          }>;
        };
        // Only return visible models, sorted by priority
        const models = cache.models
          .filter((m) => m.visibility === "list")
          .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
          .map((m) => ({
            value: m.slug,
            label: m.display_name || m.slug,
            description: m.description || "",
          }));
        return c.json(models);
      } catch (e) {
        return c.json({ error: "Failed to parse Codex models cache" }, 500);
      }
    }

    // Claude models are hardcoded on the frontend
    return c.json({ error: "Use frontend defaults for this backend" }, 404);
  });

  // ─── Serve local images for ResultScanner ─────────────────────

  const IMAGE_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico",
    ".heic", ".avif", ".tif", ".tiff",
  ]);
  const MIME_MAP: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".bmp": "image/bmp", ".ico": "image/x-icon", ".heic": "image/heic",
    ".avif": "image/avif", ".tif": "image/tiff", ".tiff": "image/tiff",
  };

  api.get("/fs/image", async (c) => {
    const rawPath = c.req.query("path");
    if (!rawPath) return c.json({ error: "path required" }, 400);

    const resolved = resolve(rawPath.replace(/^~\//, homedir() + "/"));
    const allowedBase = homedir();
    if (!resolved.startsWith(allowedBase + sep) && resolved !== allowedBase) {
      return c.json({ error: "Access denied" }, 403);
    }

    const ext = "." + resolved.split(".").pop()!.toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      return c.json({ error: "Not an image file" }, 400);
    }

    try {
      const data = await readFile(resolved);
      return new Response(data, {
        headers: {
          "Content-Type": MIME_MAP[ext] || "application/octet-stream",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      return c.json({ error: "File not found" }, 404);
    }
  });

  // ─── Filesystem browsing ─────────────────────────────────────

  api.get("/fs/list", async (c) => {
    const rawPath = c.req.query("path") || homedir();
    const basePath = resolve(rawPath);

    try {
      const realPath = await realpath(basePath).catch(() => basePath);

      const entries = await readdir(realPath, { withFileTypes: true });
      const dirs: { name: string; path: string }[] = [];
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          dirs.push({ name: entry.name, path: join(realPath, entry.name) });
        }
      }
      dirs.sort((a, b) => a.name.localeCompare(b.name));
      return c.json({ path: realPath, dirs, home: homedir() });
    } catch (err) {
      console.error("[routes] fs/list error:", err);
      return c.json({ error: "Cannot read directory", path: basePath, dirs: [], home: homedir() }, 400);
    }
  });

  api.get("/fs/home", (c) => {
    const home = homedir();
    const cwd = process.cwd();
    // Only report cwd if the user launched companion from a real project directory
    // (not from the package root or the home directory itself)
    const packageRoot = process.env.__VIBE_PACKAGE_ROOT;
    const isProjectDir =
      cwd !== home &&
      (!packageRoot || !cwd.startsWith(packageRoot));
    return c.json({ home, cwd: isProjectDir ? cwd : home });
  });

  api.get("/fs/recent-projects", async (c) => {
    try {
      const claudeProjectsDir = join(homedir(), ".claude", "projects");
      const entries = await readdir(claudeProjectsDir, { withFileTypes: true }).catch(() => []);

      const projects: { path: string; lastUsed: number }[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Convert directory name to path: -Users-me-dev-apps -> /Users/me/dev/apps
        const dirName = entry.name;
        const path = dirName.replace(/^-/, "/").replace(/-/g, "/");

        // Get directory mtime as a proxy for last used
        try {
          const stats = await stat(join(claudeProjectsDir, entry.name));
          projects.push({ path, lastUsed: stats.mtime.getTime() });
        } catch {
          // Skip if we can't stat
        }
      }

      // Sort by most recent first and take top 20
      projects.sort((a, b) => b.lastUsed - a.lastUsed);
      const recentProjects = projects.slice(0, 20).map(p => p.path);

      // Filter out duplicates and the home directory
      const uniquePaths = Array.from(new Set(recentProjects)).filter(p => p !== homedir());

      return c.json({ projects: uniquePaths });
    } catch (e: unknown) {
      console.error("[routes] Failed to fetch recent projects:", e);
      return c.json({ projects: [] });
    }
  });

  // ─── Editor filesystem APIs ─────────────────────────────────────

  /** Recursive directory tree for the editor file explorer */
  api.get("/fs/tree", async (c) => {
    const rawPath = c.req.query("path");
    if (!rawPath) return c.json({ error: "path required" }, 400);
    const basePath = resolve(rawPath);

    interface TreeNode {
      name: string;
      path: string;
      type: "file" | "directory";
      children?: TreeNode[];
    }

    async function buildTree(dir: string, depth: number): Promise<TreeNode[]> {
      if (depth > 10) return []; // Safety limit
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        const nodes: TreeNode[] = [];
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules")
            continue;
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            const children = await buildTree(fullPath, depth + 1);
            nodes.push({
              name: entry.name,
              path: fullPath,
              type: "directory",
              children,
            });
          } else if (entry.isFile()) {
            nodes.push({ name: entry.name, path: fullPath, type: "file" });
          }
        }
        nodes.sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        return nodes;
      } catch {
        return [];
      }
    }

    const tree = await buildTree(basePath, 0);
    return c.json({ path: basePath, tree });
  });

  /** Read a single file */
  api.get("/fs/read", async (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "path required" }, 400);
    const absPath = resolve(filePath);
    try {
      const info = await stat(absPath);
      if (info.size > 2 * 1024 * 1024) {
        return c.json({ error: "File too large (>2MB)" }, 413);
      }
      const content = await readFile(absPath, "utf-8");
      return c.json({ path: absPath, content });
    } catch (e: unknown) {
      return c.json(
        { error: e instanceof Error ? e.message : "Cannot read file" },
        404,
      );
    }
  });

  /** Write a single file */
  api.put("/fs/write", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { path: filePath, content } = body;
    if (!filePath || typeof content !== "string") {
      return c.json({ error: "path and content required" }, 400);
    }
    const absPath = resolve(filePath);
    try {
      await writeFile(absPath, content, "utf-8");
      return c.json({ ok: true, path: absPath });
    } catch (e: unknown) {
      return c.json(
        { error: e instanceof Error ? e.message : "Cannot write file" },
        500,
      );
    }
  });

  /** Git diff for a single file (unified diff) */
  api.get("/fs/diff", (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "path required" }, 400);
    const absPath = resolve(filePath);
    try {
      const diff = execSync(`git diff HEAD -- "${absPath}"`, {
        cwd: dirname(absPath),
        encoding: "utf-8",
        timeout: 5000,
      });
      return c.json({ path: absPath, diff });
    } catch {
      return c.json({ path: absPath, diff: "" });
    }
  });

  // ─── Environments (~/.companion/envs/) ────────────────────────────

  api.get("/envs", (c) => {
    try {
      return c.json(envManager.listEnvs());
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.get("/envs/:slug", (c) => {
    const env = envManager.getEnv(c.req.param("slug"));
    if (!env) return c.json({ error: "Environment not found" }, 404);
    return c.json(env);
  });

  api.post("/envs", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      const env = envManager.createEnv(body.name, body.variables || {});
      return c.json(env, 201);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  api.put("/envs/:slug", async (c) => {
    const slug = c.req.param("slug");
    const body = await c.req.json().catch(() => ({}));
    try {
      const env = envManager.updateEnv(slug, {
        name: body.name,
        variables: body.variables,
      });
      if (!env) return c.json({ error: "Environment not found" }, 404);
      return c.json(env);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  api.delete("/envs/:slug", (c) => {
    const deleted = envManager.deleteEnv(c.req.param("slug"));
    if (!deleted) return c.json({ error: "Environment not found" }, 404);
    return c.json({ ok: true });
  });

  // ─── Git operations ─────────────────────────────────────────────────

  api.get("/git/repo-info", (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);
    const info = gitUtils.getRepoInfo(path);
    if (!info) return c.json({ error: "Not a git repository" }, 400);
    return c.json(info);
  });

  api.get("/git/branches", (c) => {
    const repoRoot = c.req.query("repoRoot");
    if (!repoRoot) return c.json({ error: "repoRoot required" }, 400);
    try {
      return c.json(gitUtils.listBranches(repoRoot));
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.get("/git/worktrees", (c) => {
    const repoRoot = c.req.query("repoRoot");
    if (!repoRoot) return c.json({ error: "repoRoot required" }, 400);
    try {
      return c.json(gitUtils.listWorktrees(repoRoot));
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.post("/git/worktree", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { repoRoot, branch, baseBranch, createBranch } = body;
    if (!repoRoot || !branch)
      return c.json({ error: "repoRoot and branch required" }, 400);
    try {
      const result = gitUtils.ensureWorktree(repoRoot, branch, {
        baseBranch,
        createBranch,
      });
      return c.json(result);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.delete("/git/worktree", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { repoRoot, worktreePath, force } = body;
    if (!repoRoot || !worktreePath)
      return c.json({ error: "repoRoot and worktreePath required" }, 400);
    const result = gitUtils.removeWorktree(repoRoot, worktreePath, { force });
    return c.json(result);
  });

  api.post("/git/fetch", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { repoRoot } = body;
    if (!repoRoot) return c.json({ error: "repoRoot required" }, 400);
    return c.json(gitUtils.gitFetch(repoRoot));
  });

  api.post("/git/pull", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { cwd } = body;
    if (!cwd) return c.json({ error: "cwd required" }, 400);
    const result = gitUtils.gitPull(cwd);
    // Return refreshed ahead/behind counts
    let git_ahead = 0,
      git_behind = 0;
    try {
      const counts = execSync(
        "git rev-list --left-right --count @{upstream}...HEAD",
        {
          cwd,
          encoding: "utf-8",
          timeout: 3000,
        },
      ).trim();
      const [behind, ahead] = counts.split(/\s+/).map(Number);
      git_ahead = ahead || 0;
      git_behind = behind || 0;
    } catch {
      /* no upstream */
    }
    return c.json({ ...result, git_ahead, git_behind });
  });

  // ─── Usage Limits ─────────────────────────────────────────────────────

  api.get("/usage-limits", async (c) => {
    const limits = await getUsageLimits();
    return c.json(limits);
  });

  api.get("/sessions/:id/usage-limits", async (c) => {
    const sessionId = c.req.param("id");
    const session = wsBridge.getSession(sessionId);
    const empty = { five_hour: null, seven_day: null, extra_usage: null };

    if (session?.backendType === "codex") {
      const rl = wsBridge.getCodexRateLimits(sessionId);
      if (!rl) return c.json(empty);
      const mapLimit = (l: { usedPercent: number; windowDurationMins: number; resetsAt: number } | null) => {
        if (!l) return null;
        return {
          utilization: l.usedPercent,
          resets_at: l.resetsAt ? new Date(l.resetsAt * 1000).toISOString() : null,
        };
      };
      return c.json({
        five_hour: mapLimit(rl.primary),
        seven_day: mapLimit(rl.secondary),
        extra_usage: null,
      });
    }

    // Claude sessions: use existing logic
    const limits = await getUsageLimits();
    return c.json(limits);
  });

  // ─── OpenAI-compatible Chat Completions ─────────────────────────────

  api.post("/v1/chat/completions", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { messages, model, stream = false } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: "messages array is required" }, 400);
    }

    try {
      // Create a temporary session
      const session = launcher.launch({
        model: model || "claude-sonnet-4-5-20250929",
        permissionMode: "bypass",
        backendType: "claude",
      });

      // Convert messages to a single prompt (simplified for now)
      const prompt = messages
        .filter((msg: { role: string; content: string }) => msg.role === "user")
        .map((msg: { content: string }) => msg.content)
        .join("\n\n");

      // Wait for response via polling (simplified - production should use WebSocket)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // For now, return a simple response structure
      // TODO: Implement proper session message handling via WebSocket
      const response = {
        id: session.sessionId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model || "claude-sonnet-4-5-20250929",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Companion service chat endpoint - implement WebSocket handling",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };

      // Clean up session after response
      setTimeout(() => launcher.kill(session.sessionId), 5000);

      return c.json(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[routes] Chat completion failed:", msg);
      return c.json({ error: msg }, 500);
    }
  });

  // ─── Command Execution (for HTML fragments in YOLO mode) ─────────────

  api.post("/exec", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { command, cwd } = body;

    if (!command || typeof command !== "string") {
      return c.json({ error: "command required" }, 400);
    }

    let workingDir = homedir();
    if (cwd) {
      if (typeof cwd !== "string") {
        return c.json({ error: "Invalid cwd" }, 400);
      }
      workingDir = resolve(cwd);
    }

    try {
      const output = execSync(command, {
        cwd: workingDir,
        encoding: "utf-8",
        timeout: 30000, // 30s timeout
        maxBuffer: 1024 * 1024, // 1MB max output
      });
      return c.json({ success: true, output: output.trim() });
    } catch (err: unknown) {
      const error = err as { status?: number; stderr?: string; stdout?: string; message?: string };
      return c.json({
        success: false,
        error: error.message || "Command failed",
        exitCode: error.status,
        stderr: error.stderr,
        stdout: error.stdout,
      }, 500);
    }
  });

  // ─── Helper ─────────────────────────────────────────────────────────

  function cleanupWorktree(
    sessionId: string,
    force?: boolean,
  ): { cleaned?: boolean; dirty?: boolean; path?: string } | undefined {
    const mapping = worktreeTracker.getBySession(sessionId);
    if (!mapping) return undefined;

    // Check if any other sessions still use this worktree
    if (worktreeTracker.isWorktreeInUse(mapping.worktreePath, sessionId)) {
      worktreeTracker.removeBySession(sessionId);
      return { cleaned: false, path: mapping.worktreePath };
    }

    // Auto-remove if clean, or force-remove if requested
    const dirty = gitUtils.isWorktreeDirty(mapping.worktreePath);
    if (dirty && !force) {
      console.log(
        `[routes] Worktree ${mapping.worktreePath} is dirty, not auto-removing`,
      );
      // Keep the mapping so the worktree remains trackable
      return { cleaned: false, dirty: true, path: mapping.worktreePath };
    }

    // Delete the companion-managed branch if it differs from the conceptual branch
    const branchToDelete =
      mapping.actualBranch && mapping.actualBranch !== mapping.branch
        ? mapping.actualBranch
        : undefined;
    const result = gitUtils.removeWorktree(
      mapping.repoRoot,
      mapping.worktreePath,
      { force: dirty, branchToDelete },
    );
    if (result.removed) {
      // Only remove the mapping after successful cleanup
      worktreeTracker.removeBySession(sessionId);
      console.log(
        `[routes] ${dirty ? "Force-removed dirty" : "Auto-removed clean"} worktree ${mapping.worktreePath}`,
      );
    }
    return { cleaned: result.removed, path: mapping.worktreePath };
  }

  return api;
}

/** Read first user message from a session JSONL as a title. */
const TITLE_GEN_PREFIX = "Generate a concise 3-5 word session title";

function stripTitleGenPrompt(text: string): string {
  if (!text.startsWith(TITLE_GEN_PREFIX)) return text;
  // This is an auto-namer session — return empty to filter it out
  return "";
}

async function extractSessionTitle(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
    let found = false;
    rl.on("line", (line) => {
      if (found) return;
      try {
        const data = JSON.parse(line);
        if (data.type === "summary") {
          found = true;
          rl.close();
          resolve(stripTitleGenPrompt(data.summary?.slice(0, 120) || ""));
          return;
        }
        if (data.type !== "user") return;
        const msg = data.message;
        if (!msg) return;
        const content = msg.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === "text" && block.text) {
              found = true;
              rl.close();
              resolve(stripTitleGenPrompt(block.text.slice(0, 120)));
              return;
            }
          }
        } else if (typeof content === "string") {
          found = true;
          rl.close();
          resolve(stripTitleGenPrompt(content.slice(0, 120)));
        }
      } catch { /* skip malformed lines */ }
    });
    rl.on("close", () => { if (!found) resolve(""); });
    rl.on("error", () => resolve(""));
  });
}
