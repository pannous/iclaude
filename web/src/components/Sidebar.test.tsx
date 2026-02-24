// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { SessionState, SdkSessionInfo } from "../types.js";

// ─── Mock setup ──────────────────────────────────────────────────────────────

const mockConnectSession = vi.fn();
const mockDisconnectSession = vi.fn();
const mockDisconnectAllExcept = vi.fn();

vi.mock("../ws.js", () => ({
  connectSession: (...args: unknown[]) => mockConnectSession(...args),
  disconnectSession: (...args: unknown[]) => mockDisconnectSession(...args),
  disconnectAllExcept: (...args: unknown[]) => mockDisconnectAllExcept(...args),
  waitForConnection: vi.fn().mockResolvedValue(undefined),
}));

const mockApi = {
  listSessions: vi.fn().mockResolvedValue([]),
  deleteSession: vi.fn().mockResolvedValue({}),
  archiveSession: vi.fn().mockResolvedValue({}),
  unarchiveSession: vi.fn().mockResolvedValue({}),
  renameSession: vi.fn().mockResolvedValue({}),
};

vi.mock("../api.js", () => ({
  api: {
    listSessions: (...args: unknown[]) => mockApi.listSessions(...args),
    deleteSession: (...args: unknown[]) => mockApi.deleteSession(...args),
    archiveSession: (...args: unknown[]) => mockApi.archiveSession(...args),
    unarchiveSession: (...args: unknown[]) => mockApi.unarchiveSession(...args),
    renameSession: (...args: unknown[]) => mockApi.renameSession(...args),
    listSkills: () => Promise.resolve([]),
  },
}));

// ─── Store mock helpers ──────────────────────────────────────────────────────

// We need to mock the store. The Sidebar uses `useStore((s) => s.xxx)` selector pattern.
// We'll provide a real-ish mock that supports selector calls.

interface MockStoreState {
  sessions: Map<string, SessionState>;
  sdkSessions: SdkSessionInfo[];
  currentSessionId: string | null;
  cliConnected: Map<string, boolean>;
  sessionStatus: Map<string, "idle" | "running" | "compacting" | null>;
  sessionNames: Map<string, string>;
  recentlyRenamed: Set<string>;
  pendingPermissions: Map<string, Map<string, unknown>>;
  sessionTasks: Map<string, unknown[]>;
  collapsedProjects: Set<string>;
  setCurrentSession: ReturnType<typeof vi.fn>;
  toggleProjectCollapse: ReturnType<typeof vi.fn>;
  removeSession: ReturnType<typeof vi.fn>;
  newSession: ReturnType<typeof vi.fn>;
  setSidebarOpen: ReturnType<typeof vi.fn>;
  setSessionName: ReturnType<typeof vi.fn>;
  markRecentlyRenamed: ReturnType<typeof vi.fn>;
  clearRecentlyRenamed: ReturnType<typeof vi.fn>;
  setSdkSessions: ReturnType<typeof vi.fn>;
  closeTerminal: ReturnType<typeof vi.fn>;
  setActiveTab: ReturnType<typeof vi.fn>;
  setAllProjectsCollapsed: ReturnType<typeof vi.fn>;
}

function makeSession(id: string, overrides: Partial<SessionState> = {}): SessionState {
  return {
    session_id: id,
    model: "claude-sonnet-4-6",
    cwd: "/home/user/projects/myapp",
    tools: [],
    permissionMode: "default",
    claude_code_version: "1.0",
    mcp_servers: [],
    agents: [],
    slash_commands: [],
    skills: [],
    total_cost_usd: 0,
    num_turns: 0,
    context_used_percent: 0,
    is_compacting: false,
    git_branch: "",
    is_worktree: false,
    is_containerized: false,
    repo_root: "",
    git_ahead: 0,
    git_behind: 0,
    total_lines_added: 0,
    total_lines_removed: 0,
    ...overrides,
  };
}

function makeSdkSession(id: string, overrides: Partial<SdkSessionInfo> = {}): SdkSessionInfo {
  return {
    sessionId: id,
    state: "connected",
    cwd: "/home/user/projects/myapp",
    createdAt: Date.now(),
    archived: false,
    title: overrides.title ?? `Session ${id}`,
    ...overrides,
  };
}

