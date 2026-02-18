import { useState, useEffect, useCallback, useRef } from "react";
import { api, type TreeNode } from "../api.js";
import { useStore } from "../store.js";

// ─── File Tree ────────────────────────────────────────────────────

function FileTreeNode({
  node,
  depth,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full px-2 py-1 text-left text-[12px] text-cc-fg/70 hover:bg-cc-hover transition-colors cursor-pointer"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`w-3 h-3 text-cc-muted shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-cc-warning/70 shrink-0">
            <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
          </svg>
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <FileTreeNode key={child.path} node={child} depth={depth + 1} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className="flex items-center gap-1.5 w-full px-2 py-1 text-left text-[12px] text-cc-fg/70 hover:bg-cc-hover transition-colors cursor-pointer"
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <span className="w-3 shrink-0" />
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-cc-primary/60 shrink-0">
        <path d="M4 1.5a.5.5 0 01.5-.5h7a.5.5 0 01.354.146l2 2A.5.5 0 0114 3.5v11a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-13z" />
      </svg>
      <span className="truncate font-mono-code">{node.name}</span>
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Resolve a potentially relative path against the session cwd */
function resolvePath(path: string, cwd: string | null): string {
  if (path.startsWith("/")) return path;
  return cwd ? `${cwd}/${path}` : path;
}

// ─── File Editor Component ────────────────────────────────────────

export function FileEditor() {
  const openFiles = useStore((s) => s.editorFiles);
  const activeFilePath = useStore((s) => s.editorActiveFilePath);
  const openFileInEditor = useStore((s) => s.openFileInEditor);
  const closeEditorFile = useStore((s) => s.closeEditorFile);
  const setEditorActiveFilePath = useStore((s) => s.setEditorActiveFilePath);
  const cwd = useStore((s) => {
    const sid = s.currentSessionId;
    if (!sid) return null;
    return (
      s.sessions.get(sid)?.cwd ||
      s.sdkSessions.find((sdk) => sdk.sessionId === sid)?.cwd ||
      null
    );
  });

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  // Content maps are keyed by *resolved* (absolute) path
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [editBuffers, setEditBuffers] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resolved = activeFilePath ? resolvePath(activeFilePath, cwd) : null;

  const isDirty = resolved
    ? editBuffers.has(resolved) && editBuffers.get(resolved) !== fileContents.get(resolved)
    : false;

  // Load file tree when cwd changes
  useEffect(() => {
    if (!cwd) return;
    setTreeLoading(true);
    api.getFileTree(cwd)
      .then((res) => setTree(res.tree))
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false));
  }, [cwd]);

  // Load file content when a new file is opened
  useEffect(() => {
    if (!resolved || fileContents.has(resolved)) return;
    setError(null);
    api.readFile(resolved)
      .then((res) => {
        setFileContents((prev) => new Map(prev).set(resolved, res.content));
        setEditBuffers((prev) => new Map(prev).set(resolved, res.content));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [resolved, fileContents]);

  // Focus textarea when switching files
  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeFilePath]);

  const handleSave = useCallback(async () => {
    if (!resolved || !isDirty) return;
    setSaving(true);
    setError(null);
    try {
      const content = editBuffers.get(resolved) ?? "";
      await api.writeFile(resolved, content);
      setFileContents((prev) => new Map(prev).set(resolved, content));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [resolved, isDirty, editBuffers]);

  // Cmd/Ctrl+S to save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const handleClose = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const abs = resolvePath(filePath, cwd);
    const buffer = editBuffers.get(abs);
    const original = fileContents.get(abs);
    if (buffer !== undefined && original !== undefined && buffer !== original) {
      if (!confirm("Discard unsaved changes?")) return;
    }
    setFileContents((prev) => { const m = new Map(prev); m.delete(abs); return m; });
    setEditBuffers((prev) => { const m = new Map(prev); m.delete(abs); return m; });
    closeEditorFile(filePath);
  };

  const relPath = (p: string) =>
    cwd && p.startsWith(cwd + "/") ? p.slice(cwd.length + 1) : p;

  const fileName = (p: string) => p.split("/").pop() ?? p;

  const isFileDirty = (p: string) => {
    const abs = resolvePath(p, cwd);
    return editBuffers.has(abs) && editBuffers.get(abs) !== fileContents.get(abs);
  };

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex">
        {/* Sidebar - file tree */}
        {cwd && (
          <div className="shrink-0 w-[220px] border-r border-cc-border bg-cc-sidebar flex flex-col">
            <div className="px-3 py-2 text-[10px] font-semibold text-cc-muted uppercase tracking-wider border-b border-cc-border">
              Files
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {treeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-4 h-4 border-2 border-cc-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                tree.map((node) => (
                  <FileTreeNode key={node.path} node={node} depth={0} onSelect={openFileInEditor} />
                ))
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-14 h-14 rounded-2xl bg-cc-card border border-cc-border flex items-center justify-center">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-6 h-6 text-cc-muted">
              <path d="M2 2.5A.5.5 0 012.5 2h3.879a.5.5 0 01.354.146L8.854 4.268A.5.5 0 009.232 4.414H13.5a.5.5 0 01.5.5v9a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-11z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm text-cc-fg font-medium mb-1">No files open</p>
            <p className="text-xs text-cc-muted leading-relaxed max-w-[280px]">
              Click a file path in the chat or browse the file tree to open files for editing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentContent = resolved ? (editBuffers.get(resolved) ?? "") : "";

  return (
    <div className="h-full flex">
      {/* Sidebar - file tree (collapsible) */}
      {sidebarVisible && cwd && (
        <div className="shrink-0 w-[220px] border-r border-cc-border bg-cc-sidebar flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-cc-border">
            <span className="text-[10px] font-semibold text-cc-muted uppercase tracking-wider">Files</span>
            <button
              onClick={() => setSidebarVisible(false)}
              className="w-5 h-5 flex items-center justify-center rounded text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
              title="Hide file tree"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                <path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {treeLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 border-2 border-cc-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              tree.map((node) => (
                <FileTreeNode key={node.path} node={node} depth={0} onSelect={openFileInEditor} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* File tabs bar */}
        <div className="shrink-0 flex items-center bg-cc-card border-b border-cc-border overflow-x-auto">
          {!sidebarVisible && cwd && (
            <button
              onClick={() => setSidebarVisible(true)}
              className="shrink-0 w-8 h-8 flex items-center justify-center text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
              title="Show file tree"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {openFiles.map((fp) => (
            <button
              key={fp}
              onClick={() => setEditorActiveFilePath(fp)}
              className={`group/tab flex items-center gap-1.5 shrink-0 px-3 py-2 text-[12px] border-r border-cc-border transition-colors cursor-pointer ${
                fp === activeFilePath
                  ? "bg-cc-bg text-cc-fg"
                  : "text-cc-muted hover:bg-cc-hover/70"
              }`}
              title={fp}
            >
              {isFileDirty(fp) && (
                <span className="w-1.5 h-1.5 rounded-full bg-cc-warning shrink-0" />
              )}
              <span className="truncate font-mono-code max-w-[160px]">{fileName(fp)}</span>
              <span
                onClick={(e) => handleClose(fp, e)}
                className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover/tab:opacity-100 hover:bg-cc-hover transition-all cursor-pointer"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        {/* File path + save bar */}
        {resolved && (
          <div className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-cc-card/50 border-b border-cc-border">
            <span className="text-[11px] text-cc-muted font-mono-code truncate">
              {relPath(resolved)}
            </span>
            <div className="flex items-center gap-2">
              {isDirty && (
                <span className="text-[10px] text-cc-warning font-medium">Unsaved</span>
              )}
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                  isDirty && !saving
                    ? "bg-cc-primary text-white hover:bg-cc-primary/90"
                    : "bg-cc-hover text-cc-muted cursor-not-allowed"
                }`}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* Textarea */}
        {resolved && (
          <textarea
            ref={textareaRef}
            value={currentContent}
            onChange={(e) => {
              if (!resolved) return;
              setEditBuffers((prev) => new Map(prev).set(resolved, e.target.value));
            }}
            spellCheck={false}
            className="flex-1 w-full p-4 bg-cc-bg text-cc-fg text-[13px] font-mono-code leading-relaxed resize-none focus:outline-none"
            placeholder="Loading..."
          />
        )}

        {/* Error bar */}
        {error && (
          <div className="shrink-0 px-4 py-2 bg-cc-error/10 border-t border-cc-error/20 text-xs text-cc-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
