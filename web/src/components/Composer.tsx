import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useStore } from "../store.js";
import { sendToSession, connectSession } from "../ws.js";
import { CLAUDE_MODES, CODEX_MODES } from "../utils/backends.js";
import { api, createSessionStream, type SavedPrompt } from "../api.js";
import type { ModeOption } from "../utils/backends.js";
import { ModelSwitcher } from "./ModelSwitcher.js";

import { navigateToSession } from "../utils/routing.js";
import { generateUniqueSessionName } from "../utils/names.js";
import { MentionMenu } from "./MentionMenu.js";
import { useMentionMenu } from "../utils/use-mention-menu.js";


import { readFileAsBase64, type ImageAttachment } from "../utils/image.js";
import { scanContent } from "../utils/result-scanner.js";

// LOCAL: slugify for panel names
function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}

// LOCAL: Web Speech API types (not in all TS DOM libs)
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

const SpeechRecognitionAPI: SpeechRecognitionConstructor | undefined =
  typeof window !== "undefined"
    ? ((window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition)
    : undefined;


let idCounter = 0;

interface CommandItem {
  name: string;
  type: "command" | "skill";
}


function formatImagesForAPI(imgs: ImageAttachment[]) {
  return imgs.map((img) => ({ media_type: img.mediaType, data: img.base64 }));
}

function handleMenuKeyDown<T>(
  e: React.KeyboardEvent,
  items: T[],
  selectedIndex: number,
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>,
  onSelect: (item: T) => void,
  onClose: () => void,
): boolean {
  if (items.length > 0) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % items.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + items.length) % items.length);
      return true;
    }
    if ((e.key === "Tab" && !e.shiftKey) || (e.key === "Enter" && !e.shiftKey)) {
      e.preventDefault();
      onSelect(items[selectedIndex]);
      return true;
    }
  }
  if (e.key === "Escape") {
    e.preventDefault();
    onClose();
    return true;
  }
  return false;
}



const DRAFT_KEY_PREFIX = "composer-draft:";

