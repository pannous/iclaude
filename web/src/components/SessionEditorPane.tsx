import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { Fzf } from "fzf";
import { api, type TreeNode } from "../api.js";
import { useStore } from "../store.js";

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "ico", "bmp", "tiff", "tif",
]);

function isImageFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

/** Map file extension to a CodeMirror language extension. */
function langForPath(filePath: string): Extension | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return javascript();
    case "ts":
    case "mts":
    case "cts":
      return javascript({ typescript: true });
    case "jsx":
      return javascript({ jsx: true });
    case "tsx":
      return javascript({ jsx: true, typescript: true });
    case "css":
    case "scss":
    case "less":
      return css();
    case "html":
    case "htm":
    case "svelte":
    case "vue":
      return html();
    case "json":
    case "jsonc":
    case "json5":
      return json();
    case "md":
    case "mdx":
    case "markdown":
      return markdown();
    case "py":
    case "pyw":
    case "pyi":
      return python();
    case "rs":
      return rust();
    case "c":
    case "h":
    case "cpp":
    case "cxx":
    case "cc":
    case "hpp":
    case "hxx":
      return cpp();
    case "java":
      return java();
    case "sql":
      return sql();
    case "xml":
    case "xsl":
    case "xsd":
    case "svg":
      return xml();
    case "yml":
    case "yaml":
      return yaml();
    default:
      return null;
  }
}

interface SessionEditorPaneProps {
  sessionId: string;
}

