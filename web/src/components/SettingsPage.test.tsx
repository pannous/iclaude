// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// IntersectionObserver is not available in jsdom — provide a no-op mock
// so the scroll-tracking logic in SettingsPage doesn't crash during tests.
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
(globalThis as Record<string, unknown>).IntersectionObserver = MockIntersectionObserver;

interface MockStoreState {
  // LOCAL: use theme (3-state) + cycleTheme instead of upstream's darkMode + toggleDarkMode
  theme: "system" | "dark" | "light";
  notificationSound: boolean;
  notificationDesktop: boolean;
  diffBase: string;
  updateInfo: {
    currentVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
    isServiceMode: boolean;
    updateInProgress: boolean;
    lastChecked: number;
  } | null;
  cycleTheme: ReturnType<typeof vi.fn>;
  toggleNotificationSound: ReturnType<typeof vi.fn>;
  setNotificationDesktop: ReturnType<typeof vi.fn>;
  setDiffBase: ReturnType<typeof vi.fn>;
  setUpdateInfo: ReturnType<typeof vi.fn>;
  setUpdateOverlayActive: ReturnType<typeof vi.fn>;
  setEditorTabEnabled: ReturnType<typeof vi.fn>;
}

let mockState: MockStoreState;

function createMockState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    theme: "system",
    notificationSound: true,
    notificationDesktop: false,
    diffBase: "last-commit",
    updateInfo: null,
    cycleTheme: vi.fn(),
    toggleNotificationSound: vi.fn(),
    setNotificationDesktop: vi.fn(),
    setDiffBase: vi.fn(),
    setUpdateInfo: vi.fn(),
    setUpdateOverlayActive: vi.fn(),
    setEditorTabEnabled: vi.fn(),
    ...overrides,
  };
}

const mockApi = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  forceCheckForUpdate: vi.fn(),
  triggerUpdate: vi.fn(),
  getAuthToken: vi.fn(),
  regenerateAuthToken: vi.fn(),
  getAuthQr: vi.fn(),
  verifyAnthropicKey: vi.fn(),
  getNetworkInfo: vi.fn(),
  getTunnelStatus: vi.fn(),
  startTunnel: vi.fn(),
  stopTunnel: vi.fn(),
  getTunnelQr: vi.fn(),
  downloadTunnelShortcut: vi.fn(),
  getNamedTunnelInfo: vi.fn(),
  setupNamedTunnel: vi.fn(),
  deleteNamedTunnel: vi.fn(),
};

const mockTelemetry = {
  getTelemetryPreferenceEnabled: vi.fn(),
  setTelemetryPreferenceEnabled: vi.fn(),
};

vi.mock("../api.js", () => ({
  api: {
    getSettings: (...args: unknown[]) => mockApi.getSettings(...args),
    updateSettings: (...args: unknown[]) => mockApi.updateSettings(...args),
    forceCheckForUpdate: (...args: unknown[]) => mockApi.forceCheckForUpdate(...args),
    triggerUpdate: (...args: unknown[]) => mockApi.triggerUpdate(...args),
    getAuthToken: (...args: unknown[]) => mockApi.getAuthToken(...args),
    regenerateAuthToken: (...args: unknown[]) => mockApi.regenerateAuthToken(...args),
    getAuthQr: (...args: unknown[]) => mockApi.getAuthQr(...args),
    verifyAnthropicKey: (...args: unknown[]) => mockApi.verifyAnthropicKey(...args),
    getNetworkInfo: (...args: unknown[]) => mockApi.getNetworkInfo(...args),
    getTunnelStatus: (...args: unknown[]) => mockApi.getTunnelStatus(...args),
    startTunnel: (...args: unknown[]) => mockApi.startTunnel(...args),
    stopTunnel: (...args: unknown[]) => mockApi.stopTunnel(...args),
    getTunnelQr: (...args: unknown[]) => mockApi.getTunnelQr(...args),
    downloadTunnelShortcut: (...args: unknown[]) => mockApi.downloadTunnelShortcut(...args),
    getNamedTunnelInfo: (...args: unknown[]) => mockApi.getNamedTunnelInfo(...args),
    setupNamedTunnel: (...args: unknown[]) => mockApi.setupNamedTunnel(...args),
    deleteNamedTunnel: (...args: unknown[]) => mockApi.deleteNamedTunnel(...args),
  },
}));

