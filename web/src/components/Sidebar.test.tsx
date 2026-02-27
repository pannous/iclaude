// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { SessionState, SdkSessionInfo } from "../types.js";

// ─── Mock setup ──────────────────────────────────────────────────────────────

const mockConnectSession = vi.fn();
const mockConnectAllSessions = vi.fn();
const mockDisconnectSession = vi.fn();
const mockDisconnectAllExcept = vi.fn();

vi.mock("../ws.js", () => ({
  connectSession: (...args: unknown[]) => mockConnectSession(...args),
  connectAllSessions: (...args: unknown[]) => mockConnectAllSessions(...args),
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
    listPanels: () => Promise.resolve([]),
    listResumableSessions: () => Promise.resolve([]),
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
  // Support useStore.setState() which doArchive uses to update sessions map
  useStoreFn.setState = (partial: Partial<MockStoreState>) => {
    Object.assign(mockState, partial);
  };

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

  it("session items show project name in group header but not cwd path (grouped by project)", () => {
    // "myapp" appears in the project group header; cwd path removed from session row
    // because sessions are already grouped by project folder
    const session = makeSession("s1", { cwd: "/home/user/projects/myapp" });
    const sdk = makeSdkSession("s1", { title: "Test Session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    // Group header shows "myapp"
    const matches = screen.getAllByText("myapp");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Session row no longer shows the full cwd path (redundant with group header)
    expect(screen.queryByText("/home/user/projects/myapp")).not.toBeInTheDocument();
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
    const badge = screen.getByTitle("Docker");
    expect(badge).toBeInTheDocument();
    const dockerLogo = badge.querySelector('img[src="/logo-docker.svg"]');
    expect(dockerLogo).toBeInTheDocument();
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
    // There are two New Session buttons: desktop header + mobile FAB
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

  // ─── Polling & session name hydration ──────────────────────────────────────

  it("polls for SDK sessions on mount and hydrates session names", async () => {
    // Verifies that the Sidebar's useEffect poll() fetches sessions from the
    // API and calls setSdkSessions.
    // LOCAL: we call disconnectAllExcept (not connectAllSessions) — upstream calls connectAllSessions.
    // LOCAL: we only hydrate names when the session has no name yet (not random-name overwrite).
    const serverSessions = [
      makeSdkSession("s1", { name: "Server Name" }),
    ];
    mockApi.listSessions.mockResolvedValueOnce(serverSessions);

    mockState = createMockState();

    render(<Sidebar />);

    // Wait for the poll() promise to resolve
    await vi.waitFor(() => {
      expect(mockApi.listSessions).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(mockState.setSdkSessions).toHaveBeenCalledWith(serverSessions);
    });
    // LOCAL: connectAllSessions is NOT called — we use disconnectAllExcept instead
    expect(mockConnectAllSessions).not.toHaveBeenCalled();
    // LOCAL: setSessionName is called because s1 has no name in the store yet
    expect(mockState.setSessionName).toHaveBeenCalledWith("s1", "Server Name");
  });

  it("poll does not overwrite session name when store name is user-defined (not random)", async () => {
    // Verifies that server names do not overwrite user-typed session names.
    // Only random two-word names (e.g. "Alpha Beta") should be overwritten.
    const serverSessions = [
      makeSdkSession("s1", { name: "Server Name" }),
    ];
    mockApi.listSessions.mockResolvedValueOnce(serverSessions);

    // Store has a non-random name — should not be replaced
    mockState = createMockState({
      sessionNames: new Map([["s1", "My Custom Name"]]),
    });

    render(<Sidebar />);

    await vi.waitFor(() => {
      expect(mockApi.listSessions).toHaveBeenCalled();
    });
    // setSessionName should NOT be called since "My Custom Name" is not a random two-word name
    expect(mockState.setSessionName).not.toHaveBeenCalled();
  });

  it("poll hydrates name when store has no existing name for the session", async () => {
    // Verifies that poll() sets the session name when none exists in the store yet.
    const serverSessions = [
      makeSdkSession("s1", { name: "Fresh Name" }),
    ];
    mockApi.listSessions.mockResolvedValueOnce(serverSessions);

    mockState = createMockState({
      sessionNames: new Map(), // no names in store at all
    });

    render(<Sidebar />);

    await vi.waitFor(() => {
      expect(mockState.setSessionName).toHaveBeenCalledWith("s1", "Fresh Name");
    });
    // No random name existed, so markRecentlyRenamed should not be called
    expect(mockState.markRecentlyRenamed).not.toHaveBeenCalled();
  });

  it("poll gracefully handles API errors", async () => {
    // Verifies that when api.listSessions rejects, the Sidebar does not crash
    // and still renders correctly.
    mockApi.listSessions.mockRejectedValueOnce(new Error("server not ready"));

    render(<Sidebar />);

    // Should still render "No sessions yet." since the API call failed
    await vi.waitFor(() => {
      expect(mockApi.listSessions).toHaveBeenCalled();
    });
    expect(screen.getByText("No sessions yet.")).toBeInTheDocument();
  });

  // ─── Delete session flow ──────────────────────────────────────────────────

  it("shows delete confirmation modal when Delete is clicked from context menu", async () => {
    // LOCAL: no context menu — our code has a direct "Delete permanently" button on archived sessions.
    // No modal — deletions happen immediately via the direct button.
    // This test verifies that clicking "Delete permanently" calls the API.
    const sdk = makeSdkSession("s1", { archived: true, title: "deletable-session" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    render(<Sidebar />);

    // Expand archived section
    fireEvent.click(screen.getByText(/Archived \(1\)/));

    // Click the direct Delete permanently button (no context menu needed)
    const deleteBtn = screen.getByTitle("Delete permanently");
    fireEvent.click(deleteBtn);

    // LOCAL: no modal — deletion is immediate. Verify API was called.
    await vi.waitFor(() => {
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s1");
    });
    // No "Delete session?" modal in our code
    expect(screen.queryByText("Delete session?")).not.toBeInTheDocument();
  });

  it("confirming delete calls api.deleteSession, disconnectSession, and removeSession", async () => {
    // LOCAL: no context menu or modal — our code directly deletes via "Delete permanently" button.
    // Verifies the full delete flow: clicking the button calls through to API and cleans up store.
    const sdk = makeSdkSession("s1", { archived: true, title: "to-delete-session" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    render(<Sidebar />);

    // Expand archived and click direct delete button
    fireEvent.click(screen.getByText(/Archived \(1\)/));
    fireEvent.click(screen.getByTitle("Delete permanently"));

    await vi.waitFor(() => {
      expect(mockDisconnectSession).toHaveBeenCalledWith("s1");
    });
    expect(mockApi.deleteSession).toHaveBeenCalledWith("s1");
    expect(mockState.removeSession).toHaveBeenCalledWith("s1");
  });

  it("cancelling delete closes the modal without deleting", () => {
    // LOCAL: no modal exists for individual deletes — this test verifies that
    // the "Delete permanently" button IS present (delete is available) and
    // that no confirmation modal is shown (deletion is direct).
    const sdk = makeSdkSession("s1", { archived: true, title: "keep-me-session" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    render(<Sidebar />);

    // Expand archived section
    fireEvent.click(screen.getByText(/Archived \(1\)/));

    // Delete button should be present
    expect(screen.getByTitle("Delete permanently")).toBeInTheDocument();
    // LOCAL: no confirmation modal — deletion is direct, no "Delete session?" text
    expect(screen.queryByText("Delete session?")).not.toBeInTheDocument();
  });

  it("clicking modal backdrop cancels the delete", () => {
    // LOCAL: no modal exists for individual deletes — this test verifies that
    // there is no modal backdrop to click (deletion is direct, no confirmation step).
    const sdk = makeSdkSession("s1", { archived: true, title: "safe-session" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByText(/Archived \(1\)/));

    // LOCAL: no delete modal, so no fixed backdrop overlay for individual deletes
    // (The archive confirmation modal for containerized sessions has a different flow)
    expect(screen.queryByText("Delete session?")).not.toBeInTheDocument();
  });

  it("delete navigates home when the deleted session is the current one", async () => {
    // LOCAL: no context menu or modal — clicking "Delete permanently" navigates home.
    // Verifies that deleting the currently active session navigates the user back to home.
    const sdk = makeSdkSession("s1", { archived: true, title: "current-session" });
    mockState = createMockState({
      sdkSessions: [sdk],
      currentSessionId: "s1",
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByText(/Archived \(1\)/));
    fireEvent.click(screen.getByTitle("Delete permanently"));

    await vi.waitFor(() => {
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s1");
    });
    // navigateHome() clears the hash
    expect(window.location.hash).toBe("");
  });

  // ─── Delete all archived flow ──────────────────────────────────────────────

  it("shows 'Delete all' button when archived section is expanded with multiple sessions", () => {
    // LOCAL: our button says "Clear all" (not "Delete all") — same effect, no confirmation modal.
    // Verifies that the "Clear all" button appears when the archived section has sessions.
    const sdk1 = makeSdkSession("s1", { archived: true });
    const sdk2 = makeSdkSession("s2", { archived: true });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);

    // "Clear all" is always visible when there are archived sessions (alongside the Archived toggle)
    // LOCAL: our sidebar shows "Clear all" next to the archived section toggle, not inside the expanded list
    expect(screen.getByText("Clear all")).toBeInTheDocument();
  });

  it("clicking 'Delete all' shows confirmation modal for all archived sessions", () => {
    // LOCAL: our "Clear all" immediately deletes archived sessions without a confirmation modal.
    // This test verifies that "Clear all" button is present and clickable.
    const sdk1 = makeSdkSession("s1", { archived: true });
    const sdk2 = makeSdkSession("s2", { archived: true });
    const sdk3 = makeSdkSession("s3", { archived: false });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    render(<Sidebar />);
    // LOCAL: "Clear all" is always visible next to the archived toggle (no need to expand)
    expect(screen.getByText("Clear all")).toBeInTheDocument();
    // LOCAL: no confirmation modal exists — "Clear all" is direct (with no extra confirmation)
    expect(screen.queryByText("Delete all archived?")).not.toBeInTheDocument();
  });

  it("confirming delete-all deletes each archived session", async () => {
    // LOCAL: our "Clear all" directly calls api.deleteSession for each archived session
    // without a confirmation modal step.
    const sdk1 = makeSdkSession("s1", { archived: true });
    const sdk2 = makeSdkSession("s2", { archived: true });
    const sdk3 = makeSdkSession("s3", { archived: false });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByText("Clear all"));

    await vi.waitFor(() => {
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s1");
    });
    await vi.waitFor(() => {
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s2");
    });
    // Non-archived session should not be deleted
    expect(mockApi.deleteSession).not.toHaveBeenCalledWith("s3");
  });

  it("cancelling delete-all closes the modal without deleting", () => {
    // LOCAL: our "Clear all" button does NOT have a modal — it directly deletes.
    // This test verifies that the "Clear all" button is present in the archived section.
    const sdk1 = makeSdkSession("s1", { archived: true });
    const sdk2 = makeSdkSession("s2", { archived: true });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);
    // LOCAL: "Clear all" is always visible, no modal confirmation
    expect(screen.getByText("Clear all")).toBeInTheDocument();
    expect(screen.queryByText("Delete all archived?")).not.toBeInTheDocument();
  });

  // ─── Archive with container confirmation ───────────────────────────────────

  it("archiving a containerized session shows container warning confirmation", () => {
    // LOCAL: no context menu — our code has a direct "Archive session" button.
    // Verifies that archiving a containerized session triggers the container
    // archive confirmation panel warning about uncommitted changes.
    const session = makeSession("s1", { is_containerized: true });
    const sdk = makeSdkSession("s1", { containerId: "abc123", title: "containerized-session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);

    // Click the direct Archive button (no context menu needed)
    fireEvent.click(screen.getByTitle("Archive session"));

    // Container warning should appear
    expect(screen.getByText(/Archiving will/)).toBeInTheDocument();
    expect(screen.getByText(/remove the container/)).toBeInTheDocument();
  });

  it("confirming container archive calls api.archiveSession with force:true", async () => {
    // LOCAL: no context menu — click the direct "Archive session" button.
    // Verifies that confirming the container archive sends force:true to the API.
    const session = makeSession("s1", { is_containerized: true });
    const sdk = makeSdkSession("s1", { containerId: "abc123", title: "containerized-session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);

    // Trigger archive via direct button
    fireEvent.click(screen.getByTitle("Archive session"));

    // Click the "Archive" confirm button in the warning panel
    // (There are multiple "Archive" texts, find the one in the confirmation panel)
    const archiveConfirmBtn = screen.getAllByText("Archive").find(
      (el) => el.closest(".bg-amber-500\\/10") !== null,
    );
    expect(archiveConfirmBtn).toBeTruthy();
    fireEvent.click(archiveConfirmBtn!);

    await vi.waitFor(() => {
      expect(mockDisconnectSession).toHaveBeenCalledWith("s1");
    });
    expect(mockApi.archiveSession).toHaveBeenCalledWith("s1", { force: true });
  });

  it("cancelling container archive dismisses the warning", () => {
    // LOCAL: no context menu — click the direct "Archive session" button.
    // Verifies that clicking Cancel in the container archive confirmation
    // dismisses the warning without archiving.
    const session = makeSession("s1", { is_containerized: true });
    const sdk = makeSdkSession("s1", { containerId: "abc123", title: "containerized-session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByTitle("Archive session"));

    // Click Cancel in the warning panel
    const cancelBtn = screen.getAllByText("Cancel").find(
      (el) => el.closest(".bg-amber-500\\/10") !== null,
    );
    fireEvent.click(cancelBtn!);

    // Warning should be dismissed
    expect(screen.queryByText(/remove the container/)).not.toBeInTheDocument();
    expect(mockApi.archiveSession).not.toHaveBeenCalled();
  });

  it("archiving a non-containerized session archives directly without confirmation", async () => {
    // LOCAL: no context menu — click the direct "Archive session" button.
    // Verifies that archiving a regular (non-containerized) session proceeds
    // immediately without showing the container warning.
    const session = makeSession("s1", { is_containerized: false });
    const sdk = makeSdkSession("s1", { title: "non-containerized-session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByTitle("Archive session"));

    // Should NOT show container warning
    expect(screen.queryByText(/remove the container/)).not.toBeInTheDocument();

    // Should directly call archiveSession
    await vi.waitFor(() => {
      expect(mockDisconnectSession).toHaveBeenCalledWith("s1");
    });
    expect(mockApi.archiveSession).toHaveBeenCalledWith("s1", undefined);
  });

  it("archiving the current session navigates home and creates a new session", async () => {
    // LOCAL: no context menu — click the direct "Archive session" button.
    // Verifies that when the currently selected session is archived, the user
    // is redirected to the home page and a new session is started.
    const session = makeSession("s1", { is_containerized: false });
    const sdk = makeSdkSession("s1", { title: "current-session-to-archive" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
      currentSessionId: "s1",
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByTitle("Archive session"));

    await vi.waitFor(() => {
      expect(mockApi.archiveSession).toHaveBeenCalledWith("s1", undefined);
    });
    // Should navigate home
    expect(window.location.hash).toBe("");
    expect(mockState.newSession).toHaveBeenCalled();
  });

  // ─── Unarchive flow ────────────────────────────────────────────────────────

  it("clicking Restore on an archived session calls api.unarchiveSession", async () => {
    // LOCAL: no context menu — our code has a direct "Restore session" button on archived rows.
    // Verifies that clicking it calls the correct API endpoint and refreshes the sessions list.
    const sdk = makeSdkSession("s1", { archived: true, title: "restore-me-session" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByText(/Archived \(1\)/));

    // Click the direct Restore button (no context menu needed)
    fireEvent.click(screen.getByTitle("Restore session"));

    await vi.waitFor(() => {
      expect(mockApi.unarchiveSession).toHaveBeenCalledWith("s1");
    });
    // Should also refresh the sessions list
    expect(mockApi.listSessions).toHaveBeenCalled();
  });

  // ─── Cron sessions section ─────────────────────────────────────────────────

  it("renders Scheduled Runs section when cron sessions exist", () => {
    // Verifies that sessions with cronJobId are displayed in a separate
    // "Scheduled Runs" section with the correct count.
    const sdk1 = makeSdkSession("s1");
    const sdk2 = makeSdkSession("s2", { cronJobId: "cron-1", cronJobName: "Daily Build" });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);
    expect(screen.getByText(/Scheduled Runs \(1\)/)).toBeInTheDocument();
  });

  it("cron sessions are not shown in the active sessions list", () => {
    // LOCAL: sessions must have a title (not just a model name) to pass the ghost session filter.
    // Verifies that sessions with a cronJobId are excluded from the main
    // active sessions list and only appear under "Scheduled Runs".
    const sdk1 = makeSdkSession("s1", { title: "regular-session" });
    const sdk2 = makeSdkSession("s2", { title: "cron-session", cronJobId: "cron-1" });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);
    // regular-session should be in the main list
    expect(screen.getByText("regular-session")).toBeInTheDocument();
    // cron-session should appear under Scheduled Runs, not in main list
    expect(screen.getByText(/Scheduled Runs \(1\)/)).toBeInTheDocument();
  });

  it("toggling Scheduled Runs section hides/shows cron sessions", () => {
    // LOCAL: sessions must have a title to pass the ghost session filter.
    // Verifies that the Scheduled Runs section can be collapsed and expanded
    // via its toggle button.
    const sdk = makeSdkSession("s1", { title: "cron-model", cronJobId: "cron-1" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    // Initially expanded (showCronSessions defaults to true)
    expect(screen.getByText("cron-model")).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText(/Scheduled Runs \(1\)/));

    // Session should be hidden
    expect(screen.queryByText("cron-model")).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByText(/Scheduled Runs \(1\)/));
    expect(screen.getByText("cron-model")).toBeInTheDocument();
  });

  // ─── Agent sessions section ────────────────────────────────────────────────

  it("renders Agent Runs section when agent sessions exist", () => {
    // Verifies that sessions with agentId are displayed in a separate
    // "Agent Runs" section with the correct count.
    const sdk1 = makeSdkSession("s1");
    const sdk2 = makeSdkSession("s2", { agentId: "agent-1", agentName: "Code Reviewer" });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);
    expect(screen.getByText(/Agent Runs \(1\)/)).toBeInTheDocument();
  });

  it("agent sessions are separate from active sessions", () => {
    // LOCAL: sessions must have a title to pass the ghost session filter.
    // Verifies that sessions with agentId do not appear in the main active sessions list.
    const sdk1 = makeSdkSession("s1", { title: "normal" });
    const sdk2 = makeSdkSession("s2", { title: "agent-one", agentId: "agent-1" });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2],
    });

    render(<Sidebar />);
    expect(screen.getByText("normal")).toBeInTheDocument();
    expect(screen.getByText(/Agent Runs \(1\)/)).toBeInTheDocument();
  });

  it("toggling Agent Runs section hides/shows agent sessions", () => {
    // LOCAL: sessions must have a title to pass the ghost session filter.
    // LOCAL: showAgentSessions state starts false; the useEffect may auto-expand
    // it when agentSessions.length increases. To test the toggle reliably without
    // depending on prior state, we click the header to set a known expanded state,
    // then click to collapse, then click to expand again.
    // Note: we need at least one active session to prevent the "No sessions yet."
    // empty state from hiding the agent sessions section entirely.
    const sdkActive = makeSdkSession("s-active", { title: "active-model" });
    const sdk = makeSdkSession("s1", { title: "agent-model", agentId: "agent-1" });
    mockState = createMockState({
      sdkSessions: [sdkActive, sdk],
    });

    render(<Sidebar />);

    // Force expand by clicking until "agent-model" is visible
    const toggle = screen.getByText(/Agent Runs \(1\)/);
    // If not visible, expand; if visible, the section is already open
    if (!screen.queryByText("agent-model")) {
      fireEvent.click(toggle);
    }
    expect(screen.getByText("agent-model")).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(toggle);
    expect(screen.queryByText("agent-model")).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(toggle);
    expect(screen.getByText("agent-model")).toBeInTheDocument();
  });

  // ─── Footer nav: closeTerminal behavior ────────────────────────────────────

  it("clicking a non-terminal nav item calls closeTerminal", () => {
    // Verifies that clicking any nav item except Terminal calls closeTerminal()
    // to dismiss the terminal overlay.
    render(<Sidebar />);
    fireEvent.click(screen.getByTitle("Prompts"));
    expect(mockState.closeTerminal).toHaveBeenCalled();
  });

  it("clicking Terminal nav item does NOT call closeTerminal", () => {
    // Verifies that clicking the Terminal nav item does NOT call closeTerminal,
    // since the terminal should remain open when navigating to it.
    render(<Sidebar />);

    // Reset mocks from initial poll
    mockState.closeTerminal.mockClear();

    fireEvent.click(screen.getByTitle("Terminal"));
    expect(mockState.closeTerminal).not.toHaveBeenCalled();
  });

  it("New Session button calls closeTerminal", () => {
    // Verifies that clicking the New Session button closes any open terminal.
    render(<Sidebar />);
    const buttons = screen.getAllByTitle("New Session");
    fireEvent.click(buttons[0]);
    expect(mockState.closeTerminal).toHaveBeenCalled();
  });

  it("selecting a session calls closeTerminal", () => {
    // LOCAL: sessions need a title (not just model name) to pass the ghost session filter.
    // Verifies that clicking on a session item closes any open terminal.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: "My Terminal Session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const sessionButton = screen.getByText("My Terminal Session").closest("button")!;
    fireEvent.click(sessionButton);

    expect(mockState.closeTerminal).toHaveBeenCalled();
  });

  // ─── Footer nav: active state ──────────────────────────────────────────────

  it("footer nav button shows active state when on its page", () => {
    // Verifies that the footer nav button for the current page gets the
    // bg-cc-active class to indicate the user is on that page.
    window.location.hash = "#/settings";
    render(<Sidebar />);

    const settingsBtn = screen.getByTitle("Settings");
    expect(settingsBtn).toHaveClass("bg-cc-active");
  });

  it("integrations nav button shows active for both integrations and integration-linear pages", () => {
    // Verifies that the Integrations nav button correctly uses activePages
    // to highlight for sub-pages like integration-linear.
    window.location.hash = "#/integrations";
    render(<Sidebar />);

    const integrationsBtn = screen.getByTitle("Integrations");
    expect(integrationsBtn).toHaveClass("bg-cc-active");
  });

  // ─── Close sidebar button (mobile) ─────────────────────────────────────────

  it("renders a close sidebar button for mobile", () => {
    // Verifies that the mobile close sidebar button exists and calls
    // setSidebarOpen(false) when clicked.
    render(<Sidebar />);
    const closeBtn = screen.getByLabelText("Close sidebar");
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(mockState.setSidebarOpen).toHaveBeenCalledWith(false);
  });

  // ─── Logo source based on backend type ─────────────────────────────────────

  it("shows codex logo when current session uses codex backend", () => {
    // Verifies that the sidebar header logo changes to the Codex logo when
    // the currently selected session has backendType "codex".
    const sdk = makeSdkSession("s1", { backendType: "codex" });
    mockState = createMockState({
      sdkSessions: [sdk],
      currentSessionId: "s1",
    });

    const { container } = render(<Sidebar />);
    const logo = container.querySelector("img[src='/logo-codex.svg']");
    expect(logo).toBeTruthy();
  });

  it("shows default logo when current session uses claude backend", () => {
    // Verifies that the sidebar header logo is the default when the currently
    // selected session has backendType "claude".
    const sdk = makeSdkSession("s1", { backendType: "claude" });
    mockState = createMockState({
      sdkSessions: [sdk],
      currentSessionId: "s1",
    });

    const { container } = render(<Sidebar />);
    const logo = container.querySelector("img[src='/logo.svg']");
    expect(logo).toBeTruthy();
  });

  // ─── Delete modal inner click propagation ──────────────────────────────────

  it("clicking inside the delete modal does not dismiss it", () => {
    // LOCAL: no modal for individual session deletes — deletion is direct via "Delete permanently" button.
    // This test verifies that the archive confirmation modal (for containerized sessions)
    // does not dismiss when clicking inside it.
    const session = makeSession("s1", { is_containerized: true });
    const sdk = makeSdkSession("s1", { containerId: "abc123", title: "modal-test-session" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    // Open the container archive confirmation
    fireEvent.click(screen.getByTitle("Archive session"));

    // Click inside the warning panel content (not the backdrop)
    const warningContent = screen.getByText(/Archiving will/);
    fireEvent.click(warningContent);

    // Warning panel should still be open (click inside doesn't dismiss it)
    expect(screen.getByText(/Archiving will/)).toBeInTheDocument();
  });

  // ─── Rename via context menu ───────────────────────────────────────────────

  it("clicking Rename in context menu enters edit mode", () => {
    // LOCAL: no context menu — our code enters rename mode via double-click.
    // Verifies that double-clicking a session item enters the rename/edit mode.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: "rename-target" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    // LOCAL: rename is triggered by double-click, not a context menu "Rename" option
    fireEvent.doubleClick(screen.getByText("rename-target").closest("button")!);

    // An input field should appear with the current session label
    const input = screen.getByDisplayValue("rename-target");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  // ─── Rename calls api.renameSession ────────────────────────────────────────

  it("confirming rename also calls api.renameSession for server persistence", () => {
    // LOCAL: sessions need a title to pass the ghost session filter.
    // Verifies that after pressing Enter to confirm a rename, the Sidebar
    // also calls the API to persist the new name on the server.
    const session = makeSession("s1");
    const sdk = makeSdkSession("s1", { title: "original-name" });
    mockState = createMockState({
      sessions: new Map([["s1", session]]),
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    const sessionButton = screen.getByText("original-name").closest("button")!;
    fireEvent.doubleClick(sessionButton);

    const input = screen.getByDisplayValue("original-name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockApi.renameSession).toHaveBeenCalledWith("s1", "New Name");
  });

  // ─── Session with cron badge ───────────────────────────────────────────────

  it("session with cronJobId shows Scheduled badge", () => {
    // Verifies that a session with a cron job ID displays the scheduled clock badge.
    const sdk = makeSdkSession("s1", { cronJobId: "cron-1" });
    mockState = createMockState({
      sdkSessions: [sdk],
    });

    render(<Sidebar />);
    expect(screen.getByTitle("Scheduled")).toBeInTheDocument();
  });

  // ─── Delete all singular text ──────────────────────────────────────────────

  it("delete-all modal uses singular 'session' when only one archived session", async () => {
    // LOCAL: our "Clear all" button directly deletes without a modal — no "Delete all" text.
    // This test verifies that "Clear all" deletes multiple archived sessions.
    const sdk1 = makeSdkSession("s1", { archived: true, title: "archived-one" });
    const sdk2 = makeSdkSession("s2", { archived: true, title: "archived-two" });
    const sdk3 = makeSdkSession("s3", { archived: true, title: "archived-three" });
    mockState = createMockState({
      sdkSessions: [sdk1, sdk2, sdk3],
    });

    render(<Sidebar />);
    // LOCAL: button says "Clear all" not "Delete all", no confirmation modal
    expect(screen.getByText("Clear all")).toBeInTheDocument();
    expect(screen.queryByText("Delete all")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear all"));

    // All 3 archived sessions should be deleted
    await vi.waitFor(() => {
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s1");
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s2");
      expect(mockApi.deleteSession).toHaveBeenCalledWith("s3");
    });
  });
});
