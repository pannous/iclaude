
// @vitest-environment jsdom
/**
 * Tests for SessionItem — focusing on title rendering safety and core functionality.
 *
 * Key concern: session titles that leaked XML system tags (e.g. <local-command-caveat>)
 * from the CLI must never reach the DOM as raw tag text.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
});