let mockState: MockStoreState;

function createMockState(overrides: Partial<MockStoreState> = {}): MockStoreState {
  return {
    sessions: new Map(),
    sdkSessions: [],
    currentSessionId: null,
    cliConnected: new Map(),
    sessionStatus: new Map(),
    sessionNames: new Map(),
    recentlyRenamed: new Set(),
    pendingPermissions: new Map(),
    sessionTasks: new Map(),
    collapsedProjects: new Set(),
    setCurrentSession: vi.fn(),
    toggleProjectCollapse: vi.fn(),
    removeSession: vi.fn(),
    newSession: vi.fn(),
    setSidebarOpen: vi.fn(),
    setSessionName: vi.fn(),
    markRecentlyRenamed: vi.fn(),
    clearRecentlyRenamed: vi.fn(),
    setSdkSessions: vi.fn(),
    closeTerminal: vi.fn(),
    setActiveTab: vi.fn(),
    setAllProjectsCollapsed: vi.fn(),
    ...overrides,
  };
}

// Mock the store module
vi.mock("../store.js", () => {
  // We create a function that acts like the zustand hook with selectors
  const useStoreFn = (selector: (state: MockStoreState) => unknown) => {
    return selector(mockState);
  };
  // Also support useStore.getState() which Sidebar uses directly
  useStoreFn.getState = () => mockState;

  return { useStore: useStoreFn };
});

// ─── Import component after mocks ───────────────────────────────────────────

import { Sidebar } from "./Sidebar.js";

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockState = createMockState();
  window.location.hash = "";
});

