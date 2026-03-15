
// @vitest-environment jsdom
/**
 * Tests for SessionItem — focusing on title rendering safety and core functionality.
 *
 * Key concern: session titles that leaked XML system tags (e.g. <local-command-caveat>)
 * from the CLI must never reach the DOM as raw tag text.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createRef, type ComponentProps } from "react";
import { SessionItem } from "./SessionItem.js";
import type { SessionItem as SessionItemType } from "../utils/project-grouping.js";

function makeSession(overrides: Partial<SessionItemType> = {}): SessionItemType {
  return {
    id: "session-1",
    model: "claude-sonnet-4-6",
    cwd: "/workspace/app",
    gitBranch: "",
    isContainerized: false,
    gitAhead: 0,
    gitBehind: 0,
    linesAdded: 0,
    linesRemoved: 0,
    isConnected: true,
    status: "running",
    sdkState: "connected",
    createdAt: Date.now(),
    archived: false,
    permCount: 0,
    backendType: "claude",
    repoRoot: "/workspace/app",
    cronJobId: undefined,
    title: undefined,
    agentName: undefined,
    agentId: undefined,
    isWorktree: false,
    ...overrides,
  };
}

function buildProps(overrides: Partial<ComponentProps<typeof SessionItem>> = {}): ComponentProps<typeof SessionItem> {
  return {
    session: makeSession(),
    isActive: false,
    isArchived: false,
    sessionName: undefined,
    permCount: 0,
    isRecentlyRenamed: false,
    onSelect: vi.fn(),
    onStartRename: vi.fn(),
    onArchive: vi.fn(),
    onUnarchive: vi.fn(),
    onDelete: vi.fn(),
    onClearRecentlyRenamed: vi.fn(),
    editingSessionId: null,
    editingName: "",
    setEditingName: vi.fn(),
    onConfirmRename: vi.fn(),
    onCancelRename: vi.fn(),
    editInputRef: createRef<HTMLInputElement>(),
    ...overrides,
  };
}

describe("SessionItem", () => {
  it("renders the session label and cwd", () => {
    // Validates the primary row content users rely on to identify sessions.
    // LOCAL: cwd is not shown in the session row — sessions are grouped by project in sidebar,
    // so the path is redundant and was removed from the row display.
    render(<SessionItem {...buildProps()} />);

    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument();
    // cwd not displayed in our LOCAL version (sessions already grouped by project folder)
    expect(screen.queryByText("/workspace/app")).not.toBeInTheDocument();
  });

  it("renders the Docker logo asset when session is containerized", () => {
    // Regression guard for THE-195: keep using the transparent Docker logo asset.
    render(<SessionItem {...buildProps({ session: makeSession({ isContainerized: true }) })} />);

    expect(screen.getByTitle("Docker")).toBeInTheDocument();
    const dockerLogo = screen.getByAltText("Docker logo");
    expect(dockerLogo).toHaveAttribute("src", "/logo-docker.svg");
  });

  it("enters rename flow on double-click", () => {
    // Confirms the interaction contract used by Sidebar for inline rename.
    const onStartRename = vi.fn();
    render(<SessionItem {...buildProps({ onStartRename })} />);

    fireEvent.doubleClick(screen.getByRole("button", { name: /claude-sonnet-4-6/i }));

    expect(onStartRename).toHaveBeenCalledWith("session-1", "claude-sonnet-4-6");
  });

  it("renders a clean title normally", () => {
    render(<SessionItem {...buildProps({ session: makeSession({ title: "Fix the auth bug" }) })} />);
    expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
  });

  it("strips <local-command-caveat> tag from title before rendering", () => {
    // This is the exact format that leaked from the CLI — tag with no closing counterpart
    const brokenTitle = "<local-command-caveat>Caveat: The messages below were generated";
    render(<SessionItem {...buildProps({ session: makeSession({ title: brokenTitle }) })} />);

    // The tag itself must never appear in the DOM
    expect(screen.queryByText(/<local-command-caveat>/)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("<local-command-caveat>");

    // The clean text content should be visible instead
    expect(screen.getByText(/Caveat: The messages below were generated/)).toBeInTheDocument();
  });

  it("strips a fully closed <local-command-caveat>…</local-command-caveat> block", () => {
    const brokenTitle =
      "<local-command-caveat>DO NOT RESPOND TO THESE</local-command-caveat> Fix the real bug";
    render(<SessionItem {...buildProps({ session: makeSession({ title: brokenTitle }) })} />);
    expect(document.body.innerHTML).not.toContain("<local-command-caveat>");
    expect(screen.getByText(/Fix the real bug/)).toBeInTheDocument();
  });

  it("falls back to model name when title and sessionName are absent", () => {
    // Fallback priority: cleanTitle → sessionName → model → shortId
    render(<SessionItem {...buildProps({ session: makeSession({ title: undefined }) })} />);
    expect(screen.getByText(/claude-sonnet-4-6/)).toBeInTheDocument();
  });

  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    const { container } = render(<SessionItem {...buildProps()} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // --- Status dot rendering ---

  it("shows running status dot when session is running and connected", () => {
    // Ensures the animated success dot appears for actively running sessions.
    const { container } = render(<SessionItem {...buildProps()} />);
    expect(container.querySelector(".bg-cc-success")).toBeTruthy();
  });

  it("shows awaiting status dot when session has pending permissions", () => {
    // Verifies the warning dot appears when permissions need approval.
    const { container } = render(
      <SessionItem {...buildProps({ session: makeSession({ permCount: 2 }), permCount: 2 })} />,
    );
    expect(container.querySelector(".bg-cc-warning")).toBeTruthy();
  });

  it("shows idle status dot when connected but not running", () => {
    // Idle sessions should show a muted dot.
    const { container } = render(
      <SessionItem {...buildProps({ session: makeSession({ status: "idle" }) })} />,
    );
    expect(container.querySelector(".bg-cc-muted\\/40")).toBeTruthy();
  });

  it("shows exited status dot when not connected", () => {
    // Disconnected sessions show an outlined ring instead of a filled dot.
    const { container } = render(
      <SessionItem {...buildProps({ session: makeSession({ isConnected: false }) })} />,
    );
    expect(container.querySelector(".border-cc-muted\\/25")).toBeTruthy();
  });

  // --- Backend badge ---
  // LOCAL: CC/CX backend badges were removed from SessionItem in this fork.
  // Sessions are distinguished by other visual cues (status dot, project grouping).

  // --- Cron badge ---

  it("shows scheduled badge when session has a cronJobId", () => {
    render(<SessionItem {...buildProps({ session: makeSession({ cronJobId: "cron-123" }) })} />);
    expect(screen.getByTitle("Scheduled")).toBeInTheDocument();
  });

  // --- Active state styling ---

  it("applies active background class when isActive is true", () => {
    // The active session should have a visually distinct background.
    const { container } = render(<SessionItem {...buildProps({ isActive: true })} />);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-cc-active");
  });

  // --- F2 shortcut ---

  it("triggers rename on F2 keypress", () => {
    // F2 is a standard shortcut for rename in file managers.
    const onStartRename = vi.fn();
    render(<SessionItem {...buildProps({ onStartRename })} />);

    const btn = screen.getByRole("button", { name: /claude-sonnet-4-6/i });
    fireEvent.keyDown(btn, { key: "F2" });

    expect(onStartRename).toHaveBeenCalledWith("session-1", "claude-sonnet-4-6");
  });

  // --- Editing mode ---

  it("shows input when in editing mode and handles Enter to confirm", () => {
    // Editing mode replaces the label with an input; Enter confirms the rename.
    const onConfirmRename = vi.fn();
    render(
      <SessionItem
        {...buildProps({
          editingSessionId: "session-1",
          editingName: "new name",
          onConfirmRename,
        })}
      />,
    );

    const input = screen.getByDisplayValue("new name");
    expect(input).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onConfirmRename).toHaveBeenCalled();
  });

  it("handles Escape in editing mode to cancel rename", () => {
    // Escape aborts the rename without saving changes.
    const onCancelRename = vi.fn();
    render(
      <SessionItem
        {...buildProps({
          editingSessionId: "session-1",
          editingName: "new name",
          onCancelRename,
        })}
      />,
    );

    const input = screen.getByDisplayValue("new name");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCancelRename).toHaveBeenCalled();
  });

  it("calls setEditingName on input change", () => {
    // Verifies two-way binding of the editing input.
    const setEditingName = vi.fn();
    render(
      <SessionItem
        {...buildProps({
          editingSessionId: "session-1",
          editingName: "old",
          setEditingName,
        })}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("old"), { target: { value: "new" } });
    expect(setEditingName).toHaveBeenCalledWith("new");
  });

  // --- Direct action buttons (LOCAL: replaces upstream's three-dot context menu) ---

  it("shows archive button for non-archived sessions", () => {
    // The direct archive button is always visible for active sessions.
    render(<SessionItem {...buildProps()} />);
    expect(screen.getByTitle("Archive session")).toBeInTheDocument();
  });

  it("shows restore and delete buttons for archived sessions", () => {
    // Archived sessions show restore and delete buttons instead of archive.
    render(<SessionItem {...buildProps({ isArchived: true })} />);
    expect(screen.getByTitle("Restore session")).toBeInTheDocument();
    expect(screen.getByTitle("Delete permanently")).toBeInTheDocument();
    expect(screen.queryByTitle("Archive session")).not.toBeInTheDocument();
  });

  it("calls onArchive when archive button is clicked", () => {
    const onArchive = vi.fn();
    render(<SessionItem {...buildProps({ onArchive })} />);
    fireEvent.click(screen.getByTitle("Archive session"));
    expect(onArchive).toHaveBeenCalled();
  });

  it("calls onUnarchive when restore button is clicked", () => {
    const onUnarchive = vi.fn();
    render(<SessionItem {...buildProps({ isArchived: true, onUnarchive })} />);
    fireEvent.click(screen.getByTitle("Restore session"));
    expect(onUnarchive).toHaveBeenCalled();
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(<SessionItem {...buildProps({ isArchived: true, onDelete })} />);
    fireEvent.click(screen.getByTitle("Delete permanently"));
    expect(onDelete).toHaveBeenCalled();
  });

  // --- Label fallback ---

  it("falls back to short ID when no session name or model", () => {
    // When sessionName and model are absent, the 8-char session ID prefix is shown.
    render(
      <SessionItem
        {...buildProps({
          session: makeSession({ id: "abcdef1234567890", model: "" }),
          sessionName: undefined,
        })}
      />,
    );

    expect(screen.getByText("abcdef12")).toBeInTheDocument();
  });

  it("prefers sessionName over model", () => {
    // An explicit session name takes priority over the model name.
    render(<SessionItem {...buildProps({ sessionName: "My Custom Name" })} />);
    expect(screen.getByText("My Custom Name")).toBeInTheDocument();
  });

  // --- Archive button visibility ---
  // LOCAL: archive button tests are covered above in "Direct action buttons" section.

  // --- Recently renamed animation ---

  it("applies name-appear animation for recently renamed sessions", () => {
    // The label gets a reveal animation after being renamed.
    const { container } = render(
      <SessionItem {...buildProps({ isRecentlyRenamed: true })} />,
    );

    const label = container.querySelector(".animate-name-appear");
    expect(label).toBeTruthy();
  });

  // --- Archived forces exited status ---

  it("forces exited status when isArchived is true regardless of session state", () => {
    // Archived sessions always show as exited even if technically connected.
    const { container } = render(
      <SessionItem
        {...buildProps({
          isArchived: true,
          session: makeSession({ isConnected: true, status: "running" }),
        })}
      />,
    );
    // Should show exited dot (border only, no fill)
    expect(container.querySelector(".border-cc-muted\\/25")).toBeTruthy();
  });

  // LOCAL: no context menu — click-outside test removed (direct action buttons don't need it).

  // --- onSelect click ---

  it("calls onSelect when session button is clicked", () => {
    // Single click navigates to the session.
    const onSelect = vi.fn();
    render(<SessionItem {...buildProps({ onSelect })} />);

    fireEvent.click(screen.getByRole("button", { name: /claude-sonnet-4-6/i }));

    expect(onSelect).toHaveBeenCalledWith("session-1");
  });

  // LOCAL: archive button callback test covered above in "Direct action buttons" section.

  // --- Editing input onBlur ---

  it("calls onConfirmRename on input blur", () => {
    // Blurring the rename input should confirm the rename.
    const onConfirmRename = vi.fn();
    render(
      <SessionItem
        {...buildProps({
          editingSessionId: "session-1",
          editingName: "test",
          onConfirmRename,
        })}
      />,
    );

    fireEvent.blur(screen.getByDisplayValue("test"));
    expect(onConfirmRename).toHaveBeenCalled();
  });

  // LOCAL: no context menu — arrow key navigation and menu toggle tests removed
  // (direct action buttons replace the three-dot dropdown menu).

  // --- Compacting status treated as running ---

  it("shows running dot when session status is compacting and connected", () => {
    // Compacting is functionally a running state from the user's perspective.
    const { container } = render(
      <SessionItem {...buildProps({ session: makeSession({ status: "compacting" }) })} />,
    );
    expect(container.querySelector(".bg-cc-success")).toBeTruthy();
  });
});

