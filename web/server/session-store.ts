import { mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { homedir } from "node:os";
import type {
  SessionState,
  BrowserIncomingMessage,
  PermissionRequest,
  BufferedBrowserEvent,
} from "./session-types.js";

// ─── Serializable session shape ─────────────────────────────────────────────

export interface PersistedSession {
  id: string;
  state: SessionState;
  messageHistory: BrowserIncomingMessage[];
  pendingMessages: string[];
  pendingPermissions: [string, PermissionRequest][];
  eventBuffer?: BufferedBrowserEvent[];
  nextEventSeq?: number;
  lastAckSeq?: number;
  processedClientMessageIds?: string[];
  archived?: boolean;
  title?: string;
  cliSessionId?: string;
  createdAt?: number;
}

// ─── Store ──────────────────────────────────────────────────────────────────

// Persistent location — survives reboots (unlike $TMPDIR)
const DEFAULT_DIR = join(homedir(), ".companion", "sessions");
const LEGACY_DIR = join(tmpdir(), "vibe-sessions");

export class SessionStore {
  private dir: string;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(dir?: string) {
    this.dir = dir || DEFAULT_DIR;
    mkdirSync(this.dir, { recursive: true });
    if (!dir) this.migrateFromLegacyDir();
  }

  /** Move session files from the old $TMPDIR location to the persistent directory. */
  private migrateFromLegacyDir(): void {
    if (!existsSync(LEGACY_DIR)) return;
    try {
      const files = readdirSync(LEGACY_DIR).filter((f) => f.endsWith(".json"));
      let migrated = 0;
      for (const file of files) {
        const dest = join(this.dir, file);
        if (existsSync(dest)) continue; // already exists in new location
        try {
          copyFileSync(join(LEGACY_DIR, file), dest);
          unlinkSync(join(LEGACY_DIR, file));
          migrated++;
        } catch {
          // Skip files that can't be migrated
        }
      }
      if (migrated > 0) {
        console.log(`[session-store] Migrated ${migrated} session file(s) from ${LEGACY_DIR} to ${this.dir}`);
      }
    } catch {
      // Legacy dir not readable
    }
  }

  private filePath(sessionId: string): string {
    return join(this.dir, `${sessionId}.json`);
  }

  /** Debounced write — batches rapid changes (e.g. multiple stream events). */
  save(session: PersistedSession): void {
    const existing = this.debounceTimers.get(session.id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(session.id);
      this.saveSync(session);
    }, 150);
    this.debounceTimers.set(session.id, timer);
  }

  /** Immediate write — use for critical state changes. */
  saveSync(session: PersistedSession): void {
    try {
      writeFileSync(this.filePath(session.id), JSON.stringify(session), "utf-8");
    } catch (err) {
      console.error(`[session-store] Failed to save session ${session.id}:`, err);
    }
  }

  /** Load a single session from disk. */
  load(sessionId: string): PersistedSession | null {
    try {
      const raw = readFileSync(this.filePath(sessionId), "utf-8");
      return JSON.parse(raw) as PersistedSession;
    } catch {
      return null;
    }
  }

  /** Load all sessions from disk. */
  loadAll(): PersistedSession[] {
    const sessions: PersistedSession[] = [];
    try {
      const files = readdirSync(this.dir).filter((f) => f.endsWith(".json") && f !== "launcher.json");
      for (const file of files) {
        try {
          const raw = readFileSync(join(this.dir, file), "utf-8");
          sessions.push(JSON.parse(raw));
        } catch {
          // Skip corrupt files
        }
      }
    } catch {
      // Dir doesn't exist yet
    }
    return sessions;
  }

  /** Set the archived flag on a persisted session. */
  setArchived(sessionId: string, archived: boolean): boolean {
    const session = this.load(sessionId);
    if (!session) return false;
    session.archived = archived;
    this.saveSync(session);
    return true;
  }

  /** Remove a session file from disk. */
  remove(sessionId: string): void {
    const timer = this.debounceTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(sessionId);
    }
    try {
      unlinkSync(this.filePath(sessionId));
    } catch {
      // File may not exist
    }
  }

  /** Persist launcher state (separate file). */
  saveLauncher(data: unknown): void {
    try {
      writeFileSync(join(this.dir, "launcher.json"), JSON.stringify(data), "utf-8");
    } catch (err) {
      console.error("[session-store] Failed to save launcher state:", err);
    }
  }

  /** Load launcher state. */
  loadLauncher<T>(): T | null {
    try {
      const raw = readFileSync(join(this.dir, "launcher.json"), "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** Find a session by CLI session ID. */
  findByCliSessionId(cliSessionId: string): PersistedSession | null {
    try {
      const files = readdirSync(this.dir).filter((f) => f.endsWith(".json") && f !== "launcher.json");
      for (const file of files) {
        try {
          const raw = readFileSync(join(this.dir, file), "utf-8");
          const session = JSON.parse(raw) as PersistedSession;
          if (session.cliSessionId === cliSessionId) {
            return session;
          }
        } catch {
          // Skip corrupt files
        }
      }
    } catch {
      // Dir doesn't exist yet
    }
    return null;
  }

  /** Remove ghost session files: no cwd and no message history. Returns count of purged files. */
  purgeGhosts(): number {
    // LOCAL: Only prune sessions older than 5 minutes to avoid deleting sessions
    // that were created just before a server restart (haven't received system.init yet).
    const GHOST_PRUNE_AGE_MS = 5 * 60 * 1000;
    let purged = 0;
    try {
      const files = readdirSync(this.dir).filter((f) => f.endsWith(".json") && f !== "launcher.json");
      for (const file of files) {
        try {
          const raw = readFileSync(join(this.dir, file), "utf-8");
          const session = JSON.parse(raw) as PersistedSession;
          const isGhost = !session.state?.cwd && (!session.messageHistory || session.messageHistory.length === 0);
          const isOld = !session.createdAt || Date.now() - session.createdAt > GHOST_PRUNE_AGE_MS;
          if (isGhost && isOld) {
            unlinkSync(join(this.dir, file));
            purged++;
          }
        } catch {
          // Skip corrupt files
        }
      }
    } catch {
      // Dir doesn't exist
    }
    if (purged > 0) {
      console.log(`[session-store] Purged ${purged} ghost session file(s)`);
    }
    return purged;
  }

  /** Cancel all pending debounce timers (for clean test teardown). */
  dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  get directory(): string {
    return this.dir;
  }
}