// LOCAL: large file size thresholds
const LARGE_FILE_THRESHOLD = 512 * 1024; // 512 KB — warn before loading
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB — server rejects above this

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relPath(cwd: string, path: string): string {
  if (path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
  return path;
}

/** Flatten a tree of nodes into a list of file entries with relative paths. */
function flattenTree(nodes: TreeNode[], cwd: string): { path: string; relPath: string }[] {
  const results: { path: string; relPath: string }[] = [];
  function walk(items: TreeNode[]) {
    for (const node of items) {
      if (node.type === "file") results.push({ path: node.path, relPath: relPath(cwd, node.path) });
      if (node.children) walk(node.children);
    }
  }
  walk(nodes);
  return results;
}

/** Map git status code to a text color class using the app's theme tokens. */
function gitStatusColor(status: string | undefined): string {
  if (!status) return "";
  switch (status) {
    case "M": return "text-cc-warning";
    case "A": return "text-cc-success";
    case "D": return "text-cc-error line-through";
    default: return "";
  }
}

interface TreeEntryProps {
  node: TreeNode;
  depth: number;
  cwd: string;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  gitStatus?: Map<string, string>;
}

function TreeEntry({ node, depth, cwd, selectedPath, onSelect, gitStatus }: TreeEntryProps) {
  const [open, setOpen] = useState(false);
  if (node.type === "directory") {
    // A directory is "dirty" if any descendant file has a git status
    const dirHasChanges = gitStatus ? [...gitStatus.keys()].some((p) => p.startsWith(`${node.path}/`)) : false;
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center gap-1.5 py-1.5 pr-2 text-left text-xs hover:text-cc-fg hover:bg-cc-hover rounded cursor-pointer ${
            dirHasChanges ? "text-cc-warning/70" : "text-cc-muted"
          }`}
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
            gitStatus={gitStatus}
          />
        ))}
      </div>
    );
  }

  const selected = selectedPath === node.path;
  const fileStatus = gitStatus?.get(node.path);
  const statusColor = gitStatusColor(fileStatus);
  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={`w-full py-1.5 pr-2 text-left text-xs rounded truncate cursor-pointer ${
        selected ? "bg-cc-active text-cc-fg" : statusColor || "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
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
  // LOCAL: support opening files from chat via store
  const storeActiveFile = useStore((s) => s.editorActiveFilePath);
  const setEditorActiveFilePath = useStore((s) => s.setEditorActiveFilePath);
  // Bumped when Claude edits a file — triggers tree + open file refresh
  const changedFilesTick = useStore((s) => s.changedFilesTick.get(sessionId) ?? 0);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [gitStatus, setGitStatus] = useState<Map<string, string>>(new Map());
  const [loadingTree, setLoadingTree] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // LOCAL: file size tracking for large file gate
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [pendingLargeFile, setPendingLargeFile] = useState<{ path: string; size: number } | null>(null);

  const dirty = content !== originalContent;

  // LOCAL: close file helper (clears state including editorActiveFilePath)
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

  // LOCAL: When a file is opened via openFileInEditor (e.g. clicking a path in chat),
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

  // Keep ref in sync so unmount cleanup can access current value
  useEffect(() => { imageUrlRef.current = imageUrl; }, [imageUrl]);

  // Revoke object URL on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    };
  }, []);

  // CodeMirror extensions with language detection
  const extensions = useMemo(() => {
    if (!selectedPath) return [EditorView.lineWrapping];
    const exts: Extension[] = [EditorView.lineWrapping];
    const lang = langForPath(selectedPath);
    if (lang) exts.push(lang);
    return exts;
  }, [selectedPath]);

  // A counter we can bump to force a tree + file re-fetch (manual refresh button)
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshTree = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // ── Search state (file search + find in files) ──
  type SearchMode = "files" | "content";
  const [searchActive, setSearchActive] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("files");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Content search (grep) state
  const [grepResults, setGrepResults] = useState<Array<{ path: string; line: number; text: string }>>([]);
  const [grepLoading, setGrepLoading] = useState(false);
  const [grepTruncated, setGrepTruncated] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const grepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatFiles = useMemo(() => (cwd ? flattenTree(tree, cwd) : []), [tree, cwd]);

  const searchResults = useMemo(() => {
    if (searchMode !== "files") return [];
    const q = searchQuery.trim();
    if (!q) return flatFiles.slice(0, 50);

    if (q.includes("*") || q.includes("?")) {
      const matchFullPath = q.includes("/");
      const escaped = q.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      const pattern = escaped.replace(/\*\*/g, "##GLOBSTAR##").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/##GLOBSTAR##/g, ".*");
      try {
        const re = new RegExp(`^${pattern}$`, "i");
        return flatFiles.filter((f) => {
          const target = matchFullPath ? f.relPath : f.relPath.split("/").pop()!;
          return re.test(target);
        }).slice(0, 50);
      } catch {
        // fall through to fuzzy
      }
    }

    const fzf = new Fzf(flatFiles, { selector: (item) => item.relPath, limit: 50 });
    return fzf.find(q).map((r) => r.item);
  }, [flatFiles, searchQuery, searchMode]);

  // Debounced grep when in content mode
  useEffect(() => {
    if (searchMode !== "content" || !cwd) return;
    const q = searchQuery.trim();
    if (!q) {
      setGrepResults([]);
      setGrepTruncated(false);
      return;
    }
    if (grepTimerRef.current) clearTimeout(grepTimerRef.current);
    grepTimerRef.current = setTimeout(() => {
      setGrepLoading(true);
      api.grepFiles(cwd, q, { caseSensitive, regex: useRegex }).then((res) => {
        setGrepResults(res.matches);
        setGrepTruncated(res.truncated);
      }).catch(() => {
        setGrepResults([]);
        setGrepTruncated(false);
      }).finally(() => setGrepLoading(false));
    }, 300);
    return () => { if (grepTimerRef.current) clearTimeout(grepTimerRef.current); };
  }, [searchQuery, searchMode, cwd, caseSensitive, useRegex]);

  // Group grep results by file
  const grepGrouped = useMemo(() => {
    const groups = new Map<string, Array<{ line: number; text: string }>>();
    for (const m of grepResults) {
      let arr = groups.get(m.path);
      if (!arr) { arr = []; groups.set(m.path, arr); }
      arr.push({ line: m.line, text: m.text });
    }
    return groups;
  }, [grepResults]);

  // Flatten grep groups for keyboard navigation
  const grepFlatList = useMemo(() => {
    const items: Array<{ path: string; line: number }>[] = [];
    for (const [path, lines] of grepGrouped) {
      for (const l of lines) items.push([{ path, line: l.line }]);
    }
    return items.flat();
  }, [grepGrouped]);

  // Reset selection index when results change
  useEffect(() => {
    setSearchSelectedIndex(0);
  }, [searchResults, grepResults]);

  const openSearch = useCallback((mode: SearchMode = "files") => {
    setSearchActive(true);
    setSearchMode(mode);
    setSearchQuery("");
    setSearchSelectedIndex(0);
    setGrepResults([]);
    setGrepTruncated(false);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchActive(false);
    setSearchQuery("");
    setSearchSelectedIndex(0);
    setGrepResults([]);
    setGrepTruncated(false);
  }, []);

  // Focus the search input when search opens or mode changes
  useEffect(() => {
    if (searchActive) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchActive, searchMode]);

  // Cmd/Ctrl+P = find file, Cmd/Ctrl+F = find in files
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "p") {
        event.preventDefault();
        if (searchActive && searchMode === "files") closeSearch();
        else openSearch("files");
      } else if (key === "f") {
        event.preventDefault();
        if (searchActive && searchMode === "content") closeSearch();
        else openSearch("content");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchActive, searchMode, openSearch, closeSearch]);

  // Load file tree and git status when cwd changes, when Claude edits files, or on manual refresh
  useEffect(() => {
    if (!cwd) {
      setLoadingTree(false);
      return;
    }
    let cancelled = false;
    setLoadingTree(true);
    setError(null);
    // Fetch tree and git status in parallel
    const treePromise = api.getFileTree(cwd);
    const gitPromise = api.getChangedFiles(cwd, "last-commit").catch(() => ({ files: [] }));
    Promise.all([treePromise, gitPromise]).then(([treeRes, gitRes]) => {
      if (cancelled) return;
      setTree(treeRes.tree);
      setGitStatus(new Map(gitRes.files.map((f) => [f.path, f.status])));
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
  }, [cwd, changedFilesTick, refreshKey]);

  // Re-fetch the currently open file when Claude edits files (changedFilesTick bumps).
  // Uses refs so the effect only depends on changedFilesTick itself.
  const selectedPathRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  useEffect(() => { selectedPathRef.current = selectedPath; }, [selectedPath]);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  useEffect(() => {
    if (changedFilesTick === 0) return;
    const path = selectedPathRef.current;
    if (!path || isImageFile(path)) return;
    if (dirtyRef.current) return; // don't overwrite unsaved user edits
    let cancelled = false;
    api.readFile(path).then((res) => {
      if (cancelled) return;
      setContent(res.content);
      setOriginalContent(res.content);
    }).catch(() => { /* file may have been deleted */ });
    return () => { cancelled = true; };
  }, [changedFilesTick]);

  // LOCAL: Check file size before loading content — gate large files behind confirmation
  useEffect(() => {
    if (!selectedPath) {
      setContent("");
      setOriginalContent("");
      setFileSize(null);
      setPendingLargeFile(null);
      setImageUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      return;
    }
    let cancelled = false;
    setLoadingFile(true);
    setError(null);
    setPendingLargeFile(null);

    if (isImageFile(selectedPath)) {
      setContent("");
      setOriginalContent("");
      api.getFileBlob(selectedPath).then((url) => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        setImageUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      }).catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load image");
        setImageUrl(null);
      }).finally(() => {
        if (!cancelled) setLoadingFile(false);
      });
    } else {
      setImageUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });

      // LOCAL: stat file first to check size limits
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
    }
    return () => {
      cancelled = true;
    };
  }, [selectedPath]);

  // LOCAL: load large file after user confirmation
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

  const handleBack = useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setSelectedPath(null);
    setContent("");
    setOriginalContent("");
    setImageUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setError(null);
  }, [dirty]);

  const handleSelectFile = useCallback((nextPath: string) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setPendingLargeFile(null);
    setSelectedPath(nextPath);
  }, [dirty]);

  const selectSearchResult = useCallback((path: string) => {
    handleSelectFile(path);
    closeSearch();
  }, [handleSelectFile, closeSearch]);

  if (!cwd) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-sm text-cc-muted">
        Editor unavailable while session is reconnecting.
      </div>
    );
  }

  const isImage = selectedPath ? isImageFile(selectedPath) : false;

  // ── Search result keyboard handler ──
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
      return;
    }
    const list = searchMode === "files" ? searchResults : grepFlatList;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchSelectedIndex((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = list[searchSelectedIndex];
      if (item) selectSearchResult(item.path);
    }
  }, [closeSearch, searchMode, searchResults, grepFlatList, searchSelectedIndex, selectSearchResult]);

  // ── Tree panel (reused in both desktop sidebar and mobile master view) ──
  const treePanel = (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-3 py-2 border-b border-cc-border flex items-center justify-between">
        <span className="text-xs text-cc-muted font-medium">Files</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => searchActive && searchMode === "files" ? closeSearch() : openSearch("files")}
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer ${
              searchActive && searchMode === "files"
                ? "text-cc-fg bg-cc-hover"
                : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
            }`}
            aria-label="Search files"
            title="Find file (⌘P)"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => searchActive && searchMode === "content" ? closeSearch() : openSearch("content")}
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer ${
              searchActive && searchMode === "content"
                ? "text-cc-fg bg-cc-hover"
                : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
            }`}
            aria-label="Find in files"
            title="Find in files (⌘F)"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
              <path d="M2 3h7M2 6.5h5M2 10h6" strokeLinecap="round" />
              <circle cx="12" cy="10" r="2.5" fill="none" />
              <path d="M14 12l1.5 1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={refreshTree}
            disabled={loadingTree}
            className="flex items-center justify-center w-6 h-6 rounded text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Refresh file tree"
            title="Refresh file tree"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 ${loadingTree ? "animate-spin" : ""}`}>
              <path d="M13.65 2.35a1 1 0 0 0-1.3 0L11 3.7A5.99 5.99 0 0 0 2 8a1 1 0 1 0 2 0 4 4 0 0 1 6.29-3.29L8.65 6.35a1 1 0 0 0 .7 1.7H13a1 1 0 0 0 1-1V3.4a1 1 0 0 0-.35-.7z M14 8a1 1 0 1 0-2 0 4 4 0 0 1-6.29 3.29l1.64-1.64a1 1 0 0 0-.7-1.7H3.05a1 1 0 0 0-1 1v3.65a1 1 0 0 0 1.7.7L5 11.7A5.99 5.99 0 0 0 14 8z" />
            </svg>
          </button>
        </div>
      </div>
      {searchActive && (
        <div className="shrink-0 border-b border-cc-border">
          {/* Mode tabs */}
          <div className="flex border-b border-cc-border">
            <button
              type="button"
              onClick={() => { setSearchMode("files"); setSearchQuery(""); }}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
                searchMode === "files" ? "text-cc-fg border-b-2 border-cc-primary" : "text-cc-muted hover:text-cc-fg"
              }`}
            >
              Files
            </button>
            <button
              type="button"
              onClick={() => { setSearchMode("content"); setSearchQuery(""); }}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
                searchMode === "content" ? "text-cc-fg border-b-2 border-cc-primary" : "text-cc-muted hover:text-cc-fg"
              }`}
            >
              In Files
            </button>
          </div>
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchMode === "files" ? "Search files..." : "Search in files..."}
                aria-label={searchMode === "files" ? "Search files" : "Search in files"}
                className="flex-1 min-w-0 px-2 py-1 text-xs rounded bg-cc-bg border border-cc-border text-cc-fg placeholder:text-cc-muted focus:outline-none focus:border-cc-primary"
              />
              {searchMode === "content" && (
                <>
                  <button
                    type="button"
                    onClick={() => setCaseSensitive((v) => !v)}
                    className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      caseSensitive ? "bg-cc-primary text-white" : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
                    }`}
                    title="Match case"
                    aria-label="Toggle case sensitivity"
                  >
                    Aa
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseRegex((v) => !v)}
                    className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      useRegex ? "bg-cc-primary text-white" : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
                    }`}
                    title="Use regex"
                    aria-label="Toggle regex"
                  >
                    .*
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="max-h-[400px] overflow-auto p-1">
            {/* File search results */}
            {searchMode === "files" && (
              <>
                {searchResults.length === 0 && searchQuery.trim() && (
                  <div className="px-2 py-2 text-xs text-cc-muted">No files found.</div>
                )}
                {searchResults.map((item, i) => {
                  const sColor = gitStatusColor(gitStatus.get(item.path));
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => selectSearchResult(item.path)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded truncate cursor-pointer ${
                        i === searchSelectedIndex
                          ? "bg-cc-active text-cc-fg"
                          : sColor || "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
                      }`}
                      title={item.relPath}
                    >
                      {item.relPath}
                    </button>
                  );
                })}
              </>
            )}
            {/* Content search results */}
            {searchMode === "content" && (
              <>
                {grepLoading && (
                  <div className="px-2 py-2 text-xs text-cc-muted flex items-center gap-2">
                    <span className="w-3 h-3 border border-cc-muted border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </div>
                )}
                {!grepLoading && grepResults.length === 0 && searchQuery.trim() && (
                  <div className="px-2 py-2 text-xs text-cc-muted">No matches found.</div>
                )}
                {!grepLoading && (() => {
                  let flatIdx = 0;
                  return [...grepGrouped.entries()].map(([filePath, lines]) => (
                    <div key={filePath} className="mb-1">
                      <div
                        className="px-2 py-1 text-[10px] font-medium text-cc-fg truncate cursor-pointer hover:bg-cc-hover rounded"
                        title={cwd ? relPath(cwd, filePath) : filePath}
                        onClick={() => selectSearchResult(filePath)}
                      >
                        {cwd ? relPath(cwd, filePath) : filePath}
                      </div>
                      {lines.map((match) => {
                        const idx = flatIdx++;
                        return (
                          <button
                            key={`${filePath}:${match.line}`}
                            type="button"
                            onClick={() => selectSearchResult(filePath)}
                            className={`w-full text-left pl-4 pr-2 py-1 text-[11px] font-mono-code rounded truncate cursor-pointer ${
                              idx === searchSelectedIndex
                                ? "bg-cc-active text-cc-fg"
                                : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
                            }`}
                          >
                            <span className="text-cc-muted/60 mr-2">{match.line}</span>
                            {match.text.trim()}
                          </button>
                        );
                      })}
                    </div>
                  ));
                })()}
                {grepTruncated && (
                  <div className="px-2 py-1.5 text-[10px] text-cc-warning">Results truncated — refine your search.</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {!searchActive && (
        <div className="flex-1 min-h-0 overflow-auto p-1.5">
          {loadingTree && <div className="px-2 py-2 text-xs text-cc-muted">Loading files...</div>}
          {!loadingTree && tree.length === 0 && !error && (
            <div className="px-2 py-2 text-xs text-cc-muted">No editable files found.</div>
          )}
          {!loadingTree && error && !selectedPath && (
            <div className="m-2 px-3 py-2 rounded-lg bg-cc-error/10 border border-cc-error/30 text-xs text-cc-error">
              {error}
            </div>
          )}
          {!loadingTree && tree.map((node) => (
            <TreeEntry
              key={node.path}
              node={node}
              depth={0}
              cwd={cwd}
              selectedPath={selectedPath}
              onSelect={handleSelectFile}
              gitStatus={gitStatus}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ── Editor / image viewer panel ──
  const editorPanel = selectedPath ? (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-3 py-2 border-b border-cc-border bg-cc-sidebar flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Back button — mobile only */}
          <button
            type="button"
            onClick={handleBack}
            className="sm:hidden flex items-center justify-center w-8 h-8 rounded text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer shrink-0"
            aria-label="Back to file tree"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-cc-muted truncate">{relPath(cwd, selectedPath)}</p>
              {/* LOCAL: file size indicator */}
              {fileSize !== null && (
                <span className="text-[10px] text-cc-muted/60 shrink-0">{formatBytes(fileSize)}</span>
              )}
            </div>
            {dirty && <p className="text-[10px] text-amber-500">Unsaved changes</p>}
            {saved && <p className="text-[10px] text-cc-success">Saved</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Save button — hidden for images (read-only) */}
          {!isImage && (
            <button
              type="button"
              onClick={saveCurrentFile}
              disabled={!selectedPath || saving || loadingFile || !dirty}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
                !selectedPath || saving || loadingFile || !dirty
                  ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                  : "bg-cc-primary text-white hover:bg-cc-primary-hover cursor-pointer"
              }`}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          {/* LOCAL: close file button */}
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
        </div>
      </div>

      {error && (
        <div className="m-3 px-3 py-2 rounded-lg bg-cc-error/10 border border-cc-error/30 text-xs text-cc-error">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0">
        {/* LOCAL: large file warning gate */}
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
        ) : imageUrl ? (
          <div className="h-full flex items-center justify-center p-4 bg-cc-bg overflow-auto">
            <img
              src={imageUrl}
              alt={relPath(cwd, selectedPath)}
              className="max-w-full max-h-full object-contain rounded"
            />
          </div>
        ) : (
          <CodeMirror
            value={content}
            onChange={(value: string) => setContent(value)}
            extensions={extensions}
            theme={darkMode ? "dark" : "light"}
            basicSetup={{
              foldGutter: true,
              dropCursor: false,
              allowMultipleSelections: false,
            }}
            className="h-full text-sm"
            height="100%"
          />
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="h-full min-h-0 flex bg-cc-bg">
      {/* Desktop: side-by-side */}
      <aside className="hidden sm:flex w-[240px] shrink-0 border-r border-cc-border bg-cc-sidebar/60 flex-col min-h-0">
        {treePanel}
      </aside>
      <div className="hidden sm:flex flex-1 min-h-0 flex-col">
        {editorPanel || (
          <div className="h-full flex items-center justify-center text-sm text-cc-muted">
            Select a file to start editing.
          </div>
        )}
      </div>

      {/* Mobile: master/detail */}
      <div className="flex sm:hidden flex-1 min-h-0 flex-col">
        {selectedPath ? editorPanel : treePanel}
      </div>
    </div>
  );
}
