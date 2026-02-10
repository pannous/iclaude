import { Hono } from "hono";
import { readdir, stat, realpath } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { homedir } from "node:os";
import type { CliLauncher } from "./cli-launcher.js";
import type { WsBridge } from "./ws-bridge.js";
import type { SessionStore } from "./session-store.js";
import type { WorktreeTracker } from "./worktree-tracker.js";
import * as envManager from "./env-manager.js";
import * as gitUtils from "./git-utils.js";

export function createRoutes(launcher: CliLauncher, wsBridge: WsBridge, sessionStore: SessionStore, worktreeTracker: WorktreeTracker) {
  const api = new Hono();

  // ─── SDK Sessions (--sdk-url) ─────────────────────────────────────

  api.post("/sessions/create", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
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
          console.log(`[routes] Injecting env "${companionEnv.name}" (${Object.keys(companionEnv.variables).length} vars):`, Object.keys(companionEnv.variables).join(", "));
          envVars = { ...companionEnv.variables, ...body.env };
        } else {
          console.warn(`[routes] Environment "${body.envSlug}" not found, ignoring`);
        }
      }

      // Validate cwd and apply path traversal protection
      let cwd = body.cwd;
      if (cwd !== undefined) {
        if (typeof cwd !== "string" || cwd.length === 0) {
          return c.json({ error: "Invalid cwd parameter" }, 400);
        }
        // Security: Ensure cwd is within home directory
        const resolvedCwd = resolve(cwd);
        const allowedBase = homedir();
        if (!resolvedCwd.startsWith(allowedBase + sep) && resolvedCwd !== allowedBase) {
          return c.json({ error: "cwd must be within home directory" }, 403);
        }
        cwd = resolvedCwd;
      }

      let worktreeInfo: { isWorktree: boolean; repoRoot: string; branch: string; worktreePath: string } | undefined;

      // If a branch is specified, set up a worktree
      if (body.branch && cwd) {
        if (typeof body.branch !== "string" || body.branch.length === 0 || body.branch.length > 200) {
          return c.json({ error: "Invalid branch parameter" }, 400);
        }
        const repoInfo = gitUtils.getRepoInfo(cwd);
        if (repoInfo) {
          // If the requested branch is the default branch, use the original repo dir
          if (body.branch !== repoInfo.defaultBranch) {
            const result = gitUtils.ensureWorktree(repoInfo.repoRoot, body.branch, {
              baseBranch: repoInfo.defaultBranch,
              createBranch: body.createBranch,
            });
            cwd = result.worktreePath;
            worktreeInfo = {
              isWorktree: true,
              repoRoot: repoInfo.repoRoot,
              branch: body.branch,
              worktreePath: result.worktreePath,
            };
          }
        }
      }

      const session = launcher.launch({
        model: body.model,
        permissionMode: body.permissionMode,
        cwd,
        claudeBinary: body.claudeBinary,
        allowedTools: body.allowedTools,
        env: envVars,
        worktreeInfo,
      });

      // Track the worktree mapping
      if (worktreeInfo) {
        worktreeTracker.addMapping({
          sessionId: session.sessionId,
          repoRoot: worktreeInfo.repoRoot,
          branch: worktreeInfo.branch,
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
    return c.json(launcher.listSessions());
  });

  api.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json(session);
  });

  api.post("/sessions/:id/kill", async (c) => {
    const id = c.req.param("id");
    const killed = await launcher.kill(id);
    if (!killed) return c.json({ error: "Session not found or already exited" }, 404);
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
    return c.json({ ok: true });
  });

  // ─── Filesystem browsing ─────────────────────────────────────

  api.get("/fs/list", async (c) => {
    const rawPath = c.req.query("path") || homedir();
    const basePath = resolve(rawPath);

    try {
      // Security: Validate the path is within safe boundaries
      // Resolve to real path to prevent symlink attacks
      const realPath = await realpath(basePath).catch(() => basePath);

      // Only allow access to user's home directory and subdirectories
      const allowedBase = homedir();
      if (!realPath.startsWith(allowedBase + sep) && realPath !== allowedBase) {
        return c.json({
          error: "Access denied: Path must be within home directory",
          path: basePath,
          dirs: [],
          home: homedir()
        }, 403);
      }

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
    return c.json({ home: homedir(), cwd: process.cwd() });
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
      const env = envManager.updateEnv(slug, { name: body.name, variables: body.variables });
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
    if (!repoRoot || !branch) return c.json({ error: "repoRoot and branch required" }, 400);
    try {
      const result = gitUtils.ensureWorktree(repoRoot, branch, { baseBranch, createBranch });
      return c.json(result);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.delete("/git/worktree", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { repoRoot, worktreePath, force } = body;
    if (!repoRoot || !worktreePath) return c.json({ error: "repoRoot and worktreePath required" }, 400);
    const result = gitUtils.removeWorktree(repoRoot, worktreePath, { force });
    return c.json(result);
  });

  // ─── Helper ─────────────────────────────────────────────────────────

  function cleanupWorktree(sessionId: string, force?: boolean): { cleaned?: boolean; dirty?: boolean; path?: string } | undefined {
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
      console.log(`[routes] Worktree ${mapping.worktreePath} is dirty, not auto-removing`);
      // Keep the mapping so the worktree remains trackable
      return { cleaned: false, dirty: true, path: mapping.worktreePath };
    }

    const result = gitUtils.removeWorktree(mapping.repoRoot, mapping.worktreePath, { force: dirty });
    if (result.removed) {
      // Only remove the mapping after successful cleanup
      worktreeTracker.removeBySession(sessionId);
      console.log(`[routes] ${dirty ? "Force-removed dirty" : "Auto-removed clean"} worktree ${mapping.worktreePath}`);
    }
    return { cleaned: result.removed, path: mapping.worktreePath };
  }

  return api;
}