vi.mock("../analytics.js", () => ({
  getTelemetryPreferenceEnabled: (...args: unknown[]) => mockTelemetry.getTelemetryPreferenceEnabled(...args),
  setTelemetryPreferenceEnabled: (...args: unknown[]) => mockTelemetry.setTelemetryPreferenceEnabled(...args),
}));

vi.mock("../store.js", () => {
  const useStoreFn = (selector: (state: MockStoreState) => unknown) => selector(mockState);
  useStoreFn.getState = () => mockState;
  return { useStore: useStoreFn };
});

import { SettingsPage } from "./SettingsPage.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockState = createMockState();
  window.location.hash = "#/settings";
  mockApi.getSettings.mockResolvedValue({
    anthropicApiKeyConfigured: true,
    anthropicModel: "claude-sonnet-4.6",
    linearApiKeyConfigured: false,
    linearAutoTransition: false,
    linearAutoTransitionStateName: "",
    editorTabEnabled: false,
    updateChannel: "stable",
  });
  mockApi.updateSettings.mockResolvedValue({
    anthropicApiKeyConfigured: true,
    anthropicModel: "claude-sonnet-4.6",
    linearApiKeyConfigured: false,
    linearAutoTransition: false,
    linearAutoTransitionStateName: "",
    editorTabEnabled: false,
    updateChannel: "stable",
  });
  mockApi.forceCheckForUpdate.mockResolvedValue({
    currentVersion: "0.22.1",
    latestVersion: null,
    updateAvailable: false,
    isServiceMode: false,
    updateInProgress: false,
    lastChecked: Date.now(),
    channel: "stable",
  });
  mockApi.triggerUpdate.mockResolvedValue({
    ok: true,
    message: "Update started. Server will restart shortly.",
  });
  mockApi.getAuthToken.mockResolvedValue({ token: "abc123testtoken" });
  mockApi.regenerateAuthToken.mockResolvedValue({ token: "newtoken456" });
  mockApi.getAuthQr.mockResolvedValue({
    qrCodes: [
      { label: "LAN", url: "http://192.168.1.10:3456", qrDataUrl: "data:image/png;base64,LAN_QR" },
      { label: "Tailscale", url: "http://100.118.112.23:3456", qrDataUrl: "data:image/png;base64,TS_QR" },
    ],
  });
  mockApi.getNetworkInfo.mockResolvedValue({
    port: 3456,
    hostname: "mac.fritz.box",
    addresses: [
      { label: "Localhost", ip: "localhost" },
      { label: "LAN", ip: "192.168.1.10" },
    ],
    token: "abc123testtoken",
  });
  mockApi.getTunnelStatus.mockResolvedValue({
    state: "stopped",
    url: null,
    provider: null,
    mode: "quick",
    error: null,
  });
  mockApi.getNamedTunnelInfo.mockResolvedValue({
    loggedIn: false,
    tunnelId: null,
    hostname: null,
    credentialsPath: null,
  });
  mockApi.getTunnelQr.mockResolvedValue({
    url: "https://test-tunnel.trycloudflare.com",
    qrDataUrl: "data:image/png;base64,TUNNEL_QR",
  });
  mockTelemetry.getTelemetryPreferenceEnabled.mockReturnValue(true);
});