export function Composer({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState(() => sessionStorage.getItem(`${DRAFT_KEY_PREFIX}${sessionId}`) || "");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [savePromptName, setSavePromptName] = useState("");
  const [savePromptScope, setSavePromptScope] = useState<"global" | "project">("global");
  const [savePromptError, setSavePromptError] = useState<string | null>(null);
  const [caretPos, setCaretPos] = useState(0);
  const [isListening, setIsListening] = useState(false);
  // LOCAL: AI-powered input completion suggestion
  const [completionSuggestion, setCompletionSuggestion] = useState<string | null>(null);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionAbortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionData = useStore((s) => s.sessions.get(sessionId));
  const previousMode = useStore((s) => s.previousPermissionMode.get(sessionId) || "bypassPermissions");
  const isRunning = useStore((s) => s.sessionStatus.get(sessionId) === "running");

  const isConnected = cliConnected.get(sessionId) ?? false;
  const currentMode = sessionData?.permissionMode || "bypassPermissions";
  const isPlan = currentMode === "plan";
  const isCodex = sessionData?.backend_type === "codex";
  const modes: ModeOption[] = isCodex ? CODEX_MODES : CLAUDE_MODES;
  const modeLabel = modes.find((m) => m.value === currentMode)?.label?.toLowerCase() || currentMode;
  // LOCAL: SDK session info needed for fork (cliSessionId) — only claude has fork support
  const sdkSession = useStore((s) => s.sdkSessions.find((sdk) => sdk.sessionId === sessionId));
  const [isForking, setIsForking] = useState(false);
  const canFork = !isCodex && !!sdkSession?.cliSessionId && !isRunning && !isForking;

  // Persist draft input to sessionStorage so it survives HMR / server restarts
  useEffect(() => {
    const key = `${DRAFT_KEY_PREFIX}${sessionId}`;
    if (text) sessionStorage.setItem(key, text);
    else sessionStorage.removeItem(key);
  }, [text, sessionId]);

  // LOCAL: Fork current session — creates a new independent session seeded with this conversation's history
  const handleFork = useCallback(async () => {
    if (!canFork || !sdkSession?.cliSessionId) return;
    setIsForking(true);
    try {
      const result = await createSessionStream(
        {
          resumeSessionAt: sdkSession.cliSessionId,
          forkSession: true,
          cwd: sdkSession.cwd,
          model: sdkSession.model,
          permissionMode: sdkSession.permissionMode,
        },
        (progress) => useStore.getState().addCreationProgress(progress),
      );
      const store = useStore.getState();
      store.setSdkSessions([
        ...store.sdkSessions.filter((s) => s.sessionId !== result.sessionId),
        {
          sessionId: result.sessionId,
          state: result.state as "starting" | "connected" | "running" | "exited",
          cwd: result.cwd,
          createdAt: Date.now(),
          backendType: (result.backendType as "claude" | "codex" | undefined) || "claude",
          model: sdkSession.model,
          permissionMode: sdkSession.permissionMode,
          resumeSessionAt: sdkSession.cliSessionId,
          forkSession: true,
        },
      ]);
      // Copy original session name/title with a fork suffix so it passes the sidebar's validSessions filter
      const originalName = store.sessionNames.get(sessionId) || sdkSession.title || generateUniqueSessionName(new Set(store.sessionNames.values()));
      const forkName = `${originalName} (fork)`;
      store.setSessionName(result.sessionId, forkName);
      // Sync to server so the auto-namer knows a name already exists and won't overwrite it
      api.renameSession(result.sessionId, forkName).catch(() => {});
      navigateToSession(result.sessionId, true);
      connectSession(result.sessionId);
    } catch (err) {
      console.error("Fork failed", err);
    } finally {
      setIsForking(false);
    }
  }, [canFork, sdkSession]);

  // LOCAL: On iOS/iPadOS the first tap focuses; require double-tap to accept ghost completion.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // LOCAL: Accept the current completion suggestion into the text
  const acceptCompletion = useCallback(() => {
    if (!completionSuggestion) return;
    setText((prev) => {
      const needsLeading = prev.length > 0 && !prev.endsWith(" ") && !completionSuggestion.startsWith(" ");
      const needsTrailing = !completionSuggestion.endsWith(" ");
      return (needsLeading ? prev + " " : prev) + completionSuggestion + (needsTrailing ? " " : "");
    });
    setCompletionSuggestion(null);
    textareaRef.current?.focus();
  }, [completionSuggestion]);

  // LOCAL: Fetch a completion suggestion, debounced.
  // Only runs when the agent is idle (not running/thinking).
  const scheduleCompletion = useCallback((partial: string, menusOpen: boolean, agentRunning: boolean) => {
    if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    completionAbortRef.current?.abort();
    setCompletionSuggestion(null);
    if (menusOpen || agentRunning) return;
    completionTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      completionAbortRef.current = controller;
      const result = await api.completeInput(sessionId, partial, controller.signal);
      if (!controller.signal.aborted) setCompletionSuggestion(result.suggestion);
    }, 500);
  }, [sessionId]);

  // LOCAL: Cleanup completion on unmount
  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
      completionAbortRef.current?.abort();
    };
  }, []);

  const mention = useMentionMenu({
    text,
    caretPos,
    cwd: sessionData?.cwd,
    enabled: !slashMenuOpen,
  });

  // LOCAL: Trigger completion whenever text, menu state, or agent status changes.
  // Also immediately clears any stale suggestion when the agent starts running.
  useEffect(() => {
    if (isRunning) {
      setCompletionSuggestion(null);
      completionAbortRef.current?.abort();
      if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
      return;
    }
    scheduleCompletion(text, slashMenuOpen || mention.mentionMenuOpen, false);
  }, [text, slashMenuOpen, mention.mentionMenuOpen, isRunning, scheduleCompletion]);


  const allCommands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [];
    if (sessionData?.slash_commands) {
      for (const cmd of sessionData.slash_commands) {
        cmds.push({ name: cmd, type: "command" });
      }
    }
    if (sessionData?.skills) {
      for (const skill of sessionData.skills) {
        cmds.push({ name: skill, type: "skill" });
      }
    }
    return cmds;
  }, [sessionData?.slash_commands, sessionData?.skills]);

  const filteredCommands = useMemo(() => {
    if (!slashMenuOpen) return [];
    const match = text.match(/^\/(\S*)$/);
    if (!match) return [];
    const query = match[1].toLowerCase();
    if (query === "") return allCommands;
    return allCommands.filter((cmd) => cmd.name.toLowerCase().includes(query));
  }, [text, slashMenuOpen, allCommands]);

  // Open/close slash menu based on text
  useEffect(() => {
    const shouldOpen = text.startsWith("/") && /^\/\S*$/.test(text) && allCommands.length > 0;
    if (shouldOpen && !slashMenuOpen) {
      setSlashMenuOpen(true);
      setSlashMenuIndex(0);
    } else if (!shouldOpen && slashMenuOpen) {
      setSlashMenuOpen(false);
    }
  }, [text, allCommands.length, slashMenuOpen]);


  const [pendingAutoSend, setPendingAutoSend] = useState(false);
  useEffect(() => {
    if (pendingAutoSend && text.trim() && isConnected) {
      setPendingAutoSend(false);
      handleSend();
    }
  }, [pendingAutoSend, text, isConnected]);

  // Receive speech input injected from native iOS app via WKWebView.evaluateJavaScript
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string; autoSend?: boolean }>).detail;
      if (!detail?.text) return;
      (window as unknown as Record<string, unknown>).__speechInputReceived = true;
      setText((prev) => (prev ? prev + " " + detail.text : detail.text));
      textareaRef.current?.focus();
      if (detail.autoSend) setPendingAutoSend(true);
    };
    window.addEventListener("speech-input", handler);
    return () => window.removeEventListener("speech-input", handler);
  }, []);

  // Clear composer input when native app fires `clear-input` event.
  useEffect(() => {
    const handler = () => setText("");
    window.addEventListener("clear-input", handler);
    return () => window.removeEventListener("clear-input", handler);
  }, []);

  // Keep slash menu selected index in bounds

  useEffect(() => {
    if (slashMenuIndex >= filteredCommands.length) {
      setSlashMenuIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, slashMenuIndex]);

  // Scroll slash menu selected item into view
  useEffect(() => {
    if (!menuRef.current || !slashMenuOpen) return;
    const items = menuRef.current.querySelectorAll("[data-cmd-index]");
    const selected = items[slashMenuIndex];
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [slashMenuIndex, slashMenuOpen]);

  useEffect(() => {
    if (pendingSelectionRef.current === null || !textareaRef.current) return;
    const next = pendingSelectionRef.current;
    textareaRef.current.setSelectionRange(next, next);
    pendingSelectionRef.current = null;
  }, [text]);

  const selectCommand = useCallback((cmd: CommandItem) => {
    setText(`/${cmd.name} `);
    setSlashMenuOpen(false);
    textareaRef.current?.focus();
  }, []);

  const selectPrompt = useCallback((prompt: SavedPrompt) => {
    const result = mention.selectPrompt(prompt);
    pendingSelectionRef.current = result.nextCursor;
    setText(result.nextText);
    mention.setMentionMenuOpen(false);
    setCaretPos(result.nextCursor);
    textareaRef.current?.focus();
    // Auto-resize textarea after prompt insertion
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [mention]);

  function autoCorrectSlashCommand(input: string): string {
    const match = input.match(/^\/(\S+)([\s\S]*)$/);
    if (!match) return input;
    const typed = match[1];
    const rest = match[2];
    const canonical = allCommands.find((c) => c.name.toLowerCase() === typed.toLowerCase());
    return canonical ? `/${canonical.name}${rest}` : input;
  }

  function handleSend() {
    if (isListening) recognitionRef.current?.stop();
    const msg = autoCorrectSlashCommand(text.trim());
    if (!msg || !isConnected) return;

    const store = useStore.getState();
    const msgId = `user-${Date.now()}-${++idCounter}`;

    sendToSession(sessionId, {
      type: "user_message",
      content: msg,
      session_id: sessionId,
      images: images.length > 0 ? formatImagesForAPI(images) : undefined,
      id: msgId,
    });
    const scanned = scanContent(msg);
    const scannedHtml = scanned.html.length > 0
      ? scanned.html.map((h, i) => ({ ...h, fragmentId: `${msgId}:${i}` }))
      : undefined;
    const scannedHtmlFiles = scanned.htmlFiles.length > 0
      ? scanned.htmlFiles.map((f) => ({ path: f.path, filename: f.filename, url: `/api/fs/html?path=${encodeURIComponent(f.path)}` }))
      : undefined;
    const imageData = images.length > 0 ? formatImagesForAPI(images) : undefined;

    store.appendMessage(sessionId, {
      id: msgId, role: "user", content: msg, images: imageData, scannedHtml, scannedHtmlFiles, timestamp: Date.now(),
    });

    store.setSessionStatus(sessionId, "running");
    store.setStreamingStats(sessionId, { startedAt: Date.now() });

    setText("");
    setImages([]);
    setSlashMenuOpen(false);

    mention.setMentionMenuOpen(false);
    setCompletionSuggestion(null);


    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (slashMenuOpen) {
      const handled = handleMenuKeyDown(
        e, filteredCommands, slashMenuIndex, setSlashMenuIndex,
        selectCommand, () => setSlashMenuOpen(false),
      );
      if (handled) return;
    }

    if (mention.mentionMenuOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        mention.setMentionMenuOpen(false);
        return;
      }
    }


    if (mention.mentionMenuOpen && mention.filteredPrompts.length > 0) {

      if (e.key === "ArrowDown") {
        e.preventDefault();
        mention.setMentionMenuIndex((i) => (i + 1) % mention.filteredPrompts.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        mention.setMentionMenuIndex((i) => (i - 1 + mention.filteredPrompts.length) % mention.filteredPrompts.length);
        return;
      }
      if ((e.key === "Tab" && !e.shiftKey) || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        selectPrompt(mention.filteredPrompts[mention.mentionMenuIndex]);
        return;
      }
    }

    // LOCAL: Tab (no shift) accepts completion suggestion when no menu is open
    if (e.key === "Tab" && !e.shiftKey && completionSuggestion && !mention.mentionMenuOpen) {
      e.preventDefault();
      acceptCompletion();
      return;
    }

    if (
      mention.mentionMenuOpen
      && mention.filteredPrompts.length === 0
      && ((e.key === "Enter" && !e.shiftKey) || (e.key === "Tab" && !e.shiftKey))
    ) {
      e.preventDefault();
      acceptCompletion();
      return;
    }

    // LOCAL: Escape or Ctrl/Cmd+Z dismisses completion suggestion
    if (e.key === "Escape" && completionSuggestion) {
      e.preventDefault();
      setCompletionSuggestion(null);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && completionSuggestion) {
      setCompletionSuggestion(null);
    }

    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      toggleMode();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setCaretPos(e.target.selectionStart ?? e.target.value.length);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, []);

  const syncCaret = useCallback(() => {
    if (!textareaRef.current) return;
    setCaretPos(textareaRef.current.selectionStart ?? 0);
  }, []);

  const handleInterrupt = useCallback(() => {
    sendToSession(sessionId, { type: "interrupt" });
  }, [sessionId]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newImages: ImageAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const { base64, mediaType } = await readFileAsBase64(file);
      newImages.push({ name: file.name, base64, mediaType });
    }
    setImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const newImages: ImageAttachment[] = [];
    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      const { base64, mediaType } = await readFileAsBase64(file);
      newImages.push({ name: `pasted-${Date.now()}.${file.type.split("/")[1]}`, base64, mediaType });
    }
    if (newImages.length > 0) {
      e.preventDefault();
      setImages((prev) => [...prev, ...newImages]);
    }
  }

  function toggleMode() {
    if (!isConnected) return;
    const store = useStore.getState();

    const modeOrder = modes.map((m) => m.value);
    const currentIndex = modeOrder.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modeOrder.length;
    const nextMode = modeOrder[nextIndex];

    sendToSession(sessionId, { type: "set_permission_mode", mode: nextMode });
    store.updateSession(sessionId, { permissionMode: nextMode });
  }

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    if (!SpeechRecognitionAPI) {
      // Fallback: focus textarea so the OS keyboard appears (with its built-in mic)
      textareaRef.current?.focus();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    baseTextRef.current = text;
    finalTranscriptRef.current = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript;
        } else {
          interim += transcript;
        }
      }
      const base = baseTextRef.current;
      const sep = base && !base.endsWith(" ") ? " " : "";
      setText(base + sep + finalTranscriptRef.current + interim);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  useEffect(() => {
    if (!isListening || !textareaRef.current) return;
    const ta = textareaRef.current;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text, isListening]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  // Global Shift+Tab listener so mode toggle works even when textarea is not focused
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab" && e.shiftKey && document.activeElement !== textareaRef.current) {
        e.preventDefault();
        toggleMode();
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  });

  async function handleCreatePrompt() {
    const content = text.trim();
    const name = savePromptName.trim();
    if (!content || !name) return;
    if (savePromptScope === "project" && !sessionData?.cwd) {
      setSavePromptError("No project folder available for this session");
      return;
    }
    try {

      await api.createPrompt({
        name,
        content,
        scope: savePromptScope,
        ...(savePromptScope === "project" && sessionData?.cwd ? { projectPaths: [sessionData.cwd] } : {}),
      });
      await mention.refreshPrompts();

      setSavePromptOpen(false);
      setSavePromptName("");
      setSavePromptScope("global");
      setSavePromptError(null);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Could not save prompt.";
      setSavePromptError(message);
    }
  }


  const canSend = text.trim().length > 0 && isConnected;

  return (
    <div className="shrink-0 px-0 sm:px-6 pt-0 sm:pt-3 pb-5 sm:pb-4 bg-cc-input-bg sm:bg-transparent">
      <div className="max-w-3xl mx-auto">
        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="flex items-center gap-2 mb-2 px-3 sm:px-0 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={`data:${img.mediaType};base64,${img.base64}`}
                  alt={img.name}
                  className="w-12 h-12 rounded-lg object-cover border border-cc-border"
                />
                <button
                  onClick={() => removeImage(i)}
                  aria-label="Remove image"
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-cc-error text-white flex items-center justify-center text-[10px] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Attach images"
        />

        {/* Input container: flat separator on mobile, card on desktop */}
        <div className={`relative overflow-visible transition-colors border-t border-cc-separator sm:border sm:border-cc-border sm:bg-cc-input-bg/95 sm:rounded-[14px] sm:shadow-[0_10px_30px_rgba(0,0,0,0.10)] sm:backdrop-blur-sm ${
          isPlan
            ? "sm:border-cc-primary/40"
            : "sm:focus-within:border-cc-primary/30"
        }`}>
          {/* Slash command menu */}
          {slashMenuOpen && filteredCommands.length > 0 && (
            <div
              ref={menuRef}
              className="absolute left-2 right-2 bottom-full mb-1 max-h-[240px] overflow-y-auto bg-cc-card border border-cc-border rounded-[10px] shadow-lg z-20 py-1"
            >
              {filteredCommands.map((cmd, i) => (
                <button
                  key={`${cmd.type}-${cmd.name}`}
                  data-cmd-index={i}
                  onClick={() => selectCommand(cmd)}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                    i === slashMenuIndex
                      ? "bg-cc-hover"
                      : "hover:bg-cc-hover/50"
                  }`}
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-cc-hover text-cc-muted shrink-0">
                    {cmd.type === "skill" ? (
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M8 1l1.796 3.64L14 5.255l-3 2.924.708 4.126L8 10.5l-3.708 1.805L5 8.18 2 5.255l4.204-.615L8 1z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                        <path d="M5 12L10 4" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-cc-fg">/{cmd.name}</span>
                    <span className="ml-2 text-[11px] text-cc-muted">{cmd.type}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* @ prompt menu */}
          <MentionMenu
            open={mention.mentionMenuOpen}
            loading={mention.promptsLoading}
            prompts={mention.filteredPrompts}
            selectedIndex={mention.mentionMenuIndex}
            onSelect={selectPrompt}
            menuRef={mention.mentionMenuRef}
            className="absolute left-2 right-2 bottom-full mb-1"
          />

          {savePromptOpen && (
            <div className="absolute left-2 right-2 bottom-full mb-1 bg-cc-card border border-cc-border rounded-[10px] shadow-lg z-20 p-3 space-y-2">
              <div className="text-xs font-semibold text-cc-fg">Save prompt</div>
              <input
                value={savePromptName}
                onChange={(e) => {
                  setSavePromptName(e.target.value);
                  if (savePromptError) setSavePromptError(null);
                }}
                placeholder="Prompt title"
                aria-label="Prompt title"
                className="w-full px-2 py-1.5 text-sm bg-cc-input-bg border border-cc-border rounded-md text-cc-fg focus:outline-none focus:border-cc-primary/40"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={savePromptScope === "global"}
                  onClick={() => setSavePromptScope("global")}
                  className={`px-2 py-0.5 text-[11px] rounded border transition-colors cursor-pointer ${
                    savePromptScope === "global"
                      ? "border-cc-primary/40 text-cc-primary bg-cc-primary/8"
                      : "border-cc-border text-cc-muted hover:text-cc-fg"
                  }`}
                >
                  Global
                </button>
                <button
                  type="button"
                  aria-pressed={savePromptScope === "project"}
                  onClick={() => setSavePromptScope("project")}
                  className={`px-2 py-0.5 text-[11px] rounded border transition-colors cursor-pointer ${
                    savePromptScope === "project"
                      ? "border-cc-primary/40 text-cc-primary bg-cc-primary/8"
                      : "border-cc-border text-cc-muted hover:text-cc-fg"
                  }`}
                >
                  This project
                </button>
              </div>
              {savePromptScope === "project" && sessionData?.cwd && (
                <div className="text-[10px] text-cc-muted font-mono-code truncate" title={sessionData.cwd}>
                  {sessionData.cwd}
                </div>
              )}
              {savePromptError ? (
                <div className="text-[11px] text-cc-error">{savePromptError}</div>
              ) : null}
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  onClick={() => {
                    setSavePromptOpen(false);
                    setSavePromptScope("global");
                    setSavePromptError(null);
                  }}
                  className="px-2 py-1 text-[11px] rounded-md border border-cc-border text-cc-muted hover:text-cc-fg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePrompt}
                  disabled={!savePromptName.trim() || !text.trim()}
                  className={`px-2 py-1 text-[11px] rounded-md border ${
                    savePromptName.trim() && text.trim()
                      ? "border-cc-primary/40 text-cc-primary bg-cc-primary/8 cursor-pointer"
                      : "border-cc-border text-cc-muted cursor-not-allowed"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          )}


          {/* Toolbar: mode toggle + actions -- ABOVE textarea on mobile only
              (never behind the iOS keyboard; Safari ignores interactive-widget).
              Hidden on desktop where the input row has these controls inline. */}
          <div className="flex sm:hidden items-center justify-between px-3 pt-2 pb-0.5">
            {/* Left: mode toggle */}
            <button
              onClick={toggleMode}
              disabled={!isConnected}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-all border select-none shrink-0 ${
                !isConnected
                  ? "opacity-30 cursor-not-allowed text-cc-muted border-transparent"
                  : isPlan
                    ? "text-cc-primary border-cc-primary/30 bg-cc-primary/8 hover:bg-cc-primary/12 cursor-pointer"
                    : "text-cc-muted border-cc-border hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
              }`}
              title="Toggle mode (Shift+Tab)"
            >
              {isPlan ? (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <rect x="3" y="3" width="3.5" height="10" rx="0.75" />
                  <rect x="9.5" y="3" width="3.5" height="10" rx="0.75" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M2.5 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <path d="M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
              <span>{modeLabel}</span>
            </button>

            <ModelSwitcher sessionId={sessionId} />

            <div className="flex-1" />

            {/* Clear input — mobile toolbar */}
            {text.trim() && (
              <button
                onClick={() => {
                  setText("");
                  setImages([]);
                  if (textareaRef.current) textareaRef.current.style.height = "auto";
                  textareaRef.current?.focus();
                }}
                className="flex items-center justify-center w-8 h-8 rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
                title="Clear input"
                aria-label="Clear input"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            )}

            <button
              onClick={() => {
                const defaultName = text.trim().slice(0, 32);
                setSavePromptName(defaultName || "");
                setSavePromptError(null);
                setSavePromptOpen((v) => !v);
              }}
              disabled={!text.trim()}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                text.trim()
                  ? "text-cc-muted hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
                  : "text-cc-muted opacity-30 cursor-not-allowed"
              }`}
              title="Save as prompt"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M4 2.75h8A1.25 1.25 0 0113.25 4v9.25L8 10.5l-5.25 2.75V4A1.25 1.25 0 014 2.75z" />
              </svg>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                isConnected
                  ? "text-cc-muted hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
                  : "text-cc-muted opacity-30 cursor-not-allowed"
              }`}
              title="Upload image"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <rect x="2" y="2" width="12" height="12" rx="2" />
                <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
                <path d="M2 11l3-3 2 2 3-4 4 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Clear input — mobile toolbar */}
            {text.trim() && (
              <button
                onClick={() => {
                  setText("");
                  setImages([]);
                  if (textareaRef.current) textareaRef.current.style.height = "auto";
                  textareaRef.current?.focus();
                }}
                className="flex items-center justify-center w-8 h-8 rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
                title="Clear input"
                aria-label="Clear input"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Main input row */}
          <div className="flex items-end gap-2 px-3 sm:px-2.5 py-1 sm:py-2">
            {/* Desktop mode toggle (hidden on mobile) */}
            <button
              onClick={toggleMode}
              disabled={!isConnected}
              className={`mb-0.5 hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-semibold transition-all border select-none shrink-0 ${
                !isConnected
                  ? "opacity-30 cursor-not-allowed text-cc-muted border-transparent"
                  : isPlan
                    ? "text-cc-primary border-cc-primary/30 bg-cc-primary/8 hover:bg-cc-primary/12 cursor-pointer"
                    : "text-cc-muted border-cc-border hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
              }`}
              title="Toggle mode (Shift+Tab)"
            >
              {isPlan ? (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <rect x="3" y="3" width="3.5" height="10" rx="0.75" />
                  <rect x="9.5" y="3" width="3.5" height="10" rx="0.75" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M2.5 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <path d="M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
              <span>{modeLabel}</span>
            </button>

            {/* Spacer pushes actions to the right */}
            <div className="flex-1" />

            {/* Right: secondary actions + send */}
            <div className="flex items-center gap-1.5">
              {text.trim() && (
                <button
                  onClick={() => {
                    setText("");
                    setImages([]);
                    if (textareaRef.current) textareaRef.current.style.height = "auto";
                    textareaRef.current?.focus();
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
                  title="Clear input"
                  aria-label="Clear input"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              )}

              <button
                onClick={() => {
                  const defaultName = text.trim().slice(0, 32);
                  setSavePromptName(defaultName || "");
                  setSavePromptError(null);
                  setSavePromptOpen((v) => !v);
                }}
                disabled={!text.trim()}
                className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  text.trim()
                    ? "text-cc-muted hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
                    : "text-cc-muted opacity-30 cursor-not-allowed"
                }`}
                title="Save as prompt"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <path d="M4 2.75h8A1.25 1.25 0 0113.25 4v9.25L8 10.5l-5.25 2.75V4A1.25 1.25 0 014 2.75z" />
                </svg>
              </button>
              {/* Upload image — desktop only (mobile has it in toolbar above) */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!isConnected}
                className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  isConnected
                    ? "text-cc-muted hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
                    : "text-cc-muted opacity-30 cursor-not-allowed"
                }`}
                title="Upload image"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                  <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
                  <path d="M2 11l3-3 2 2 3-4 4 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {SpeechRecognitionAPI && (
                <button
                  onClick={toggleListening}
                  disabled={!isConnected}
                  className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    isListening
                      ? "text-cc-error bg-cc-error/10 hover:bg-cc-error/20 cursor-pointer animate-pulse"
                      : isConnected
                        ? "text-cc-muted hover:text-cc-fg hover:bg-cc-hover cursor-pointer"
                        : "text-cc-muted opacity-30 cursor-not-allowed"
                  }`}
                  title={isListening ? "Stop dictation" : "Start dictation"}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                    <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
                    <path d="M3.5 7.5a4.5 4.5 0 009 0" />
                    <path d="M8 12.5v2" />
                  </svg>
                </button>
              )}

              {/* Model switcher — desktop only (mobile has it in toolbar above) */}
              <span className="hidden sm:inline-flex">
                <ModelSwitcher sessionId={sessionId} />
              </span>

              {/* LOCAL: Fork session button — only for claude sessions with a cliSessionId */}
              {canFork && (
                <button
                  onClick={handleFork}
                  className="flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-full text-cc-muted hover:text-cc-text hover:bg-cc-hover transition-colors cursor-pointer"
                  title="Fork conversation into a new session"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    {/* git fork icon */}
                    <circle cx="5" cy="3" r="1.5" />
                    <circle cx="11" cy="3" r="1.5" />
                    <circle cx="5" cy="13" r="1.5" />
                    <path d="M5 4.5v3C5 9.5 7 11 9 11h2" />
                    <path d="M11 4.5v6.5" />
                  </svg>
                </button>
              )}

              {/* Send/stop */}
              {isRunning ? (
                <button
                  onClick={handleInterrupt}
                  className="flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-cc-error/10 hover:bg-cc-error/20 text-cc-error transition-colors cursor-pointer"
                  title="Stop generation"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={`flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-full transition-colors ${
                    canSend
                      ? "bg-cc-primary hover:bg-cc-primary-hover text-white cursor-pointer shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
                      : "bg-cc-hover text-cc-muted cursor-not-allowed"
                  }`}
                  title="Send message"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M3 2l11 6-11 6V9.5l7-1.5-7-1.5V2z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* LOCAL: Inline ghost text — mirror div sits behind the textarea.
              The user's text is rendered transparent (invisible) so only the
              gray ghost suffix and [Tab] badge show through. */}
          <div className="relative">
            {completionSuggestion && !slashMenuOpen && !mention.mentionMenuOpen && (
              <div
                aria-hidden="true"
                onDoubleClick={acceptCompletion}
                title="Accept completion (double-click / Tab)"
                className="absolute inset-0 px-4 pt-1 pb-2 text-base sm:text-sm font-sans-ui pointer-events-auto cursor-text overflow-hidden"
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: "inherit",
                  minHeight: "42px",
                  maxHeight: "200px",
                }}
              >
                {/* Invisible mirror of user text so ghost suffix aligns to cursor */}
                <span style={{ color: "transparent" }}>{text}</span>
                {/* Ghost completion text */}
                <span className="text-cc-muted/50">{completionSuggestion}</span>
                {/* [Tab] badge */}
                <span className="text-cc-muted/40 text-[10px] select-none"> [Tab]</span>
              </div>
            )}

            {/* Textarea -- on top of mirror, bg-transparent so ghost shows through */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onClick={syncCaret}
              // LOCAL: double-click (desktop) or double-tap (iOS) at/after end-of-text accepts ghost completion.
              onDoubleClick={(e) => {
                if (completionSuggestion && e.currentTarget.selectionStart >= text.length) {
                  acceptCompletion();
                }
              }}
              onKeyUp={syncCaret}
              onPaste={handlePaste}
              // LOCAL: No onFocus scheduling — useEffect handles it; firing scheduleCompletion here
              // would immediately clear any visible suggestion (onFocus fires on click + Tab-focus).
              aria-label="Message input"
              placeholder={isConnected && !completionSuggestion
                ? "Type a message... (/ + @)"
                : isConnected
                  ? ""
                  : "Waiting for CLI connection..."}
              disabled={!isConnected}
              rows={1}
              className="relative w-full px-4 pt-1 pb-2 text-base sm:text-sm bg-transparent resize-none focus:outline-none text-cc-fg font-sans-ui placeholder:text-cc-muted disabled:opacity-50 overflow-y-auto"
              style={{ minHeight: "42px", maxHeight: "200px" }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
