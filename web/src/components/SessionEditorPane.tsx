import { useCallback, useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { api, type TreeNode } from "../api.js";
import { useStore } from "../store.js";

interface SessionEditorPaneProps {
  sessionId: string;
}

const LARGE_FILE_THRESHOLD = 512 * 1024; // 512 KB — warn before loading
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB — server rejects above this

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function flattenFiles(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      out.push(node);
      continue;
    }
    if (node.children?.length) {
      out.push(...flattenFiles(node.children));
    }
  }
  return out;
}

function relPath(cwd: string, path: string): string {
  if (path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
  return path;
}

interface TreeEntryProps {
  node: TreeNode;
  depth: number;
  cwd: string;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function TreeEntry({ node, depth, cwd, selectedPath, onSelect }: TreeEntryProps) {
  const [open, setOpen] = useState(depth < 1);
  if (node.type === "directory") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 py-1.5 pr-2 text-left text-xs text-cc-muted hover:text-cc-fg hover:bg-cc-hover rounded cursor-pointer"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          aria-label={`Toggle ${relPath(cwd, node.path)}`}
        >
          <span className="w-3 inline-flex justify-center">{open ? "▾" : "▸"}</span>
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map((child) => (
          <TreeEntry
            key={child.path}
            node={child}
            depth={depth + 1}
            cwd={cwd}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  const selected = selectedPath === node.path;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={`w-full py-1.5 pr-2 text-left text-xs rounded truncate cursor-pointer ${
        selected ? "bg-cc-active text-cc-fg" : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
      }`}
      style={{ paddingLeft: `${26 + depth * 12}px` }}
      title={relPath(cwd, node.path)}
    >
      {node.name}
    </button>
  );
}

export function SessionEditorPane({ sessionId }: SessionEditorPaneProps) {
  const darkMode = useStore((s) => s.darkMode);
  const cwd = useStore((s) =>
    s.sessions.get(sessionId)?.cwd
    || s.sdkSessions.find((sdk) => sdk.sessionId === sessionId)?.cwd
    || null,
  );
  const storeActiveFile = useStore((s) => s.editorActiveFilePath);
  const setEditorActiveFilePath = useStore((s) => s.setEditorActiveFilePath);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fileSize, setFileSize] = useState<number | null>(null);
  // When a large file is detected, we pause loading until the user confirms
  const [pendingLargeFile, setPendingLargeFile] = useState<{ path: string; size: number } | null>(null);

  const dirty = content !== originalContent;
  const files = useMemo(() => flattenFiles(tree), [tree]);

  const closeFile = useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setSelectedPath(null);
    setContent("");
    setOriginalContent("");
    setFileSize(null);
    setPendingLargeFile(null);
    setError(null);
    setEditorActiveFilePath(null);
  }, [dirty, setEditorActiveFilePath]);

  // When a file is opened via openFileInEditor (e.g. clicking a path in chat),
  // resolve it against cwd and switch to it
  useEffect(() => {
    if (!storeActiveFile) return;
    const resolved = storeActiveFile.startsWith("/")
      ? storeActiveFile
      : cwd ? `${cwd}/${storeActiveFile}` : storeActiveFile;
    if (resolved !== selectedPath) {
      if (dirty && !window.confirm("Discard unsaved changes?")) return;
      setSelectedPath(resolved);
    }
  }, [storeActiveFile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cwd) {
      setLoadingTree(false);
      return;
    }
    let cancelled = false;
    setLoadingTree(true);
    setError(null);
    api.getFileTree(cwd).then((res) => {
      if (cancelled) return;
      setTree(res.tree);
      // Only auto-select the first file if no file was explicitly requested
      if (!selectedPath && !storeActiveFile) {
        const firstFile = flattenFiles(res.tree)[0];
        setSelectedPath(firstFile?.path ?? null);
      }
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Failed to load file tree");
      setTree([]);
      setSelectedPath(null);
    }).finally(() => {
      if (!cancelled) setLoadingTree(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cwd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check file size before loading content — gate large files behind confirmation
  useEffect(() => {
    if (!selectedPath) {
      setContent("");
      setOriginalContent("");
      setFileSize(null);
      setPendingLargeFile(null);
      return;
    }
    let cancelled = false;
    setLoadingFile(true);
    setError(null);
    setPendingLargeFile(null);

    api.statFile(selectedPath).then((info) => {
      if (cancelled) return;
      setFileSize(info.size);

      if (info.size > MAX_FILE_SIZE) {
        setError(`File too large to edit (${formatBytes(info.size)}). Maximum is ${formatBytes(MAX_FILE_SIZE)}.`);
        setContent("");
        setOriginalContent("");
        setLoadingFile(false);
        return;
      }

      if (info.size > LARGE_FILE_THRESHOLD) {
        setPendingLargeFile({ path: selectedPath, size: info.size });
        setLoadingFile(false);
        return;
      }

      // Small file — load directly
      return api.readFile(selectedPath).then((res) => {
        if (cancelled) return;
        setContent(res.content);
        setOriginalContent(res.content);
      });
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Failed to read file");
      setContent("");
      setOriginalContent("");
    }).finally(() => {
      if (!cancelled) setLoadingFile(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPath]);

  const loadLargeFile = useCallback(() => {
    if (!pendingLargeFile) return;
    const path = pendingLargeFile.path;
    setPendingLargeFile(null);
    setLoadingFile(true);
    setError(null);
    api.readFile(path).then((res) => {
      setContent(res.content);
      setOriginalContent(res.content);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to read file");
      setContent("");
      setOriginalContent("");
    }).finally(() => {
      setLoadingFile(false);
    });
  }, [pendingLargeFile]);

  const saveCurrentFile = useCallback(() => {
    if (!selectedPath || saving || !dirty) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    api.writeFile(selectedPath, content).then(() => {
      setOriginalContent(content);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to save file");
    }).finally(() => {
      setSaving(false);
    });
  }, [content, dirty, saving, selectedPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      saveCurrentFile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveCurrentFile]);

  if (!cwd) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-sm text-cc-muted">
        Editor unavailable while session is reconnecting.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex bg-cc-bg">
      <aside className="w-[280px] shrink-0 border-r border-cc-border bg-cc-sidebar/60 flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-cc-border text-xs text-cc-muted font-medium">Files</div>
        <div className="flex-1 min-h-0 overflow-auto p-1.5">
          {loadingTree && <div className="px-2 py-2 text-xs text-cc-muted">Loading files...</div>}
          {!loadingTree && files.length === 0 && <div className="px-2 py-2 text-xs text-cc-muted">No editable files found.</div>}
          {!loadingTree && tree.map((node) => (
            <TreeEntry
              key={node.path}
              node={node}
              depth={0}
              cwd={cwd}
              selectedPath={selectedPath}
              onSelect={(nextPath) => {
                if (dirty && !window.confirm("Discard unsaved changes?")) return;
                setPendingLargeFile(null);
                setSelectedPath(nextPath);
              }}
            />
          ))}
        </div>
      </aside>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-2 border-b border-cc-border bg-cc-sidebar flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-cc-muted truncate">{selectedPath ? relPath(cwd, selectedPath) : "No file selected"}</p>
              {fileSize !== null && selectedPath && (
                <span className="text-[10px] text-cc-muted/60 shrink-0">{formatBytes(fileSize)}</span>
              )}
            </div>
            {dirty && <p className="text-[10px] text-amber-500">Unsaved changes</p>}
            {saved && <p className="text-[10px] text-cc-success">Saved</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={saveCurrentFile}
              disabled={!selectedPath || saving || loadingFile || !dirty}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !selectedPath || saving || loadingFile || !dirty
                  ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                  : "bg-cc-primary text-white hover:bg-cc-primary-hover cursor-pointer"
              }`}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {selectedPath && (
              <button
                type="button"
                onClick={closeFile}
                className="p-1.5 rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
                aria-label="Close file"
                title="Close file and free memory"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="m-3 px-3 py-2 rounded-lg bg-cc-error/10 border border-cc-error/30 text-xs text-cc-error">
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {pendingLargeFile ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="text-4xl">&#x26a0;</div>
              <div>
                <p className="text-sm text-cc-fg font-medium">Large file: {formatBytes(pendingLargeFile.size)}</p>
                <p className="text-xs text-cc-muted mt-1">
                  Loading large files into the editor may slow down your browser.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={loadLargeFile}
                  className="px-4 py-2 rounded-md text-xs font-medium bg-cc-primary text-white hover:bg-cc-primary-hover cursor-pointer transition-colors"
                >
                  Open anyway
                </button>
                <button
                  type="button"
                  onClick={closeFile}
                  className="px-4 py-2 rounded-md text-xs font-medium bg-cc-hover text-cc-muted hover:text-cc-fg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : loadingFile ? (
            <div className="h-full flex items-center justify-center text-sm text-cc-muted">Loading file...</div>
          ) : selectedPath ? (
            <CodeMirror
              value={content}
              onChange={(value: string) => setContent(value)}
              extensions={[EditorView.lineWrapping]}
              theme={darkMode ? "dark" : "light"}
              basicSetup={{
                foldGutter: true,
                dropCursor: false,
                allowMultipleSelections: false,
              }}
              className="h-full text-sm"
              height="100%"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-cc-muted">Select a file to start editing.</div>
          )}
        </div>
      </div>
    </div>
  );
}