describe("SettingsPage", () => {
  it("loads settings on mount and shows configured status", async () => {
    render(<SettingsPage />);

    expect(mockApi.getSettings).toHaveBeenCalledTimes(1);
    await screen.findByText("Anthropic key configured");
    expect(screen.getByDisplayValue("claude-sonnet-4.6")).toBeInTheDocument();
  });

  // When a key is already configured, the input shows masked dots (••••) to
  // visually indicate a key is present. The dots clear on focus so the user
  // can type a replacement key.
  it("shows masked dots in API key field when key is configured", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const input = screen.getByLabelText("Anthropic API Key") as HTMLInputElement;
    expect(input.value).toBe("••••••••••••••••");

    // On focus the dots clear to allow entering a new key
    fireEvent.focus(input);
    expect(input.value).toBe("");
  });

  it("shows not configured status", async () => {
    mockApi.getSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: false,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      updateChannel: "stable",
    });

    render(<SettingsPage />);

    await screen.findByText("Anthropic key not configured");
  });

  it("shows optional auto-renaming hint when OpenRouter selected and key not configured", async () => {
    mockApi.getSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: false,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      updateChannel: "stable",
    });
    render(<SettingsPage />);

    // Default provider is OpenRouter — should show the optional hint
    expect(await screen.findByText("Optional — enables automatic session renaming.")).toBeInTheDocument();
  });

  it("hides auto-renaming hint when key is already configured", async () => {
    render(<SettingsPage />);

    // Default mock has anthropicApiKeyConfigured: true — hint should be hidden
    await screen.findByText("Anthropic key configured");
    expect(screen.queryByText(/auto-renaming/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/enables automatic session renaming/i)).not.toBeInTheDocument();
  });

  it("saves settings with trimmed values", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.change(screen.getByLabelText("Anthropic API Key"), {
      target: { value: "  or-key  " },
    });
    fireEvent.change(screen.getByLabelText("Anthropic Model"), {
      target: { value: "  openai/gpt-4o-mini  " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        anthropicApiKey: "or-key",
        anthropicModel: "openai/gpt-4o-mini",
        editorTabEnabled: false,
      });
    });

    expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
  });

  it("falls back model to claude-sonnet-4.6 when blank", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");
    fireEvent.change(screen.getByLabelText("Anthropic Model"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        anthropicModel: "claude-sonnet-4.6",
        editorTabEnabled: false,
      });
    });
  });

  it("does not send key when left empty", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.change(screen.getByLabelText("Anthropic Model"), {
      target: { value: "openai/gpt-4o-mini" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        anthropicModel: "openai/gpt-4o-mini",
        editorTabEnabled: false,
      });
    });
  });

  // Editor tab toggle is in the General section; toggling it updates local state,
  // which is then included in the Anthropic form's save payload.
  it("saves editor tab toggle in settings payload", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: /Enable Editor tab \(CodeMirror\)/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        anthropicModel: "claude-sonnet-4.6",
        editorTabEnabled: true,
      });
    });
  });

  it("shows error if initial load fails", async () => {
    mockApi.getSettings.mockRejectedValueOnce(new Error("load failed"));

    render(<SettingsPage />);

    expect(await screen.findByText("load failed")).toBeInTheDocument();
  });

  it("shows error if save fails", async () => {
    mockApi.updateSettings.mockRejectedValueOnce(new Error("save failed"));

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.change(screen.getByLabelText("Anthropic API Key"), {
      target: { value: "or-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });

  it("navigates back when Back button is clicked", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(window.location.hash).toBe("");
  });

  it("hides Back button in embedded mode", async () => {
    render(<SettingsPage embedded />);
    await screen.findByText("Anthropic key configured");
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("shows saving state while request is in flight", async () => {
    let resolveSave: ((value: {
      anthropicApiKeyConfigured: boolean;
      anthropicModel: string;
      linearApiKeyConfigured: boolean;
      linearAutoTransition: boolean;
      linearAutoTransitionStateName: string;
      editorTabEnabled: boolean;
    }) => void) | undefined;
    mockApi.updateSettings.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve as typeof resolveSave;
      }),
    );

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.change(screen.getByLabelText("Anthropic API Key"), {
      target: { value: "or-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    resolveSave?.({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
    });

    await screen.findByText("Settings saved.");
  });

  it("toggles sound notifications from settings", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: /Sound/i }));
    expect(mockState.toggleNotificationSound).toHaveBeenCalledTimes(1);
  });

  // LOCAL: tests cycleTheme instead of upstream's toggleDarkMode
  it("cycles theme from settings", async () => {
    mockState = createMockState({ theme: "system" });
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: /Theme/i }));
    expect(mockState.cycleTheme).toHaveBeenCalledTimes(1);
  });

  it("toggles telemetry preference from settings", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: /Usage analytics and errors/i }));
    expect(mockTelemetry.setTelemetryPreferenceEnabled).toHaveBeenCalledWith(false);
  });

  it("navigates to environments page from settings", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Open Environments Page" }));
    expect(window.location.hash).toBe("#/environments");
  });

  it("requests desktop permission before enabling desktop alerts", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission,
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");
    fireEvent.click(screen.getByRole("button", { name: /Desktop Alerts/i }));

    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(mockState.setNotificationDesktop).toHaveBeenCalledWith(true);
    });
    vi.unstubAllGlobals();
  });

  it("checks for updates from settings and stores update info", async () => {
    mockApi.forceCheckForUpdate.mockResolvedValueOnce({
      currentVersion: "0.22.1",
      latestVersion: "0.23.0",
      updateAvailable: true,
      isServiceMode: true,
      updateInProgress: false,
      lastChecked: Date.now(),
      channel: "stable",
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));

    await waitFor(() => {
      expect(mockApi.forceCheckForUpdate).toHaveBeenCalledTimes(1);
      expect(mockState.setUpdateInfo).toHaveBeenCalledWith(expect.objectContaining({
        latestVersion: "0.23.0",
        updateAvailable: true,
      }));
    });
    expect(await screen.findByText("Update v0.23.0 is available.")).toBeInTheDocument();
  });

  it("triggers app update from settings when service mode is enabled", async () => {
    mockState = createMockState({
      updateInfo: {
        currentVersion: "0.22.1",
        latestVersion: "0.23.0",
        updateAvailable: true,
        isServiceMode: true,
        updateInProgress: false,
        lastChecked: Date.now(),
      },
    });
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Update & Restart" }));

    await waitFor(() => {
      expect(mockApi.triggerUpdate).toHaveBeenCalledTimes(1);
    });
    expect(mockState.setUpdateOverlayActive).toHaveBeenCalledWith(true);
    expect(await screen.findByText("Update started. Server will restart shortly.")).toBeInTheDocument();
  });

  // Verify left sidebar nav renders category labels for quick navigation
  it("renders category navigation with all section labels", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    // Each category appears in both desktop sidebar and mobile nav (jsdom renders both)
    const generalButtons = screen.getAllByRole("button", { name: "General" });
    expect(generalButtons.length).toBeGreaterThanOrEqual(1);

    const notifButtons = screen.getAllByRole("button", { name: "Notifications" });
    expect(notifButtons.length).toBeGreaterThanOrEqual(1);
  });

  // Verify section headings have correct IDs for anchor-based scrolling
  it("renders section headings with anchor IDs", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    expect(document.getElementById("general")).toBeInTheDocument();
    expect(document.getElementById("authentication")).toBeInTheDocument();
    expect(document.getElementById("notifications")).toBeInTheDocument();
    expect(document.getElementById("anthropic")).toBeInTheDocument();
    expect(document.getElementById("updates")).toBeInTheDocument();
    expect(document.getElementById("telemetry")).toBeInTheDocument();
    expect(document.getElementById("environments")).toBeInTheDocument();
  });

  // ─── Authentication section tests ──────────────────────────────────

  // The auth section fetches the token on mount and displays it masked.
  it("fetches and displays the auth token masked by default", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    // Token should be fetched
    expect(mockApi.getAuthToken).toHaveBeenCalledTimes(1);

    // Token is masked by default — shows dots, not the actual value
    await waitFor(() => {
      expect(screen.getByText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022")).toBeInTheDocument();
    });
    expect(screen.queryByText("abc123testtoken")).not.toBeInTheDocument();
  });

  // Clicking "Show" reveals the actual token value.
  it("reveals the token when Show is clicked", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    await waitFor(() => {
      expect(screen.getByText("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Show token"));
    expect(screen.getByText("abc123testtoken")).toBeInTheDocument();
  });

  // Clicking "Show QR Code" loads and displays QR with address tabs.
  it("shows QR code with address tabs when button is clicked", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "Show QR Code" }));

    await waitFor(() => {
      expect(mockApi.getAuthQr).toHaveBeenCalledTimes(1);
    });

    // First address (LAN) QR should be shown by default
    const img = await screen.findByAltText("QR code for LAN login");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "data:image/png;base64,LAN_QR");

    // Address tabs should be visible (LAN and Tailscale)
    expect(screen.getByRole("button", { name: "LAN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tailscale" })).toBeInTheDocument();

    // Clicking Tailscale tab switches the QR code
    fireEvent.click(screen.getByRole("button", { name: "Tailscale" }));
    const tsImg = screen.getByAltText("QR code for Tailscale login");
    expect(tsImg).toHaveAttribute("src", "data:image/png;base64,TS_QR");
    expect(screen.getByText("http://100.118.112.23:3456")).toBeInTheDocument();
  });

  // Regenerating the token calls the API and reveals the new token.
  it("regenerates the token after user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "New" }));

    await waitFor(() => {
      expect(mockApi.regenerateAuthToken).toHaveBeenCalledTimes(1);
    });

    // New token is revealed automatically after regeneration
    expect(await screen.findByText("newtoken456")).toBeInTheDocument();

    (window.confirm as ReturnType<typeof vi.spyOn>).mockRestore();
  });

  // Cancelling the confirmation dialog skips regeneration entirely.
  it("does not regenerate when user cancels confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: "New" }));

    expect(mockApi.regenerateAuthToken).not.toHaveBeenCalled();

    (window.confirm as ReturnType<typeof vi.spyOn>).mockRestore();
  });

  // The Authentication navigation item appears in the sidebar.
  it("includes Authentication in category navigation", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const authButtons = screen.getAllByRole("button", { name: "Authentication" });
    expect(authButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Verify button tests ──────────────────────────────────

  // The Verify button is disabled when the API key input is empty.
  it("disables Verify button when anthropic key input is empty", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const verifyBtn = screen.getByRole("button", { name: "Verify" });
    expect(verifyBtn).toBeDisabled();
  });

  // The Verify button is enabled when the user types a new key.
  it("enables Verify button when user types a key", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const keyInput = screen.getByLabelText("Anthropic API Key");
    fireEvent.focus(keyInput);
    fireEvent.change(keyInput, { target: { value: "sk-ant-test-key" } });

    const verifyBtn = screen.getByRole("button", { name: "Verify" });
    expect(verifyBtn).toBeEnabled();
  });

  // Clicking Verify calls verifyAnthropicKey and shows success state.
  it("shows success message when verify succeeds", async () => {
    mockApi.verifyAnthropicKey.mockResolvedValueOnce({ valid: true });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const keyInput = screen.getByLabelText("Anthropic API Key");
    fireEvent.focus(keyInput);
    fireEvent.change(keyInput, { target: { value: "sk-ant-test-key" } });

    const verifyBtn = screen.getByRole("button", { name: "Verify" });
    fireEvent.click(verifyBtn);

    expect(mockApi.verifyAnthropicKey).toHaveBeenCalledWith("sk-ant-test-key");
    await screen.findByText("API key is valid.");
  });

  // Clicking Verify shows error state when verification fails.
  it("shows error message when verify fails", async () => {
    mockApi.verifyAnthropicKey.mockResolvedValueOnce({ valid: false, error: "API returned 401" });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const keyInput = screen.getByLabelText("Anthropic API Key");
    fireEvent.focus(keyInput);
    fireEvent.change(keyInput, { target: { value: "sk-ant-bad-key" } });

    const verifyBtn = screen.getByRole("button", { name: "Verify" });
    fireEvent.click(verifyBtn);

    expect(mockApi.verifyAnthropicKey).toHaveBeenCalledWith("sk-ant-bad-key");
    await screen.findByText("Invalid API key: API returned 401");
  });

  // Verify result auto-dismisses after 5 seconds.
  it("auto-dismisses verify result after 5 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi.verifyAnthropicKey.mockResolvedValueOnce({ valid: true });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const keyInput = screen.getByLabelText("Anthropic API Key");
    fireEvent.focus(keyInput);
    fireEvent.change(keyInput, { target: { value: "sk-ant-test-key" } });

    const verifyBtn = screen.getByRole("button", { name: "Verify" });
    fireEvent.click(verifyBtn);

    await screen.findByText("API key is valid.");

    // Advance past the 5s auto-dismiss
    act(() => {
      vi.advanceTimersByTime(5100);
    });

    await waitFor(() => {
      expect(screen.queryByText("API key is valid.")).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  // Verify result clears when the key input changes.
  it("clears verify result when key input changes", async () => {
    mockApi.verifyAnthropicKey.mockResolvedValueOnce({ valid: true });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const keyInput = screen.getByLabelText("Anthropic API Key");
    fireEvent.focus(keyInput);
    fireEvent.change(keyInput, { target: { value: "sk-ant-test-key" } });

    const verifyBtn = screen.getByRole("button", { name: "Verify" });
    fireEvent.click(verifyBtn);

    await screen.findByText("API key is valid.");

    // Changing the key should clear the verify result
    fireEvent.change(keyInput, { target: { value: "sk-ant-test-key-changed" } });

    await waitFor(() => {
      expect(screen.queryByText("API key is valid.")).not.toBeInTheDocument();
    });
  });

  // ─── AI Validation section tests ──────────────────────────────────

  // The AI Validation section renders with its heading and the toggle button
  // when an Anthropic key is configured (configured === true).
  it("renders AI Validation section with toggle when Anthropic key is configured", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    // Section heading should be present inside the #ai-validation section
    const section = document.getElementById("ai-validation");
    expect(section).toBeInTheDocument();

    // The main toggle button should be enabled (not disabled) when key is configured
    const toggleBtn = screen.getByRole("button", { name: /AI Validation Mode/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).not.toBeDisabled();

    // It should show "Off" by default since aiValidationEnabled defaults to false
    expect(toggleBtn).toHaveTextContent("Off");
  });

  // When no Anthropic API key is configured, the AI Validation toggle should
  // be disabled and a warning message should appear.
  it("disables AI Validation toggle when Anthropic key is NOT configured", async () => {
    mockApi.getSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: false,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      updateChannel: "stable",
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key not configured");

    const toggleBtn = screen.getByRole("button", { name: /AI Validation Mode/i });
    expect(toggleBtn).toBeDisabled();

    // Warning message should be shown
    expect(
      screen.getByText("Configure an Anthropic API key above to enable AI validation."),
    ).toBeInTheDocument();
  });

  // Clicking the AI Validation Mode toggle should call updateSettings with
  // aiValidationEnabled set to the opposite of its current value.
  it("calls updateSettings with aiValidationEnabled when toggle is clicked", async () => {
    mockApi.updateSettings.mockResolvedValue({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      tunnelEnabled: false,
      aiValidationEnabled: true,
      aiValidationAutoApprove: true,
      aiValidationAutoDeny: true,
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByRole("button", { name: /AI Validation Mode/i }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ aiValidationEnabled: true });
    });
  });

  // When AI Validation is enabled (and Anthropic key is configured), the
  // auto-approve and auto-deny sub-toggles should appear.
  it("shows auto-approve and auto-deny sub-toggles when AI Validation is enabled", async () => {
    // Return settings with aiValidationEnabled: true so sub-toggles render
    mockApi.getSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      tunnelEnabled: false,
      aiValidationEnabled: true,
      aiValidationAutoApprove: true,
      aiValidationAutoDeny: true,
      updateChannel: "stable",
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    // Sub-toggles should be visible
    expect(screen.getByRole("button", { name: /Auto-approve safe tools/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Auto-deny dangerous tools/i })).toBeInTheDocument();
  });

  // Sub-toggles should NOT appear when AI Validation is disabled.
  it("hides auto-approve and auto-deny sub-toggles when AI Validation is disabled", async () => {
    mockApi.getSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      tunnelEnabled: false,
      aiValidationEnabled: false,
      aiValidationAutoApprove: true,
      aiValidationAutoDeny: true,
      updateChannel: "stable",
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    expect(screen.queryByRole("button", { name: /Auto-approve safe tools/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Auto-deny dangerous tools/i })).not.toBeInTheDocument();
  });

  // Clicking the auto-approve toggle should call updateSettings with the
  // aiValidationAutoApprove field toggled to the opposite value.
  it("calls updateSettings with aiValidationAutoApprove when auto-approve is toggled", async () => {
    mockApi.getSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      tunnelEnabled: false,
      aiValidationEnabled: true,
      aiValidationAutoApprove: true,
      aiValidationAutoDeny: true,
      updateChannel: "stable",
    });
    mockApi.updateSettings.mockResolvedValue({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      tunnelEnabled: false,
      aiValidationEnabled: true,
      aiValidationAutoApprove: false,
      aiValidationAutoDeny: true,
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    // Auto-approve is currently "On" (true), clicking should toggle to false
    fireEvent.click(screen.getByRole("button", { name: /Auto-approve safe tools/i }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ aiValidationAutoApprove: false });
    });
  });

  // Clicking the auto-deny toggle should call updateSettings with the
  // aiValidationAutoDeny field toggled to the opposite value.
  it("calls updateSettings with aiValidationAutoDeny when auto-deny is toggled", async () => {
    mockApi.getSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      tunnelEnabled: false,
      aiValidationEnabled: true,
      aiValidationAutoApprove: true,
      aiValidationAutoDeny: true,
      updateChannel: "stable",
    });
    mockApi.updateSettings.mockResolvedValue({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      tunnelEnabled: false,
      aiValidationEnabled: true,
      aiValidationAutoApprove: true,
      aiValidationAutoDeny: false,
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    // Auto-deny is currently "On" (true), clicking should toggle to false
    fireEvent.click(screen.getByRole("button", { name: /Auto-deny dangerous tools/i }));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ aiValidationAutoDeny: false });
    });
  });

  // When the API call in toggleAiValidation fails, the UI should revert
  // the optimistic update back to the original value.
  it("reverts AI Validation toggle on API failure", async () => {
    mockApi.updateSettings.mockRejectedValueOnce(new Error("network error"));

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const toggleBtn = screen.getByRole("button", { name: /AI Validation Mode/i });
    // Initially off
    expect(toggleBtn).toHaveTextContent("Off");

    // Click to enable — optimistic update sets it to "On"
    fireEvent.click(toggleBtn);

    // After the API rejects, the toggle should revert back to "Off"
    await waitFor(() => {
      expect(toggleBtn).toHaveTextContent("Off");
    });
  });

  // The AI Validation section includes its anchor ID for sidebar navigation.
  it("renders AI Validation section with anchor ID for navigation", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    expect(document.getElementById("ai-validation")).toBeInTheDocument();
  });

  // The AI Validation category appears in the sidebar navigation.
  it("includes AI Validation in category navigation", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    const aiValButtons = screen.getAllByRole("button", { name: "AI Validation" });
    expect(aiValButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Update Channel section tests ──────────────────────────────────

  // The update channel selector renders with Stable selected by default.
  it("renders update channel selector with Stable selected by default", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    expect(screen.getByText("Stable")).toBeInTheDocument();
    expect(screen.getByText("Prerelease")).toBeInTheDocument();
    expect(screen.getByText(/Tracking stable channel/)).toBeInTheDocument();
  });

  // When settings load with prerelease channel, it shows the prerelease description.
  it("shows prerelease description when channel is prerelease", async () => {
    mockApi.getSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      updateChannel: "prerelease",
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    expect(screen.getByText(/Tracking prerelease channel/)).toBeInTheDocument();
  });

  // Clicking Prerelease calls updateSettings and re-checks for updates.
  it("switches to prerelease channel and re-checks updates", async () => {
    mockApi.updateSettings.mockResolvedValueOnce({
      anthropicApiKeyConfigured: true,
      anthropicModel: "claude-sonnet-4.6",
      linearApiKeyConfigured: false,
      linearAutoTransition: false,
      linearAutoTransitionStateName: "",
      editorTabEnabled: false,
      updateChannel: "prerelease",
    });
    mockApi.forceCheckForUpdate.mockResolvedValueOnce({
      currentVersion: "0.66.0",
      latestVersion: "0.67.0-preview.1",
      updateAvailable: true,
      isServiceMode: false,
      updateInProgress: false,
      lastChecked: Date.now(),
      channel: "prerelease",
    });

    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByText("Prerelease"));

    await waitFor(() => {
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ updateChannel: "prerelease" });
    });
    await waitFor(() => {
      expect(mockApi.forceCheckForUpdate).toHaveBeenCalled();
    });
  });

  // Clicking Stable when already on stable is a no-op (doesn't call updateSettings).
  it("does not call updateSettings when clicking already-selected channel", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    fireEvent.click(screen.getByText("Stable"));

    // Should not have called updateSettings since stable is already selected
    expect(mockApi.updateSettings).not.toHaveBeenCalled();
  });

  // ── Tunnel section ───────────────────────────────────────────────────

  it("shows tunnel toggle in Off state by default", async () => {
    render(<SettingsPage />);
    const tunnelButton = await screen.findByText("Public Tunnel");
    // The Off label is inside the same button as "Public Tunnel"
    const button = tunnelButton.closest("button")!;
    expect(button.textContent).toContain("Off");
  });

  it("starts a tunnel and displays the URL when toggled on", async () => {
    mockApi.startTunnel.mockResolvedValue({
      url: "https://test-tunnel.trycloudflare.com",
      provider: "cloudflared",
    });

    render(<SettingsPage />);
    await screen.findByText("Public Tunnel");

    await act(async () => {
      fireEvent.click(screen.getByText("Public Tunnel").closest("button")!);
    });

    // URL should be displayed after starting
    await waitFor(() => {
      expect(screen.getByText("https://test-tunnel.trycloudflare.com")).toBeInTheDocument();
    });
    expect(screen.getByText("cloudflared")).toBeInTheDocument();
    expect(mockApi.startTunnel).toHaveBeenCalledTimes(1);
  });

  it("shows tunnel as On when status returns running", async () => {
    mockApi.getTunnelStatus.mockResolvedValue({
      state: "running",
      url: "https://existing-tunnel.trycloudflare.com",
      provider: "cloudflared",
      error: null,
    });

    render(<SettingsPage />);
    // Wait for the tunnel status to load and show On state
    await waitFor(() => {
      expect(screen.getByText("https://existing-tunnel.trycloudflare.com")).toBeInTheDocument();
    });
  });

  it("stops a running tunnel when toggled off", async () => {
    // Start with tunnel running
    mockApi.getTunnelStatus.mockResolvedValue({
      state: "running",
      url: "https://running.trycloudflare.com",
      provider: "cloudflared",
      error: null,
    });
    mockApi.stopTunnel.mockResolvedValue({ ok: true });

    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("https://running.trycloudflare.com")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Public Tunnel").closest("button")!);
    });

    expect(mockApi.stopTunnel).toHaveBeenCalledTimes(1);
    // URL should be gone after stopping
    await waitFor(() => {
      expect(screen.queryByText("https://running.trycloudflare.com")).not.toBeInTheDocument();
    });
  });

  it("shows error message when tunnel fails to start", async () => {
    mockApi.startTunnel.mockRejectedValue(new Error("No tunnel tool found"));

    render(<SettingsPage />);
    await screen.findByText("Public Tunnel");

    await act(async () => {
      fireEvent.click(screen.getByText("Public Tunnel").closest("button")!);
    });

    await waitFor(() => {
      expect(screen.getByText("No tunnel tool found")).toBeInTheDocument();
    });
  });

  // Verifies the "Create Apple Shortcut" button appears when tunnel is running
  it("shows Create Apple Shortcut button when tunnel is running", async () => {
    mockApi.getTunnelStatus.mockResolvedValue({
      state: "running",
      url: "https://shortcut-tunnel.trycloudflare.com",
      provider: "cloudflared",
      error: null,
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Create Apple Shortcut")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create Apple Shortcut").closest("button")!);
    expect(mockApi.downloadTunnelShortcut).toHaveBeenCalledTimes(1);
  });

  // ─── Tunnel connection test ──────────────────────────────────

  // Verifies the tunnel test button appears when tunnel is running and shows latency on success
  it("shows Test Tunnel button when tunnel is running and reports latency on success", async () => {
    mockApi.getTunnelStatus.mockResolvedValue({
      state: "running",
      url: "https://test-tunnel.trycloudflare.com",
      provider: "cloudflared",
      error: null,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());

    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Tunnel")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Test Tunnel"));
    });

    await waitFor(() => {
      expect(screen.getByText(/ms$/)).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://test-tunnel.trycloudflare.com", { method: "HEAD", mode: "no-cors" });
    fetchSpy.mockRestore();
  });

  // Verifies the tunnel test button shows error when fetch fails
  it("shows error when tunnel test fails", async () => {
    mockApi.getTunnelStatus.mockResolvedValue({
      state: "running",
      url: "https://fail-tunnel.trycloudflare.com",
      provider: "cloudflared",
      error: null,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Tunnel unreachable"));

    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Tunnel")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Test Tunnel"));
    });

    await waitFor(() => {
      expect(screen.getByText("Tunnel unreachable")).toBeInTheDocument();
    });
    fetchSpy.mockRestore();
  });

  // ─── Connection test section ──────────────────────────────────

  // Verifies the connection section renders with the test button and idle status indicator
  it("renders connection test button with idle status", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    expect(screen.getByText("Test Connection")).toBeInTheDocument();
    expect(screen.getByText("Not tested")).toBeInTheDocument();
    expect(document.getElementById("connection")).toBeInTheDocument();
  });

  // Verifies a successful connection test shows latency and green status
  it("shows connected status with latency after successful test", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    await act(async () => {
      fireEvent.click(screen.getByText("Test Connection"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Connected/)).toBeInTheDocument();
    });
    // getSettings is called both on mount and by the connection test
    expect(mockApi.getSettings).toHaveBeenCalledTimes(2);
  });

  // Verifies a failed connection test shows error message
  it("shows error status when connection test fails", async () => {
    render(<SettingsPage />);
    await screen.findByText("Anthropic key configured");

    // Make the next getSettings call fail (first one on mount already resolved)
    mockApi.getSettings.mockRejectedValueOnce(new Error("Network error"));

    await act(async () => {
      fireEvent.click(screen.getByText("Test Connection"));
    });

    await waitFor(() => {
      expect(screen.getByText("Failed")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});
