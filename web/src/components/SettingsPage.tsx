import { useEffect, useRef, useState, useCallback } from "react";
import { api, type KeyHealthEntry } from "../api.js";
import { useStore } from "../store.js";
import { getTelemetryPreferenceEnabled, setTelemetryPreferenceEnabled } from "../analytics.js";
import { navigateToSession, navigateHome } from "../utils/routing.js";
import { safeStorage } from "../utils/safe-storage.js";

interface SettingsPageProps {
  embedded?: boolean;
}

const CATEGORIES = [
  { id: "general", label: "General" },
  { id: "connection", label: "Connection" },
  { id: "authentication", label: "Authentication" },
  { id: "local-network", label: "Local Network" },
  { id: "tunnel", label: "Tunnel" },
  { id: "notifications", label: "Notifications" },
  { id: "anthropic", label: "AI Provider" },
  { id: "ai-validation", label: "AI Validation" },
  { id: "updates", label: "Updates" },
  { id: "telemetry", label: "Telemetry" },
  { id: "environments", label: "Environments" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

export function SettingsPage({ embedded = false }: SettingsPageProps) {
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("claude-sonnet-4-6");
  const [editorTabEnabled, setEditorTabEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const theme = useStore((s) => s.theme);
  const cycleTheme = useStore((s) => s.cycleTheme);
  const diffBase = useStore((s) => s.diffBase);
  const setDiffBase = useStore((s) => s.setDiffBase);
  const notificationSound = useStore((s) => s.notificationSound);
  const toggleNotificationSound = useStore((s) => s.toggleNotificationSound);
  const notificationDesktop = useStore((s) => s.notificationDesktop);
  const setNotificationDesktop = useStore((s) => s.setNotificationDesktop);
  const showDebugMessages = useStore((s) => s.showDebugMessages);
  const toggleShowDebugMessages = useStore((s) => s.toggleShowDebugMessages);
  const updateInfo = useStore((s) => s.updateInfo);
  const setUpdateInfo = useStore((s) => s.setUpdateInfo);
  const setUpdateOverlayActive = useStore((s) => s.setUpdateOverlayActive);
  const setStoreEditorTabEnabled = useStore((s) => s.setEditorTabEnabled);
  const notificationApiAvailable = typeof Notification !== "undefined";
  const [updateChannel, setUpdateChannel] = useState<"stable" | "prerelease">("stable");
  const [dockerAutoUpdate, setDockerAutoUpdate] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [telemetryEnabled, setTelemetryEnabled] = useState(getTelemetryPreferenceEnabled());
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai" | "openrouter">("openrouter");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [openrouterConfigured, setOpenrouterConfigured] = useState(false);
  const [aiValidationEnabled, setAiValidationEnabled] = useState(false);
  const [aiValidationAutoApprove, setAiValidationAutoApprove] = useState(true);
  const [aiValidationAutoDeny, setAiValidationAutoDeny] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [activeSection, setActiveSection] = useState<CategoryId>("general");
  const [apiKeyFocused, setApiKeyFocused] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [keyHealth, setKeyHealth] = useState<Record<"anthropic" | "openai" | "openrouter", KeyHealthEntry | null>>({ anthropic: null, openai: null, openrouter: null });

  // Connection test state
  const [connStatus, setConnStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [connLatency, setConnLatency] = useState<number | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [connTestedAt, setConnTestedAt] = useState<Date | null>(null);

  // Auth section state
  const [authEnabled, setAuthEnabled] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [qrCodes, setQrCodes] = useState<{ label: string; url: string; qrDataUrl: string }[] | null>(null);
  const [selectedQrIndex, setSelectedQrIndex] = useState(0);
  const [qrLoading, setQrLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Local Network section state
  const [networkInfo, setNetworkInfo] = useState<{ port: number; hostname: string; addresses: { label: string; ip: string }[]; token: string | null } | null>(null);
  const [networkCopied, setNetworkCopied] = useState<string | null>(null);

  // Tunnel section state
  const [tunnelState, setTunnelState] = useState<string>("stopped");
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunnelProvider, setTunnelProvider] = useState<string | null>(null);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelUrlCopied, setTunnelUrlCopied] = useState(false);
  const [tunnelQr, setTunnelQr] = useState<{ url: string; qrDataUrl: string } | null>(null);
  const [tunnelQrLoading, setTunnelQrLoading] = useState(false);
  const [tunnelTestStatus, setTunnelTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [tunnelTestLatency, setTunnelTestLatency] = useState<number | null>(null);
  const [tunnelTestError, setTunnelTestError] = useState<string | null>(null);
  const [tunnelMode, setTunnelMode] = useState<string>("quick");

  // Named tunnel setup state
  const [namedInfo, setNamedInfo] = useState<{ loggedIn: boolean; tunnelId: string | null; hostname: string | null } | null>(null);
  const [namedSetupName, setNamedSetupName] = useState("iclaude");
  const [namedSetupHostname, setNamedSetupHostname] = useState("");
  const [namedSetupLoading, setNamedSetupLoading] = useState(false);
  const [namedSetupError, setNamedSetupError] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // IntersectionObserver to track which section is in view
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry?.target?.id) {
          setActiveSection(topEntry.target.id as CategoryId);
        }
      },
      {
        root: container,
        rootMargin: "-10% 0px -70% 0px",
        threshold: 0,
      },
    );

    for (const cat of CATEGORIES) {
      const el = sectionRefs.current[cat.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [loading]); // re-attach after loading completes and sections render

  const scrollToSection = useCallback((id: CategoryId) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setConfigured(s.anthropicApiKeyConfigured);
        setOpenaiConfigured(!!s.openaiApiKeyConfigured);
        setOpenrouterConfigured(!!s.openrouterApiKeyConfigured);
        if (typeof s.authEnabled === "boolean") setAuthEnabled(s.authEnabled);
        setAnthropicModel(s.anthropicModel || "claude-sonnet-4-6");
        setEditorTabEnabled(s.editorTabEnabled);
        setStoreEditorTabEnabled(s.editorTabEnabled);
        if (s.aiProvider) setAiProvider(s.aiProvider);
        if (typeof s.aiValidationEnabled === "boolean") setAiValidationEnabled(s.aiValidationEnabled);
        if (typeof s.aiValidationAutoApprove === "boolean") setAiValidationAutoApprove(s.aiValidationAutoApprove);
        if (typeof s.aiValidationAutoDeny === "boolean") setAiValidationAutoDeny(s.aiValidationAutoDeny);
        if (s.updateChannel === "stable" || s.updateChannel === "prerelease") setUpdateChannel(s.updateChannel);
        if (typeof s.dockerAutoUpdate === "boolean") setDockerAutoUpdate(s.dockerAutoUpdate);
        if (typeof s.publicUrl === "string") {
          setPublicUrl(s.publicUrl);
          useStore.getState().setPublicUrl(s.publicUrl);
        }
        if (s.keyHealth) setKeyHealth(s.keyHealth);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));

    // Fetch auth token, network info, and tunnel status in parallel (non-blocking)
    api.getAuthToken().then((res) => setAuthToken(res.token)).catch(() => {});
    api.getNetworkInfo().then(setNetworkInfo).catch(() => {});
    api.getTunnelStatus().then((s) => {
      setTunnelState(s.state);
      setTunnelUrl(s.url);
      setTunnelProvider(s.provider);
      setTunnelMode(s.mode || "quick");
      setTunnelError(s.error);
      if (s.state === "running" && s.url) {
        api.getTunnelQr().then(setTunnelQr).catch(() => {});
      }
    }).catch(() => {});
    api.getNamedTunnelInfo().then((info) => {
      setNamedInfo(info);
      if (info.hostname) setNamedSetupHostname(info.hostname);
    }).catch(() => {});
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload: {
        anthropicApiKey?: string; anthropicModel: string; editorTabEnabled: boolean;
        openaiApiKey?: string; openrouterApiKey?: string;
      } = {
        anthropicModel: anthropicModel.trim() || "claude-sonnet-4-6",
        editorTabEnabled,
      };
      const nextAnthropicKey = anthropicApiKey.trim();
      if (nextAnthropicKey) payload.anthropicApiKey = nextAnthropicKey;
      const nextOpenaiKey = openaiApiKey.trim();
      if (nextOpenaiKey) payload.openaiApiKey = nextOpenaiKey;
      const nextOpenrouterKey = openrouterApiKey.trim();
      if (nextOpenrouterKey) payload.openrouterApiKey = nextOpenrouterKey;

      const res = await api.updateSettings(payload);
      setConfigured(res.anthropicApiKeyConfigured);
      setOpenaiConfigured(!!res.openaiApiKeyConfigured);
      setOpenrouterConfigured(!!res.openrouterApiKeyConfigured);
      if (res.keyHealth) setKeyHealth(res.keyHealth);
      setEditorTabEnabled(res.editorTabEnabled);
      setStoreEditorTabEnabled(res.editorTabEnabled);
      setAnthropicApiKey("");
      setOpenaiApiKey("");
      setOpenrouterApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAiValidation(field: "aiValidationEnabled" | "aiValidationAutoApprove" | "aiValidationAutoDeny") {
    const current = field === "aiValidationEnabled" ? aiValidationEnabled
      : field === "aiValidationAutoApprove" ? aiValidationAutoApprove
      : aiValidationAutoDeny;
    const newValue = !current;
    // Optimistic UI update
    if (field === "aiValidationEnabled") setAiValidationEnabled(newValue);
    else if (field === "aiValidationAutoApprove") setAiValidationAutoApprove(newValue);
    else setAiValidationAutoDeny(newValue);

    try {
      await api.updateSettings({ [field]: newValue });
    } catch {
      // Revert on failure
      if (field === "aiValidationEnabled") setAiValidationEnabled(current);
      else if (field === "aiValidationAutoApprove") setAiValidationAutoApprove(current);
      else setAiValidationAutoDeny(current);
    }
  }

  async function onCheckUpdates() {
    setCheckingUpdates(true);
    setUpdateStatus("");
    setUpdateError("");
    try {
      const info = await api.forceCheckForUpdate();
      setUpdateInfo(info);
      if (info.updateAvailable && info.latestVersion) {
        setUpdateStatus(`Update v${info.latestVersion} is available.`);
      } else {
        setUpdateStatus("You are up to date.");
      }
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckingUpdates(false);
    }
  }

  async function onTriggerUpdate() {
    setUpdatingApp(true);
    setUpdateStatus("");
    setUpdateError("");
    try {
      // Flag so the Docker image update dialog appears after restart
      safeStorage.setItem("companion_docker_prompt_pending", "1");
      const res = await api.triggerUpdate();
      setUpdateStatus(res.message);
      setUpdateOverlayActive(true);
    } catch (err: unknown) {
      safeStorage.removeItem("companion_docker_prompt_pending");
      setUpdateError(err instanceof Error ? err.message : String(err));
      setUpdatingApp(false);
    }
  }

  const setSectionRef = useCallback((id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  return (
    <div className={`${embedded ? "h-full" : "h-[100dvh]"} bg-cc-bg text-cc-fg font-sans-ui antialiased flex flex-col`}>
      {/* Header */}
      <div className="shrink-0 max-w-5xl w-full mx-auto px-4 sm:px-8 pt-6 sm:pt-10">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-cc-fg">Settings</h1>
            <p className="mt-1 text-sm text-cc-muted">
              Configure API access, notifications, appearance, and workspace defaults.
            </p>
          </div>
          {!embedded && (
            <button
              onClick={() => {
                const sessionId = useStore.getState().currentSessionId;
                if (sessionId) {
                  navigateToSession(sessionId);
                } else {
                  navigateHome();
                }
              }}
              className="px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* Mobile horizontal nav */}
      <div className="sm:hidden shrink-0 border-b border-cc-border">
        <nav
          className="flex gap-1 px-4 py-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Settings categories"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollToSection(cat.id)}
              className={`shrink-0 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeSection === cat.id
                  ? "text-cc-primary bg-cc-primary/8"
                  : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Body: desktop sidebar + content */}
      <div className="flex-1 min-h-0 flex max-w-5xl w-full mx-auto">
        {/* Desktop sidebar nav */}
        <nav
          className="hidden sm:flex flex-col gap-0.5 w-44 shrink-0 pt-2 pr-6 pl-8 sticky top-0 self-start"
          aria-label="Settings categories"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollToSection(cat.id)}
              className={`text-left px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeSection === cat.id
                  ? "text-cc-primary bg-cc-primary/8"
                  : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        {/* Scrollable content */}
        <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-8 sm:pl-0 pb-safe">
          <div className="space-y-10 py-4 sm:py-2">
            {/* General */}
            <section id="general" ref={setSectionRef("general")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">General</h2>
              <div className="space-y-3">
                {/* LOCAL: use cycleTheme with 3-state display instead of upstream's toggleDarkMode */}
                <button
                  type="button"
                  onClick={cycleTheme}
                  className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-cc-hover text-cc-fg hover:bg-cc-active transition-colors cursor-pointer"
                >
                  <span>Theme</span>
                  <span className="text-xs text-cc-muted">
                    {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditorTabEnabled((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-cc-hover text-cc-fg hover:bg-cc-active transition-colors cursor-pointer"
                >
                  <span>Enable Editor tab (CodeMirror)</span>
                  <span className="text-xs text-cc-muted">{editorTabEnabled ? "On" : "Off"}</span>
                </button>
                <p className="text-xs text-cc-muted px-1">
                  Shows a simple in-app file editor in the session tabs.
                </p>

                <button
                  type="button"
                  onClick={() => setDiffBase(diffBase === "last-commit" ? "default-branch" : "last-commit")}
                  className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-cc-hover text-cc-fg hover:bg-cc-active transition-colors cursor-pointer"
                >
                  <span>Diff compare against</span>
                  <span className="text-xs text-cc-muted">
                    {diffBase === "last-commit" ? "Last commit (HEAD)" : "Default branch"}
                  </span>
                </button>
                <p className="text-xs text-cc-muted px-1">
                  Last commit shows only uncommitted changes. Default branch shows all changes since diverging from main.
                </p>
              </div>
            </section>

            {/* Connection */}
            <section id="connection" ref={setSectionRef("connection")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">Connection</h2>
              <div className="space-y-3">
                <p className="text-xs text-cc-muted">
                  Test connectivity to the Companion backend server.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={connStatus === "testing"}
                    onClick={async () => {
                      setConnStatus("testing");
                      setConnError(null);
                      setConnLatency(null);
                      const start = performance.now();
                      try {
                        await api.getSettings();
                        setConnLatency(Math.round(performance.now() - start));
                        setConnStatus("ok");
                        setConnTestedAt(new Date());
                      } catch (err) {
                        setConnError(err instanceof Error ? err.message : String(err));
                        setConnStatus("error");
                        setConnTestedAt(new Date());
                      }
                    }}
                    className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium bg-cc-hover hover:bg-cc-active text-cc-fg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connStatus === "testing" ? "Testing..." : "Test Connection"}
                  </button>
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      connStatus === "ok"
                        ? "text-green-500"
                        : connStatus === "error"
                          ? "text-red-500"
                          : connStatus === "testing"
                            ? "text-yellow-500"
                            : "text-cc-muted"
                    }`}
                  >
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        connStatus === "ok"
                          ? "bg-green-500"
                          : connStatus === "error"
                            ? "bg-red-500"
                            : connStatus === "testing"
                              ? "bg-yellow-500 animate-pulse"
                              : "bg-cc-muted/40"
                      }`}
                    />
                    {connStatus === "idle" && "Not tested"}
                    {connStatus === "testing" && "Connecting..."}
                    {connStatus === "ok" && `Connected${connLatency != null ? ` (${connLatency}ms)` : ""}`}
                    {connStatus === "error" && "Failed"}
                  </span>
                  {connTestedAt && connStatus !== "testing" && (
                    <span className="text-xs text-cc-muted">
                      {connTestedAt.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                {connError && (
                  <p className="text-xs text-red-500 px-1">{connError}</p>
                )}
              </div>
            </section>

            {/* Authentication */}
            <section id="authentication" ref={setSectionRef("authentication")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">Authentication</h2>
              <div className="space-y-4">
                {/* Auth toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium">Local Authentication</label>
                    <p className="text-xs text-cc-muted mt-0.5">
                      Require a token to access the Companion from any device. Localhost is always trusted.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={authEnabled}
                    onClick={async () => {
                      const next = !authEnabled;
                      setAuthEnabled(next);
                      try {
                        await api.updateSettings({ authEnabled: next });
                      } catch {
                        setAuthEnabled(!next); // revert on failure
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      authEnabled ? "bg-cc-primary" : "bg-cc-hover"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                        authEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-cc-muted">
                  Use the auth token or QR code to connect additional devices (e.g. mobile over Tailscale).
                </p>

                {/* Token display */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Auth Token</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2.5 min-h-[44px] text-sm bg-cc-bg rounded-lg text-cc-fg font-mono-code select-all break-all flex items-center">
                      {authToken
                        ? tokenRevealed
                          ? authToken
                          : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                        : <span className="text-cc-muted">Loading...</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTokenRevealed((v) => !v)}
                      className="px-3 py-2.5 min-h-[44px] rounded-lg text-sm bg-cc-hover hover:bg-cc-active text-cc-fg transition-colors cursor-pointer"
                      title={tokenRevealed ? "Hide token" : "Show token"}
                    >
                      {tokenRevealed ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (authToken) {
                          navigator.clipboard.writeText(authToken).then(() => {
                            setTokenCopied(true);
                            setTimeout(() => setTokenCopied(false), 1500);
                          });
                        }
                      }}
                      disabled={!authToken}
                      className="px-3 py-2.5 min-h-[44px] rounded-lg text-sm bg-cc-hover hover:bg-cc-active text-cc-fg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Copy token to clipboard"
                    >
                      {tokenCopied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Regenerate auth token? All existing sessions on other devices will be signed out.")) return;
                        setRegenerating(true);
                        try {
                          const res = await api.regenerateAuthToken();
                          setAuthToken(res.token);
                          setTokenRevealed(true);
                          setQrCodes(null);
                        } catch {
                          // Regeneration failed
                        } finally {
                          setRegenerating(false);
                        }
                      }}
                      disabled={regenerating}
                      className={`px-3 py-2.5 min-h-[44px] rounded-lg text-sm transition-colors cursor-pointer ${
                        regenerating
                          ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                          : "bg-cc-error/10 hover:bg-cc-error/20 text-cc-error"
                      }`}
                      title="Regenerate token — invalidates all other devices"
                    >
                      {regenerating ? "..." : "New"}
                    </button>
                  </div>
                </div>

                {/* QR code with address tabs */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Mobile Login QR</label>
                  {qrCodes && qrCodes.length > 0 ? (
                    <div className="space-y-3">
                      {/* Address tabs — pick which network to use */}
                      {qrCodes.length > 1 && (
                        <div className="flex gap-1">
                          {qrCodes.map((qr, i) => (
                            <button
                              key={qr.label}
                              type="button"
                              onClick={() => setSelectedQrIndex(i)}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                i === selectedQrIndex
                                  ? "bg-cc-primary text-white"
                                  : "bg-cc-hover text-cc-muted hover:text-cc-fg"
                              }`}
                            >
                              {qr.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="inline-block rounded-lg bg-white p-2">
                        <img
                          src={qrCodes[selectedQrIndex].qrDataUrl}
                          alt={`QR code for ${qrCodes[selectedQrIndex].label} login`}
                          className="w-48 h-48"
                        />
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-cc-bg text-sm font-mono-code text-cc-fg break-all select-all">
                        {qrCodes[selectedQrIndex].url}
                      </div>
                      <p className="text-xs text-cc-muted">
                        Scan with your phone&apos;s camera app — it will open the URL and auto-authenticate.
                      </p>
                    </div>
                  ) : qrCodes && qrCodes.length === 0 ? (
                    <p className="text-xs text-cc-muted">
                      No remote addresses detected (LAN or Tailscale). Connect to a network to generate a QR code.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        setQrLoading(true);
                        try {
                          const data = await api.getAuthQr();
                          setQrCodes(data.qrCodes);
                        } catch {
                          // QR generation failed silently — user can retry
                        } finally {
                          setQrLoading(false);
                        }
                      }}
                      disabled={qrLoading}
                      className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                        qrLoading
                          ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                          : "bg-cc-hover hover:bg-cc-active text-cc-fg cursor-pointer"
                      }`}
                    >
                      {qrLoading ? "Generating..." : "Show QR Code"}
                    </button>
                  )}
                </div>

              </div>
            </section>

            {/* Local Network */}
            <section id="local-network" ref={setSectionRef("local-network")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">Local Network</h2>
              <div className="space-y-2">
                {networkInfo ? (
                  <>
                    <p className="text-xs text-cc-muted mb-3">
                      Access this instance from other devices on your network.
                      {networkInfo.hostname && <> Hostname: <span className="text-cc-fg font-mono">{networkInfo.hostname}</span></>}
                    </p>
                    {networkInfo.addresses.map((addr) => {
                      const url = `http://${addr.ip}:${networkInfo.port}${networkInfo.token ? `/?token=${networkInfo.token}` : ""}`;
                      const isCopied = networkCopied === addr.ip;
                      return (
                        <div key={addr.ip} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cc-hover">
                          <span className="text-[10px] text-cc-muted w-16 shrink-0">{addr.label}</span>
                          <span className="text-xs text-cc-fg font-mono truncate flex-1">
                            {addr.ip}:{networkInfo.port}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(url);
                              setNetworkCopied(addr.ip);
                              setTimeout(() => setNetworkCopied(null), 1500);
                            }}
                            className="text-xs text-cc-muted hover:text-cc-fg shrink-0 cursor-pointer"
                          >
                            {isCopied ? "Copied" : "Copy URL"}
                          </button>
                        </div>
                      );
                    })}
                    {networkInfo.hostname && networkInfo.hostname !== "localhost" && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cc-hover">
                        <span className="text-[10px] text-cc-muted w-16 shrink-0">Hostname</span>
                        <span className="text-xs text-cc-fg font-mono truncate flex-1">
                          {networkInfo.hostname}:{networkInfo.port}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            const url = `http://${networkInfo.hostname}:${networkInfo.port}${networkInfo.token ? `/?token=${networkInfo.token}` : ""}`;
                            await navigator.clipboard.writeText(url);
                            setNetworkCopied("hostname");
                            setTimeout(() => setNetworkCopied(null), 1500);
                          }}
                          className="text-xs text-cc-muted hover:text-cc-fg shrink-0 cursor-pointer"
                        >
                          {networkCopied === "hostname" ? "Copied" : "Copy URL"}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-cc-muted">Loading network info...</p>
                )}
              </div>
            </section>

            {/* Tunnel */}
            <section id="tunnel" ref={setSectionRef("tunnel")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">Tunnel</h2>
              <div className="space-y-3">
                <p className="text-xs text-cc-muted">
                  Expose this instance to the internet via{" "}
                  <button type="button" onClick={async () => {
                    if (tunnelState === "running") return;
                    setTunnelLoading(true);
                    setTunnelError(null);
                    try {
                      setTunnelState("starting");
                      const res = await api.startTunnel();
                      setTunnelState("running");
                      setTunnelUrl(res.url);
                      setTunnelProvider(res.provider);
                      if (!publicUrl && res.url) {
                        setPublicUrl(res.url);
                        api.updateSettings({ publicUrl: res.url }).then((s) => {
                          useStore.getState().setPublicUrl(s.publicUrl);
                        }).catch(() => {});
                      }
                      api.getTunnelQr().then(setTunnelQr).catch(() => {});
                    } catch (err) {
                      setTunnelState("error");
                      setTunnelError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setTunnelLoading(false);
                    }
                  }} className="text-cc-primary hover:underline cursor-pointer bg-transparent border-none p-0 text-xs inline font-inherit">cloudflared</button>,{" "}
                  <a href="#/integrations/tailscale" className="text-cc-primary hover:underline">Tailscale</a>{" "}
                  or ngrok. Auth is automatically enabled when a tunnel is active.
                </p>

                <button
                  type="button"
                  disabled={tunnelLoading}
                  onClick={async () => {
                    setTunnelLoading(true);
                    setTunnelError(null);
                    try {
                      if (tunnelState === "running") {
                        await api.stopTunnel();
                        setTunnelState("stopped");
                        setTunnelUrl(null);
                        setTunnelProvider(null);
                        setTunnelQr(null);
                      } else {
                        setTunnelState("starting");
                        const res = await api.startTunnel();
                        setTunnelState("running");
                        setTunnelUrl(res.url);
                        setTunnelProvider(res.provider);
                        // Auto-fill public URL from tunnel URL
                        if (!publicUrl && res.url) {
                          setPublicUrl(res.url);
                          api.updateSettings({ publicUrl: res.url }).then((s) => {
                            useStore.getState().setPublicUrl(s.publicUrl);
                          }).catch(() => {});
                        }
                        // Auto-fetch QR code for the tunnel URL
                        api.getTunnelQr().then(setTunnelQr).catch(() => {});
                      }
                    } catch (err) {
                      setTunnelState("error");
                      setTunnelError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setTunnelLoading(false);
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-cc-hover text-cc-fg hover:bg-cc-active transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>Public Tunnel</span>
                  <span className="text-xs text-cc-muted">
                    {tunnelLoading ? "..." : tunnelState === "running" ? "On" : "Off"}
                  </span>
                </button>

                {/* Named tunnel config */}
                {namedInfo && (
                  <div className="space-y-2 p-3 rounded-lg bg-cc-bg border border-cc-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-cc-fg">Persistent URL</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${namedInfo.tunnelId ? "bg-green-500/20 text-green-400" : "bg-cc-hover text-cc-muted"}`}>
                        {namedInfo.tunnelId ? "configured" : "not set up"}
                      </span>
                    </div>
                    {!namedInfo.loggedIn ? (
                      <p className="text-xs text-cc-muted">
                        For a persistent URL, run <code className="bg-cc-hover px-1 rounded">cloudflared tunnel login</code> in your terminal, then refresh.
                      </p>
                    ) : namedInfo.tunnelId ? (
                      <div className="space-y-1">
                        <p className="text-xs text-cc-muted">
                          Hostname: <span className="text-cc-fg">{namedInfo.hostname}</span>
                        </p>
                        <p className="text-xs text-cc-muted">
                          Tunnel ID: <span className="text-cc-fg font-mono">{namedInfo.tunnelId.slice(0, 8)}...</span>
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Delete the named tunnel and revert to random URLs?")) return;
                            setNamedSetupLoading(true);
                            try {
                              await api.deleteNamedTunnel();
                              setNamedInfo({ loggedIn: true, tunnelId: null, hostname: null });
                              setTunnelMode("quick");
                            } catch (err) {
                              setNamedSetupError(err instanceof Error ? err.message : String(err));
                            } finally {
                              setNamedSetupLoading(false);
                            }
                          }}
                          disabled={namedSetupLoading}
                          className="text-xs text-red-400 hover:text-red-300 cursor-pointer disabled:opacity-50"
                        >
                          Remove persistent tunnel
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-cc-muted">
                          Create a named Cloudflare tunnel with a fixed hostname on your domain.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={namedSetupName}
                            onChange={(e) => setNamedSetupName(e.target.value)}
                            placeholder="Tunnel name"
                            className="flex-1 px-2 py-1.5 text-xs rounded bg-cc-hover border border-cc-border text-cc-fg placeholder:text-cc-muted"
                          />
                          <input
                            type="text"
                            value={namedSetupHostname}
                            onChange={(e) => setNamedSetupHostname(e.target.value)}
                            placeholder="hostname.yourdomain.com"
                            className="flex-[2] px-2 py-1.5 text-xs rounded bg-cc-hover border border-cc-border text-cc-fg placeholder:text-cc-muted"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={namedSetupLoading || !namedSetupName || !namedSetupHostname}
                          onClick={async () => {
                            setNamedSetupLoading(true);
                            setNamedSetupError(null);
                            try {
                              const result = await api.setupNamedTunnel(namedSetupName, namedSetupHostname);
                              setNamedInfo({ loggedIn: true, tunnelId: result.tunnelId, hostname: result.hostname });
                              setTunnelMode("named");
                            } catch (err) {
                              setNamedSetupError(err instanceof Error ? err.message : String(err));
                            } finally {
                              setNamedSetupLoading(false);
                            }
                          }}
                          className="px-3 py-1.5 text-xs rounded bg-cc-primary text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {namedSetupLoading ? "Setting up..." : "Create Persistent Tunnel"}
                        </button>
                        {namedSetupError && (
                          <p className="text-xs text-red-500">{namedSetupError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {tunnelState === "running" && tunnelUrl && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cc-hover">
                    <a
                      href={tunnelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cc-primary hover:underline truncate flex-1"
                    >
                      {tunnelUrl}
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(tunnelUrl);
                        setTunnelUrlCopied(true);
                        setTimeout(() => setTunnelUrlCopied(false), 1500);
                      }}
                      className="text-xs text-cc-muted hover:text-cc-fg shrink-0 cursor-pointer"
                    >
                      {tunnelUrlCopied ? "Copied" : "Copy"}
                    </button>
                    {tunnelProvider && (
                      <span className="text-[10px] text-cc-muted shrink-0">{tunnelProvider}{tunnelMode === "named" ? " (persistent)" : ""}</span>
                    )}
                  </div>
                )}
                {/* Public URL for webhooks — auto-filled from tunnel, editable */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-cc-fg" htmlFor="public-url">
                    Public URL
                    <span className="ml-1.5 font-normal text-cc-muted">(for webhooks from Linear, GitHub, etc.)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="public-url"
                      type="url"
                      aria-label="Public URL"
                      value={publicUrl}
                      onChange={(e) => setPublicUrl(e.target.value)}
                      placeholder={tunnelUrl || "https://your-domain.example.com"}
                      className="flex-1 px-3 py-2 min-h-[40px] text-xs bg-cc-bg rounded-lg border border-cc-border text-cc-fg placeholder:text-cc-muted focus:outline-none focus:ring-1 focus:ring-cc-primary/40 font-mono-code"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setSaving(true);
                        setError("");
                        try {
                          const res = await api.updateSettings({ publicUrl: publicUrl.trim() });
                          setPublicUrl(res.publicUrl);
                          useStore.getState().setPublicUrl(res.publicUrl);
                          setSaved(true);
                          setTimeout(() => setSaved(false), 1800);
                        } catch (err: unknown) {
                          setError(err instanceof Error ? err.message : String(err));
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      className="shrink-0 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium bg-cc-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? "..." : saved ? "Saved!" : "Save"}
                    </button>
                  </div>
                  <p className="text-[10px] text-cc-muted">
                    {publicUrl
                      ? `Using: ${publicUrl}`
                      : `Fallback: ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3456"}`}
                  </p>
                </div>

                {tunnelState === "running" && tunnelUrl && (
                  <div className="space-y-2">
                    {tunnelQr ? (
                      <>
                        <label className="block text-sm font-medium">Scan to Connect in Browser or in <a href="https://github.com/pannous/Listen" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">App</a></label>
                        <div className="inline-block rounded-lg bg-white p-2">
                          <img
                            src={tunnelQr.qrDataUrl}
                            alt="QR code for tunnel login"
                            className="w-48 h-48"
                          />
                        </div>
                        <p className="text-xs text-cc-muted">
                          Scan with your phone — opens the tunnel URL and auto-authenticates.
                        </p>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          setTunnelQrLoading(true);
                          try {
                            setTunnelQr(await api.getTunnelQr());
                          } catch { /* retry later */ }
                          finally { setTunnelQrLoading(false); }
                        }}
                        disabled={tunnelQrLoading}
                        className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                          tunnelQrLoading
                            ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                            : "bg-cc-hover hover:bg-cc-active text-cc-fg cursor-pointer"
                        }`}
                      >
                        {tunnelQrLoading ? "Generating..." : "Show QR Code"}
                      </button>
                    )}
                  </div>
                )}
                {tunnelState === "running" && tunnelUrl && (
                  <button
                    type="button"
                    onClick={() => api.downloadTunnelShortcut()}
                    className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-cc-hover text-cc-fg hover:bg-cc-active transition-colors cursor-pointer"
                  >
                    <span>Create Apple Shortcut</span>
                    <span className="text-xs text-cc-muted">Watch / iPhone / Mac</span>
                  </button>
                )}
                {tunnelState === "running" && tunnelUrl && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={tunnelTestStatus === "testing"}
                      onClick={async () => {
                        setTunnelTestStatus("testing");
                        setTunnelTestError(null);
                        setTunnelTestLatency(null);
                        const start = performance.now();
                        try {
                          await fetch(tunnelUrl, { method: "HEAD", mode: "no-cors" });
                          setTunnelTestLatency(Math.round(performance.now() - start));
                          setTunnelTestStatus("ok");
                        } catch (err) {
                          setTunnelTestError(err instanceof Error ? err.message : String(err));
                          setTunnelTestStatus("error");
                        }
                      }}
                      className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium bg-cc-hover hover:bg-cc-active text-cc-fg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {tunnelTestStatus === "testing" ? "Testing..." : "Test Tunnel"}
                    </button>
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                        tunnelTestStatus === "ok"
                          ? "text-green-500"
                          : tunnelTestStatus === "error"
                            ? "text-red-500"
                            : tunnelTestStatus === "testing"
                              ? "text-yellow-500"
                              : "text-cc-muted"
                      }`}
                    >
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          tunnelTestStatus === "ok"
                            ? "bg-green-500"
                            : tunnelTestStatus === "error"
                              ? "bg-red-500"
                              : tunnelTestStatus === "testing"
                                ? "bg-yellow-500 animate-pulse"
                                : "bg-cc-muted/40"
                        }`}
                      />
                      {tunnelTestStatus === "ok" && tunnelTestLatency != null && `${tunnelTestLatency}ms`}
                      {tunnelTestStatus === "error" && (tunnelTestError || "Failed")}
                    </span>
                  </div>
                )}
                {tunnelError && (
                  <p className="text-xs text-red-500 px-3">{tunnelError}</p>
                )}
              </div>
            </section>

            {/* Notifications */}
            <section id="notifications" ref={setSectionRef("notifications")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">Notifications</h2>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={toggleNotificationSound}
                  className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-cc-hover text-cc-fg hover:bg-cc-active transition-colors cursor-pointer"
                >
                  <span>Sound</span>
                  <span className="text-xs text-cc-muted">{notificationSound ? "On" : "Off"}</span>
                </button>
                {notificationApiAvailable && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!notificationDesktop) {
                        if (Notification.permission !== "granted") {
                          const result = await Notification.requestPermission();
                          if (result !== "granted") return;
                        }
                        setNotificationDesktop(true);
                      } else {
                        setNotificationDesktop(false);
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-cc-hover text-cc-fg hover:bg-cc-active transition-colors cursor-pointer"
                  >
                    <span>Desktop Alerts</span>
                    <span className="text-xs text-cc-muted">{notificationDesktop ? "On" : "Off"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleShowDebugMessages}
                  className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-cc-hover text-cc-fg hover:bg-cc-active transition-colors cursor-pointer"
                >
                  <span>Debug Messages</span>
                  <span className="text-xs text-cc-muted">{showDebugMessages ? "On" : "Off"}</span>
                </button>
              </div>
            </section>

            {/* AI Provider */}
            <section id="anthropic" ref={setSectionRef("anthropic")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">AI Provider</h2>
              <p className="text-xs text-cc-muted mb-4">
                Used for auto-naming sessions and AI validation. Select which provider to try first.
              </p>
              <form onSubmit={onSave} className="space-y-4">
                {([
                  { id: "anthropic" as const, label: "Anthropic", key: anthropicApiKey, setKey: setAnthropicApiKey, isConfigured: configured, placeholder: "sk-ant-api03-..." },
                  { id: "openai" as const, label: "OpenAI", key: openaiApiKey, setKey: setOpenaiApiKey, isConfigured: openaiConfigured, placeholder: "sk-..." },
                  { id: "openrouter" as const, label: "OpenRouter", key: openrouterApiKey, setKey: setOpenrouterApiKey, isConfigured: openrouterConfigured, placeholder: "sk-or-v1-..." },
                ] as const).map((provider) => (
                  <div key={provider.id} className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        setAiProvider(provider.id);
                        await api.updateSettings({ aiProvider: provider.id }).catch(() => {});
                      }}
                      className="mt-2.5 shrink-0 cursor-pointer"
                      title={`Use ${provider.label} first`}
                    >
                      <span className={`inline-block w-4 h-4 rounded-full border-2 transition-colors ${
                        aiProvider === provider.id
                          ? "border-cc-primary bg-cc-primary"
                          : "border-cc-muted/40 hover:border-cc-muted"
                      }`}>
                        {aiProvider === provider.id && (
                          <span className="block w-2 h-2 rounded-full bg-white mx-auto mt-[2px]" />
                        )}
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <label className="block text-sm font-medium mb-1" htmlFor={`key-${provider.id}`}>
                        {provider.label}
                        {provider.isConfigured && (() => {
                          const health = keyHealth[provider.id];
                          const hasError = health?.status === "error";
                          return (
                            <span
                              className={`ml-2 text-[10px] font-normal ${hasError ? "text-orange-400" : "text-cc-success"}`}
                              title={hasError ? health.error : undefined}
                            >
                              {hasError ? "error" : "configured"}
                            </span>
                          );
                        })()}
                      </label>
                      <input
                        id={`key-${provider.id}`}
                        type="password"
                        value={provider.isConfigured && !provider.key && apiKeyFocused !== provider.id ? "••••••••••••••••" : provider.key}
                        onChange={(e) => { provider.setKey(e.target.value); if (provider.id === "anthropic") setVerifyResult(null); }}
                        onFocus={() => { setApiKeyFocused(provider.id); }}
                        onBlur={() => { setApiKeyFocused(null); }}
                        placeholder={provider.isConfigured ? "Enter a new key to replace" : provider.placeholder}
                        className="w-full px-3 py-2 min-h-[40px] text-sm bg-cc-bg rounded-lg text-cc-fg placeholder:text-cc-muted focus:outline-none focus:ring-1 focus:ring-cc-primary/40 transition-shadow"
                      />
                    </div>
                  </div>
                ))}


                {error && (
                  <div className="px-3 py-2 rounded-lg bg-cc-error/10 border border-cc-error/20 text-xs text-cc-error">
                    {error}
                  </div>
                )}

                {saved && (
                  <div className="px-3 py-2 rounded-lg bg-cc-success/10 border border-cc-success/20 text-xs text-cc-success">
                    Settings saved.
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-cc-muted">
                    {loading ? "Loading..." : `Preferred: ${aiProvider === "anthropic" ? "Anthropic" : aiProvider === "openai" ? "OpenAI" : "OpenRouter"}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={verifying || !anthropicApiKey.trim()}
                      onClick={async () => {
                        setVerifying(true);
                        setVerifyResult(null);
                        try {
                          const result = await api.verifyAnthropicKey(anthropicApiKey.trim());
                          setVerifyResult(result);
                          setTimeout(() => setVerifyResult(null), 5000);
                        } catch (err: unknown) {
                          setVerifyResult({ valid: false, error: err instanceof Error ? err.message : String(err) });
                          setTimeout(() => setVerifyResult(null), 5000);
                        } finally {
                          setVerifying(false);
                        }
                      }}
                      className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                        verifying || !anthropicApiKey.trim()
                          ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                          : "bg-cc-hover hover:bg-cc-active text-cc-fg cursor-pointer"
                      }`}
                    >
                      {verifying ? "Verifying..." : "Verify"}
                    </button>
                    <button
                      type="submit"
                      disabled={saving || loading}
                      className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                        saving || loading
                          ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                          : "bg-cc-primary hover:bg-cc-primary-hover text-white cursor-pointer"
                      }`}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                {verifyResult && (
                  <div className={`px-3 py-2 rounded-lg text-xs ${
                    verifyResult.valid
                      ? "bg-cc-success/10 border border-cc-success/20 text-cc-success"
                      : "bg-cc-error/10 border border-cc-error/20 text-cc-error"
                  }`}>
                    {verifyResult.valid ? "Anthropic API key is valid." : `Invalid API key${verifyResult.error ? `: ${verifyResult.error}` : "."}`}
                  </div>
                )}
              </form>
            </section>


            {/* AI Validation */}
            <section id="ai-validation" ref={setSectionRef("ai-validation")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">AI Validation</h2>
              <div className="space-y-3">
                <p className="text-xs text-cc-muted leading-relaxed">
                  When enabled, an AI model evaluates tool calls before they execute.
                  Safe operations are auto-approved, dangerous ones are blocked,
                  and uncertain cases are shown to you with a recommendation.
                  Requires an Anthropic API key. These settings serve as defaults
                  for new sessions. Each session can override AI validation
                  independently via the shield icon in the session header.
                </p>

                {(() => {
                  const aiReady = configured;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleAiValidation("aiValidationEnabled")}
                        disabled={!aiReady}
                        className={`w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg transition-colors ${
                          !aiReady
                            ? "bg-cc-hover text-cc-muted cursor-not-allowed opacity-60"
                            : "bg-cc-hover hover:bg-cc-active text-cc-fg cursor-pointer"
                        }`}
                      >
                        <span className="text-sm">AI Validation Mode</span>
                        <span className={`text-xs font-medium ${aiValidationEnabled && aiReady ? "text-cc-success" : "text-cc-muted"}`}>
                          {aiValidationEnabled && aiReady ? "On" : "Off"}
                        </span>
                      </button>
                      {!aiReady && (
                        <p className="text-[11px] text-cc-warning">Configure an Anthropic API key above to enable AI validation.</p>
                      )}
                    </>
                  );
                })()}

                {aiValidationEnabled && (configured) && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleAiValidation("aiValidationAutoApprove")}
                      className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg bg-cc-hover hover:bg-cc-active text-cc-fg transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="text-sm">Auto-approve safe tools</span>
                        <p className="text-[11px] text-cc-muted mt-0.5">Automatically allow read-only tools and benign commands</p>
                      </div>
                      <span className={`text-xs font-medium ${aiValidationAutoApprove ? "text-cc-success" : "text-cc-muted"}`}>
                        {aiValidationAutoApprove ? "On" : "Off"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleAiValidation("aiValidationAutoDeny")}
                      className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg bg-cc-hover hover:bg-cc-active text-cc-fg transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="text-sm">Auto-deny dangerous tools</span>
                        <p className="text-[11px] text-cc-muted mt-0.5">Automatically block destructive commands like rm -rf</p>
                      </div>
                      <span className={`text-xs font-medium ${aiValidationAutoDeny ? "text-cc-success" : "text-cc-muted"}`}>
                        {aiValidationAutoDeny ? "On" : "Off"}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </section>


            {/* Updates */}
            <section id="updates" ref={setSectionRef("updates")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">Updates</h2>
              <div className="space-y-3">
                {updateInfo ? (
                  <p className="text-xs text-cc-muted">
                    Current version: v{updateInfo.currentVersion}
                    {updateInfo.latestVersion ? ` • Latest: v${updateInfo.latestVersion}` : ""}
                    {updateInfo.channel === "prerelease" ? " (prerelease)" : ""}
                  </p>
                ) : (
                  <p className="text-xs text-cc-muted">Version information not loaded yet.</p>
                )}

                <div>
                  <span id="update-channel-label" className="block text-sm font-medium mb-1.5">
                    Update Channel
                  </span>
                  <div className="flex gap-1" role="radiogroup" aria-labelledby="update-channel-label">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={updateChannel === "stable"}
                      onClick={async () => {
                        if (updateChannel === "stable") return;
                        setUpdateChannel("stable");
                        try {
                          await api.updateSettings({ updateChannel: "stable" });
                        } catch {
                          setUpdateChannel("prerelease");
                          return;
                        }
                        try {
                          const info = await api.forceCheckForUpdate();
                          setUpdateInfo(info);
                        } catch { /* settings saved; swallow check error */ }
                      }}
                      className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        updateChannel === "stable"
                          ? "bg-cc-primary text-white"
                          : "bg-cc-hover text-cc-muted hover:text-cc-fg hover:bg-cc-active"
                      }`}
                    >
                      Stable
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={updateChannel === "prerelease"}
                      onClick={async () => {
                        if (updateChannel === "prerelease") return;
                        setUpdateChannel("prerelease");
                        try {
                          await api.updateSettings({ updateChannel: "prerelease" });
                        } catch {
                          setUpdateChannel("stable");
                          return;
                        }
                        try {
                          const info = await api.forceCheckForUpdate();
                          setUpdateInfo(info);
                        } catch { /* settings saved; swallow check error */ }
                      }}
                      className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        updateChannel === "prerelease"
                          ? "bg-cc-primary text-white"
                          : "bg-cc-hover text-cc-muted hover:text-cc-fg hover:bg-cc-active"
                      }`}
                    >
                      Prerelease
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-cc-muted">
                    {updateChannel === "prerelease"
                      ? "Tracking prerelease channel. You will receive preview builds from the latest main branch."
                      : "Tracking stable channel. You will only receive versioned releases."}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-sm font-medium">Auto-update Docker image</span>
                    <p className="mt-0.5 text-xs text-cc-muted">
                      Automatically re-pull the sandbox Docker image when updating The Companion
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dockerAutoUpdate}
                    onClick={async () => {
                      const next = !dockerAutoUpdate;
                      setDockerAutoUpdate(next);
                      try {
                        await api.updateSettings({ dockerAutoUpdate: next });
                      } catch {
                        setDockerAutoUpdate(!next);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      dockerAutoUpdate ? "bg-cc-primary" : "bg-cc-hover"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                        dockerAutoUpdate ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {updateError && (
                  <div className="px-3 py-2 rounded-lg bg-cc-error/10 border border-cc-error/20 text-xs text-cc-error">
                    {updateError}
                  </div>
                )}

                {updateStatus && (
                  <div className="px-3 py-2 rounded-lg bg-cc-success/10 border border-cc-success/20 text-xs text-cc-success">
                    {updateStatus}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onCheckUpdates}
                    disabled={checkingUpdates}
                    className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                      checkingUpdates
                        ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                        : "bg-cc-hover hover:bg-cc-active text-cc-fg cursor-pointer"
                    }`}
                  >
                    {checkingUpdates ? "Checking..." : "Check for updates"}
                  </button>

                  {updateInfo?.isServiceMode ? (
                    <button
                      type="button"
                      onClick={onTriggerUpdate}
                      disabled={updatingApp || updateInfo.updateInProgress || !updateInfo.updateAvailable}
                      className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                        updatingApp || updateInfo.updateInProgress || !updateInfo.updateAvailable
                          ? "bg-cc-hover text-cc-muted cursor-not-allowed"
                          : "bg-cc-primary hover:bg-cc-primary-hover text-white cursor-pointer"
                      }`}
                    >
                      {updatingApp || updateInfo.updateInProgress ? "Updating..." : "Update & Restart"}
                    </button>
                  ) : (
                    <p className="text-xs text-cc-muted self-center">
                      Install service mode with <code className="font-mono-code bg-cc-code-bg px-1 py-0.5 rounded text-cc-code-fg">iclaude install</code> to enable one-click updates.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Telemetry */}
            <section id="telemetry" ref={setSectionRef("telemetry")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">Telemetry</h2>
              <div className="space-y-3">
                <p className="text-xs text-cc-muted">
                  Anonymous product analytics and crash reports via PostHog to improve reliability.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const next = !telemetryEnabled;
                    setTelemetryPreferenceEnabled(next);
                    setTelemetryEnabled(next);
                  }}
                  className="w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm bg-cc-hover text-cc-fg hover:bg-cc-active transition-colors cursor-pointer"
                >
                  <span>Usage analytics and errors</span>
                  <span className="text-xs text-cc-muted">{telemetryEnabled ? "On" : "Off"}</span>
                </button>
                <p className="text-xs text-cc-muted">
                  Browser Do Not Track is respected automatically.
                </p>
              </div>
            </section>

            <section id="environments" ref={setSectionRef("environments")}>
              <h2 className="text-sm font-semibold text-cc-fg mb-4">Environments</h2>
              <div className="space-y-3">
                <p className="text-xs text-cc-muted">
                  Manage reusable environment profiles used when creating sessions.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = "#/environments";
                  }}
                  className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium bg-cc-primary hover:bg-cc-primary-hover text-white transition-colors cursor-pointer"
                >
                  Open Environments Page
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