describe("Sidebar", () => {
  it("renders 'New' and 'Resume' buttons", () => {
    render(<Sidebar />);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Resume")).toBeInTheDocument();
  });

  it("renders 'No sessions yet.' when no sessions exist", () => {
    render(<Sidebar />);
    expect(screen.getByText("No sessions yet.")).toBeInTheDocument();
  });

  it("renders session items for active sessions", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: "My Active Session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    expect(screen.getByText("My Active Session")).toBeInTheDocument();
  });

  it("filters out ghost sessions that only have model name as title", () => {
    // Session with a real title — should be visible
    const session1 = makeSession("s1");
    const sdk1 = makeSdkSession("s1", { title: "Real Session" });

    // Ghost session with no title — should be filtered out
    const session2 = makeSession("s2", { model: "claude-opus-4-6" });
    const sdk2 = makeSdkSession("s2", { title: undefined, model: "claude-opus-4-6" });

    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2]]),
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);
    expect(screen.getByText("Real Session")).toBeInTheDocument();
    // Ghost session with only model name should not appear
    expect(screen.queryByText("claude-opus-4-6")).not.toBeInTheDocument();
  });

  it("filters out spam sessions matching blocklist patterns", () => {
    // Legitimate session — should be visible
    const session1 = makeSession("s1");
    const sdk1 = makeSdkSession("s1", { title: "Real Session" });

    // Spam session with secret.txt prompt — should be filtered out
    const session2 = makeSession("s2");
    const sdk2 = makeSdkSession("s2", { title: "read secret.txt and tell me the secret code" });

    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2]]),
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);
    expect(screen.getByText("Real Session")).toBeInTheDocument();
    expect(screen.queryByText(/secret\.txt/)).not.toBeInTheDocument();
  });

  it("session items show project name in group header (not in session row)", () => {
    const session = makeSession("s1", { cwd: "/home/user/projects/myapp" });
    const sdk = makeSdkSession("s1", { title: "Test Session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    // "myapp" appears in the project group header
    expect(screen.getByText("myapp")).toBeInTheDocument();
  });

  it("session items do not show git branch (removed in redesign)", () => {
    // Git branch was intentionally removed from session items in the sidebar redesign.
    // The data is still in the store but no longer rendered in the session row.
    const session = makeSession("s1", { git_branch: "feature/awesome" });
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    expect(screen.queryByText("feature/awesome")).not.toBeInTheDocument();
  });

  it("session items show container badge when is_containerized is true", () => {
    const session = makeSession("s1", { git_branch: "feature/docker", is_containerized: true });
    const sdk = makeSdkSession("s1", { containerId: "abc123" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    expect(screen.getByTitle("Docker")).toBeInTheDocument();
  });

  it("session items do not show git stats (removed in redesign)", () => {
    // Git ahead/behind and lines added/removed were intentionally removed
    // from session items in the sidebar redesign.
    const session = makeSession("s1", {
      git_branch: "main",
      git_ahead: 3,
      git_behind: 2,
      total_lines_added: 42,
      total_lines_removed: 7,
    });
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    expect(screen.queryByText("+42")).not.toBeInTheDocument();
    expect(screen.queryByText("-7")).not.toBeInTheDocument();
  });

  it("active session has highlighted styling (bg-cc-active class)", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      currentSessionId: "s1",
    });

    render(<Sidebar />);
    // Find the session button element (title takes priority over model)
    const sessionButton = screen.getByText("Session s1").closest("button");
    expect(sessionButton).toHaveClass("bg-cc-active");
  });

  it("clicking a session navigates to the session hash", () => {
    // Sidebar now delegates to URL-based routing: it sets the hash to #/session/{id}
    // and App.tsx's hash effect handles setCurrentSession + connectSession
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      currentSessionId: null,
    });

    render(<Sidebar />);
    const sessionButton = screen.getByText("Session s1").closest("button")!
    fireEvent.click(sessionButton);

    expect(window.location.hash).toBe("#/session/s1");
  });

  it("New Session button calls newSession", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText("New"));

    expect(mockState.newSession).toHaveBeenCalled();
  });

  it("double-clicking a session enters edit mode", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const sessionButton = screen.getByText("Session s1").closest("button")!
    fireEvent.doubleClick(sessionButton);

    // After double-click, an input should appear for renaming
    const input = screen.getByDisplayValue("Session s1");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("archive button exists directly on active session items", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const archiveButton = screen.getByTitle("Archive session");
    expect(archiveButton).toBeInTheDocument();
  });

  it("archive button is directly visible on active sessions without clicking a menu", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const archiveButton = screen.getByTitle("Archive session");
    expect(archiveButton).toBeInTheDocument();
    expect(screen.queryByTitle("Session actions")).not.toBeInTheDocument();
  });

  it("archive button is dimmed by default and brightens on hover", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const archiveButton = screen.getByTitle("Archive session");

    expect(archiveButton).toHaveClass("opacity-30");
    expect(archiveButton).toHaveClass("hover:opacity-100");
  });

  it("pending permissions render a yellow awaiting status dot", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      pendingPermissions: new Map([["s1", new Map([["p1", {}]])]]),
      cliConnected: new Map([["s1", true]]),
    });

    render(<Sidebar />);
    const awaitingDot = document.querySelector(".bg-cc-warning.animate-\\[ring-pulse_1\\.5s_ease-out_infinite\\]");
    expect(awaitingDot).toBeTruthy();
  });

  it("archived sessions section shows count", () => {
    const sdk1 = makeSdkSession("s1", { archived: false });
    const sdk2 = makeSdkSession("s2", { archived: true });
    const sdk3 = makeSdkSession("s3", { archived: true });

    mockState = createMockState({
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    render(<Sidebar />);
    // The component renders "Archived (2)"
    expect(screen.getByText(/Archived \(2\)/)).toBeInTheDocument();
  });

  it("toggle archived shows/hides archived sessions", () => {
    const sdk1 = makeSdkSession("s1", { archived: false, title: "Active Session" });
    const sdk2 = makeSdkSession("s2", { archived: true, title: "Archived Session" });

    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);

    // Archived sessions should not be visible initially
    expect(screen.queryByText("Archived Session")).not.toBeInTheDocument();

    // Click the archived toggle button
    const toggleButton = screen.getByText(/Archived \(1\)/);
    fireEvent.click(toggleButton);

    // Now the archived session should be visible
    expect(screen.getByText("Archived Session")).toBeInTheDocument();
  });

  it("does not render settings controls directly in sidebar", () => {
    render(<Sidebar />);
    expect(screen.queryByText("Notification")).not.toBeInTheDocument();
    expect(screen.queryByText("Dark mode")).not.toBeInTheDocument();
  });

  it("navigates to environments page when Environments is clicked", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTitle("Environments"));
    expect(window.location.hash).toBe("#/environments");
  });

  it("navigates to settings page when Settings is clicked", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTitle("Settings"));
    expect(window.location.hash).toBe("#/settings");
  });

  it("navigates to integrations page when Integrations is clicked", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTitle("Integrations"));
    expect(window.location.hash).toBe("#/integrations");
  });

  it("navigates to prompts page when Prompts is clicked", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTitle("Prompts"));
    expect(window.location.hash).toBe("#/prompts");
  });

  it("navigates to terminal page when Terminal is clicked", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByTitle("Terminal"));
    expect(window.location.hash).toBe("#/terminal");
  });

  it("session name shows animate-name-appear class when recently renamed", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: undefined });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      sessionNames: new Map([["s1", "Auto Generated Title"]]),
      recentlyRenamed: new Set(["s1"]),
    });

    render(<Sidebar />);
    const nameElement = screen.getByText("Auto Generated Title");
    // Animation class is on the parent span wrapper, not the inner text span
    expect(nameElement.closest(".animate-name-appear")).toBeTruthy();
  });

  it("session name does NOT have animate-name-appear when not recently renamed", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: undefined });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      sessionNames: new Map([["s1", "Regular Name"]]),
      recentlyRenamed: new Set(), // not recently renamed
    });

    render(<Sidebar />);
    const nameElement = screen.getByText("Regular Name");
    expect(nameElement.className).not.toContain("animate-name-appear");
  });

  it("calls clearRecentlyRenamed on animation end", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: undefined });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      sessionNames: new Map([["s1", "Animated Name"]]),
      recentlyRenamed: new Set(["s1"]),
    });

    const { container } = render(<Sidebar />);
    // The animated span has the animate-name-appear class and an onAnimationEnd
    // handler that calls onClearRecentlyRenamed(sessionId).
    const animatedSpan = container.querySelector(".animate-name-appear");
    expect(animatedSpan).toBeTruthy();

    // JSDOM does not define AnimationEvent in all environments, which
    // causes fireEvent.animationEnd to silently fail. We traverse the
    // React fiber tree to invoke the onAnimationEnd handler directly.
    const fiberKey = Object.keys(animatedSpan!).find((k) =>
      k.startsWith("__reactFiber$"),
    );
    expect(fiberKey).toBeDefined();
    let fiber = (animatedSpan as unknown as Record<string, unknown>)[fiberKey!] as Record<string, unknown> | null;
    let called = false;
    while (fiber) {
      const props = fiber.memoizedProps as Record<string, unknown> | undefined;
      if (props?.onAnimationEnd) {
        (props.onAnimationEnd as () => void)();
        called = true;
        break;
      }
      fiber = fiber.return as Record<string, unknown> | null;
    }
    expect(called).toBe(true);
    expect(mockState.clearRecentlyRenamed).toHaveBeenCalledWith("s1");
  });

  it("animation class applies only to the recently renamed session, not others", () => {
    const session1 = makeSession("s1");
    const session2 = makeSession("s2");
    const sdk1 = makeSdkSession("s1", { title: undefined });
    const sdk2 = makeSdkSession("s2", { title: undefined });
    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2]]),
      sdkSessions: [sdk1, sdk2],
      sessionNames: new Map([["s1", "Renamed Session"], ["s2", "Other Session"]]),
      recentlyRenamed: new Set(["s1"]), // only s1 was renamed
    });

    render(<Sidebar />);
    const renamedElement = screen.getByText("Renamed Session");
    const otherElement = screen.getByText("Other Session");

    // Animation class is on the parent span wrapper, not the inner text span
    expect(renamedElement.closest(".animate-name-appear")).toBeTruthy();
    expect(otherElement.closest(".animate-name-appear")).toBeFalsy();
  });

  it("session keeps awaiting state with multiple pending permissions", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    const permMap = new Map<string, unknown>([
      ["r1", { request_id: "r1", tool_name: "Bash" }],
      ["r2", { request_id: "r2", tool_name: "Read" }],
    ]);
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      pendingPermissions: new Map([["s1", permMap as Map<string, unknown>]]),
      cliConnected: new Map([["s1", true]]),
    });

    render(<Sidebar />);
    const awaitingDot = document.querySelector(".bg-cc-warning.animate-\\[ring-pulse_1\\.5s_ease-out_infinite\\]");
    expect(awaitingDot).toBeTruthy();
  });

  it("archived session row is clickable after opening archived section", () => {
    const sdk = makeSdkSession("s1", { archived: true, title: "archived-clickable" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByText(/Archived \(1\)/));

    const archivedRowButton = screen.getByText("archived-clickable").closest("button");
    expect(archivedRowButton).toBeInTheDocument();
    if (!archivedRowButton) throw new Error("Archived row button not found");

    fireEvent.click(archivedRowButton);
    expect(window.location.hash).toBe("#/session/s1");
  });

  it("session does not render git data from sdkInfo (redesign removes git display)", () => {
    // Git branch and stats are no longer rendered in the session row.
    // The data still flows through the store but is not displayed.
    const sdk = makeSdkSession("s1", {
      gitBranch: "feature/from-rest",
      gitAhead: 5,
      gitBehind: 2,
      totalLinesAdded: 100,
      totalLinesRemoved: 20,
    });
    mockState = createMockState({
      sessions: new Map(),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    expect(screen.queryByText("feature/from-rest")).not.toBeInTheDocument();
    expect(screen.queryByText("+100")).not.toBeInTheDocument();
    expect(screen.queryByText("-20")).not.toBeInTheDocument();
  });

  it("codex session renders without backend badge", () => {
    const sdk = makeSdkSession("s1", { backendType: "codex" });
    mockState = createMockState({
      sessions: new Map(),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    // Backend badges (CC/CX) were removed — session items show status dot + name only
    expect(screen.queryByText("CX")).not.toBeInTheDocument();
    expect(screen.queryByText("CC")).not.toBeInTheDocument();
  });

  it("session shows correct backend badge based on backendType", () => {
    // Backend badges were removed in favour of a cleaner layout.
    // Docker and Cron badges still render.
    const session1 = makeSession("s1", { backend_type: "claude" });
    const session2 = makeSession("s2", { backend_type: "codex" });
    const sdk1 = makeSdkSession("s1", { backendType: "claude" });
    const sdk2 = makeSdkSession("s2", { backendType: "codex" });
    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2]]),
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);
    expect(screen.queryByText("CC")).not.toBeInTheDocument();
    expect(screen.queryByText("CX")).not.toBeInTheDocument();
  });

  it("sessions are grouped by project directory", () => {
    const session1 = makeSession("s1", { cwd: "/home/user/project-a" });
    const session2 = makeSession("s2", { cwd: "/home/user/project-a" });
    const session3 = makeSession("s3", { cwd: "/home/user/project-b" });
    const sdk1 = makeSdkSession("s1", { cwd: "/home/user/project-a" });
    const sdk2 = makeSdkSession("s2", { cwd: "/home/user/project-a" });
    const sdk3 = makeSdkSession("s3", { cwd: "/home/user/project-b" });
    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2], ["s3", session3]]),
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    render(<Sidebar />);
    // Project group headers should be visible (also appears as dirName in session items)
    expect(screen.getAllByText("project-a").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("project-b").length).toBeGreaterThanOrEqual(1);
  });

  it("project group header shows running status dot and session count", () => {
    const session1 = makeSession("s1", { cwd: "/home/user/myapp" });
    const session2 = makeSession("s2", { cwd: "/home/user/myapp" });
    const sdk1 = makeSdkSession("s1", { cwd: "/home/user/myapp" });
    const sdk2 = makeSdkSession("s2", { cwd: "/home/user/myapp" });
    mockState = createMockState({
      sessions: new Map([["s1", session1], ["s2", session2]]),
      sdkSessions: [sdk1, sdk2],
      sessionStatus: new Map([["s1", "running"], ["s2", "running"]]),
    });

    render(<Sidebar />);
    // Status dot with title "2 running" should be present
    expect(screen.getByTitle("2 running")).toBeInTheDocument();
    // Session count badge should show "2"
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("collapsing a project group hides its session items but shows a preview", () => {
    const session = makeSession("s1", { cwd: "/home/user/myapp" });
    const sdk = makeSdkSession("s1", { cwd: "/home/user/myapp", title: "Hidden Session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      collapsedProjects: new Set(["/home/user/myapp"]),
    });

    render(<Sidebar />);
    // Group header should still be visible
    expect(screen.getByText("myapp")).toBeInTheDocument();
    // The session button itself should not be present (no clickable session row)
    const sessionButtons = screen.getAllByRole("button");
    const sessionRowButton = sessionButtons.find((btn) =>
      btn.textContent?.includes("Hidden Session") && btn.classList.contains("rounded-lg"),
    );
    expect(sessionRowButton).toBeUndefined();
    // But a collapsed preview text should appear with the session name
    const previewElement = screen.getByText("Hidden Session");
    expect(previewElement).toBeInTheDocument();
    expect(previewElement.className).toContain("text-cc-muted/70");
  });

  it("context menu shows restore and delete for archived sessions", () => {
    const sdk1 = makeSdkSession("s1", { archived: false, title: "active-model" });
    const sdk2 = makeSdkSession("s2", { archived: true, title: "archived-model" });

    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);

    // Expand the archived section first
    const toggleButton = screen.getByText(/Archived \(1\)/);
    fireEvent.click(toggleButton);

    // Archived sessions show direct Restore and Delete icon buttons (no menu needed)
    expect(screen.getByTitle("Restore session")).toBeInTheDocument();
    expect(screen.getByTitle("Delete permanently")).toBeInTheDocument();
    // The active session has an Archive button; the archived one does not
    expect(screen.getByTitle("Archive session")).toBeInTheDocument();
    expect(screen.queryByTitle("Session actions")).not.toBeInTheDocument();
  });

  it("session item does not show timestamp (removed in redesign)", () => {
    // Timestamps were intentionally removed from session items in the sidebar
    // redesign to reduce visual clutter.
    const now = Date.now();
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { createdAt: now - 3600000 }); // 1 hour ago
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    expect(screen.queryByText("1h ago")).not.toBeInTheDocument();
  });

  it("footer nav uses a 3x2 grid layout with short labels", () => {
    const { container } = render(<Sidebar />);
    // The grid container should exist
    const gridElement = container.querySelector(".grid.grid-cols-3");
    expect(gridElement).toBeTruthy();
    // Short labels should be visible
    expect(screen.getByText("Envs")).toBeInTheDocument();
    expect(screen.getByText("Integr.")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("session item has minimum touch target height", () => {
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const sessionButton = screen.getByText("Session s1").closest("button");
    // The button should have min-h-[44px] class for touch accessibility
    expect(sessionButton).toHaveClass("min-h-[44px]");
  });

  it("Enter confirms rename in edit mode", () => {
    // Verifies that pressing Enter in the rename input commits the name change
    // via the store's setSessionName action.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: "My Task" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const sessionButton = screen.getByText("My Task").closest("button")!;
    fireEvent.doubleClick(sessionButton);

    const input = screen.getByDisplayValue("My Task") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "My Session" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // After Enter, the rename should be confirmed via the store action
    expect(mockState.setSessionName).toHaveBeenCalledWith("s1", "My Session");
  });

  it("Escape cancels rename in edit mode", () => {
    // Verifies that pressing Escape reverts the rename without saving.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: "My Task" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const sessionButton = screen.getByText("My Task").closest("button")!;
    fireEvent.doubleClick(sessionButton);

    const input = screen.getByDisplayValue("My Task") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Should Not Save" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // After Escape, setSessionName should not be called — the rename was cancelled
    expect(mockState.setSessionName).not.toHaveBeenCalled();
  });

  it("long session names are truncated with the truncate class", () => {
    // Verifies that a very long session name does not cause horizontal overflow.
    const longName = "A".repeat(200);
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: longName });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const nameEl = screen.getByText(longName);
    // The name should use the truncate utility class to prevent overflow
    expect(nameEl).toHaveClass("truncate");
  });

  it("footer nav buttons have title attributes for accessibility", () => {
    // Verifies footer nav buttons have title attributes for tooltip/screen reader support.
    render(<Sidebar />);
    // Footer nav items should have descriptive titles from NAV_ITEMS
    expect(screen.getByTitle("Prompts")).toBeInTheDocument();
    expect(screen.getByTitle("Integrations")).toBeInTheDocument();
    expect(screen.getByTitle("Settings")).toBeInTheDocument();
  });

  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1");
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });
    const { container } = render(<Sidebar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
