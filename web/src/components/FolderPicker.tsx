import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { api, type DirEntry } from "../api.js";
import { useStore } from "../store.js";
import { getRecentDirs, addRecentDir } from "../utils/recent-dirs.js";

interface FolderPickerProps {
  initialPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FolderPicker({ initialPath, onSelect, onClose }: FolderPickerProps) {
  const [browsePath, setBrowsePath] = useState("");
  const [browseDirs, setBrowseDirs] = useState<DirEntry[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [dirInput, setDirInput] = useState("");
  const [showDirInput, setShowDirInput] = useState(false);
  const [recentDirs] = useState<string[]>(() => getRecentDirs());
  const sdkSessions = useStore((s) => s.sdkSessions);

  // Autocomplete state
  const [claudeProjects, setClaudeProjects] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch .claude project folders once on mount
  useEffect(() => {
    api.getRecentProjects().then((r) => setClaudeProjects(r.projects)).catch(() => {});
  }, []);

  const sessionDirs = useMemo(() => {
    const recentSet = new Set(recentDirs);
    const seen = new Set<string>();
    return sdkSessions
      .filter((s) => s.cwd && !recentSet.has(s.cwd) && !seen.has(s.cwd) && seen.add(s.cwd))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => s.cwd);
  }, [sdkSessions, recentDirs]);

  // Claude projects not already shown in recent/sessions
  const filteredClaudeProjects = useMemo(() => {
    const shown = new Set([...recentDirs, ...sessionDirs]);
    return claudeProjects.filter((p) => !shown.has(p));
  }, [claudeProjects, recentDirs, sessionDirs]);

  const loadDirs = useCallback(async (path?: string) => {
    setBrowseLoading(true);
    try {
      const result = await api.listDirs(path);
      setBrowsePath(result.path);
      setBrowseDirs(result.dirs);
    } catch {
      setBrowseDirs([]);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirs(initialPath || undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape to close (unless in manual input mode)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !showDirInput) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showDirInput]);

  // Compute autocomplete suggestions when dirInput changes
  useEffect(() => {
    if (!showDirInput || !dirInput.trim()) {
      setSuggestions([]);
      setSelectedIdx(-1);
      return;
    }

    const query = dirInput.trim().toLowerCase();

    // Match against claude projects (fuzzy: match on folder name or full path)
    const projectMatches = claudeProjects.filter((p) => {
      const name = p.split("/").pop()?.toLowerCase() || "";
      return p.toLowerCase().includes(query) || name.includes(query);
    });

    // Also fetch filesystem completions for typed path (debounced)
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const all = new Set(projectMatches);

      if (dirInput.startsWith("/")) {
        try {
          const parentDir = dirInput.includes("/")
            ? dirInput.replace(/\/[^/]*$/, "") || "/"
            : "/";
          const result = await api.listDirs(parentDir);
          const typed = dirInput.toLowerCase();
          for (const d of result.dirs) {
            if (d.path.toLowerCase().startsWith(typed)) all.add(d.path);
          }
        } catch { /* ignore */ }
      }

      const merged = [...all].slice(0, 10);
      setSuggestions(merged);
      setSelectedIdx(-1);
    }, 150);

    // Show project matches immediately (no debounce)
    setSuggestions(projectMatches.slice(0, 10));
    setSelectedIdx(-1);

    return () => clearTimeout(debounceRef.current);
  }, [dirInput, showDirInput, claudeProjects]);

  function selectDir(path: string) {
    addRecentDir(path);
    onSelect(path);
    onClose();
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Tab" && suggestions.length > 0) {
        e.preventDefault();
        const pick = selectedIdx >= 0 ? suggestions[selectedIdx] : suggestions[0];
        setDirInput(pick);
        setSuggestions([]);
        return;
      }
    }
    if (e.key === "Enter" && dirInput.trim()) {
      if (selectedIdx >= 0 && suggestions[selectedIdx]) {
        selectDir(suggestions[selectedIdx]);
      } else {
        selectDir(dirInput.trim());
      }
    }
    if (e.key === "Escape") {
      if (suggestions.length > 0) {
        e.stopPropagation();
        setSuggestions([]);
      } else {
        e.stopPropagation();
        setShowDirInput(false);
      }
    }
  }

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedIdx >= 0 && suggestionsRef.current) {
      const el = suggestionsRef.current.children[selectedIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg h-[min(480px,90dvh)] mx-0 sm:mx-4 flex flex-col bg-cc-bg border border-cc-border rounded-t-[14px] sm:rounded-[14px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-cc-border shrink-0">
          <h2 className="text-sm font-semibold text-cc-fg">Select Folder</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Recent directories + session folders + Claude projects */}
        {(recentDirs.length > 0 || sessionDirs.length > 0 || filteredClaudeProjects.length > 0) && (
          <div className="border-b border-cc-border shrink-0 max-h-[200px] overflow-y-auto">
            {recentDirs.length > 0 && (
              <>
                <div className="px-4 pt-2.5 pb-1 text-[10px] text-cc-muted uppercase tracking-wider">Recent</div>
                {recentDirs.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => selectDir(dir)}
                    className="w-full px-4 py-2 sm:py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-fg"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-30 shrink-0">
                      <path d="M8 3.5a.5.5 0 00-1 0V8a.5.5 0 00.252.434l3.5 2a.5.5 0 00.496-.868L8 7.71V3.5z" />
                      <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z" />
                    </svg>
                    <span className="font-medium truncate">{dir.split("/").pop() || dir}</span>
                    <span className="text-cc-muted font-mono-code text-[10px] truncate ml-auto">{dir}</span>
                  </button>
                ))}
              </>
            )}
            {sessionDirs.length > 0 && (
              <>
                <div className="px-4 pt-2.5 pb-1 text-[10px] text-cc-muted uppercase tracking-wider">Sessions</div>
                {sessionDirs.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => selectDir(dir)}
                    className="w-full px-4 py-2 sm:py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-fg"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-30 shrink-0">
                      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                    </svg>
                    <span className="font-medium truncate">{dir.split("/").pop() || dir}</span>
                    <span className="text-cc-muted font-mono-code text-[10px] truncate ml-auto">{dir}</span>
                  </button>
                ))}
              </>
            )}
            {filteredClaudeProjects.length > 0 && (
              <>
                <div className="px-4 pt-2.5 pb-1 text-[10px] text-cc-muted uppercase tracking-wider">Projects</div>
                {filteredClaudeProjects.slice(0, 10).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => selectDir(dir)}
                    className="w-full px-4 py-2 sm:py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-fg"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-30 shrink-0">
                      <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9z" />
                    </svg>
                    <span className="font-medium truncate">{dir.split("/").pop() || dir}</span>
                    <span className="text-cc-muted font-mono-code text-[10px] truncate ml-auto">{dir}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Path bar with autocomplete */}
        <div className="relative px-4 py-2.5 border-b border-cc-border flex items-center gap-2 shrink-0">
          {showDirInput ? (
            <div className="relative flex-1">
              <input
                type="text"
                value={dirInput}
                onChange={(e) => setDirInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setSuggestions([]), 200);
                }}
                placeholder="/path/to/project"
                className="w-full px-2 py-1 text-base sm:text-xs bg-cc-input-bg border border-cc-border rounded-md text-cc-fg font-mono-code placeholder:text-cc-muted focus:outline-none focus:border-cc-primary/50"
                autoFocus
              />
              {suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute left-0 right-0 top-full mt-1 z-50 max-h-[200px] overflow-y-auto bg-cc-bg border border-cc-border rounded-md shadow-lg"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={s}
                      onMouseDown={(e) => { e.preventDefault(); selectDir(s); }}
                      className={`w-full px-3 py-1.5 text-xs text-left cursor-pointer flex items-center gap-2 font-mono-code transition-colors ${
                        i === selectedIdx ? "bg-cc-primary/15 text-cc-primary" : "text-cc-fg hover:bg-cc-hover"
                      }`}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40 shrink-0">
                        <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                      </svg>
                      <span className="truncate">{s}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Go up button */}
              {browsePath && browsePath !== "/" && (
                <button
                  onClick={() => {
                    const parent = browsePath.split("/").slice(0, -1).join("/") || "/";
                    loadDirs(parent);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer shrink-0"
                  title="Go to parent directory"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path d="M8 12l-4-4h2.5V4h3v4H12L8 12z" transform="rotate(180 8 8)" />
                  </svg>
                </button>
              )}
              <span className="text-[11px] text-cc-muted font-mono-code truncate flex-1">{browsePath}</span>
              <button
                onClick={() => { setShowDirInput(true); setDirInput(browsePath); }}
                className="w-6 h-6 flex items-center justify-center rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer shrink-0"
                title="Type path manually"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.463 11.098a.25.25 0 00-.064.108l-.563 1.97 1.971-.564a.25.25 0 00.108-.064l8.61-8.61a.25.25 0 000-.354l-1.098-1.097z" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Directory browser */}
        {!showDirInput && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Select current directory */}
            <button
              onClick={() => selectDir(browsePath)}
              className="w-full px-4 py-2 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-primary font-medium border-b border-cc-border shrink-0"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
                <path d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" />
              </svg>
              <span className="truncate font-mono-code">Select: {browsePath.split("/").pop() || "/"}</span>
            </button>

            {/* Subdirectories */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {browseLoading ? (
                <div className="px-4 py-6 text-xs text-cc-muted text-center">Loading...</div>
              ) : browseDirs.length === 0 ? (
                <div className="px-4 py-6 text-xs text-cc-muted text-center">No subdirectories</div>
              ) : (
                browseDirs.map((d) => (
                  <div
                    key={d.path}
                    className="flex items-center hover:bg-cc-hover transition-colors"
                  >
                    <button
                      onClick={() => loadDirs(d.path)}
                      onDoubleClick={() => selectDir(d.path)}
                      className="flex-1 min-w-0 px-4 py-2 sm:py-1.5 text-xs text-left cursor-pointer font-mono-code flex items-center gap-2 text-cc-fg"
                      title={d.path}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40 shrink-0">
                        <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                      </svg>
                      <span className="truncate">{d.name}</span>
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-30 shrink-0 ml-auto">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => selectDir(d.path)}
                      className="shrink-0 w-8 h-8 sm:w-6 sm:h-6 mr-2 flex items-center justify-center rounded-md text-cc-muted hover:text-cc-primary hover:bg-cc-primary/10 transition-colors cursor-pointer"
                      title={`Select ${d.name}`}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                        <path d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
