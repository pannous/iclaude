// @vitest-environment jsdom
/**
 * Tests for SessionItem — focusing on title rendering safety.
 *
 * Key concern: session titles that leaked XML system tags (e.g. <local-command-caveat>)
 * from the CLI must never reach the DOM as raw tag text.
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createRef } from "react";
import { SessionItem } from "./SessionItem.js";
import type { SessionItem as SessionItemType } from "../utils/project-grouping.js";

function makeSession(overrides: Partial<SessionItemType> = {}): SessionItemType {
  return {
    id: "test-session-id",
    model: "claude-opus-4-6",
    status: "idle",
    isConnected: false,
    permCount: 0,
    cwd: "/home/user/project",
    createdAt: Date.now(),
    archived: false,
    title: undefined,
    agentName: undefined,
    agentId: undefined,
    isContainerized: false,
    cronJobId: undefined,
    gitBranch: "",
    isWorktree: false,
    gitAhead: 0,
    gitBehind: 0,
    linesAdded: 0,
    linesRemoved: 0,
    sdkState: null,
    backendType: "claude",
    repoRoot: "/home/user/project",
    ...overrides,
  };
}

const defaultProps = {
  isActive: false,
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
};

describe("SessionItem", () => {
  it("renders a clean title normally", () => {
    render(<SessionItem {...defaultProps} session={makeSession({ title: "Fix the auth bug" })} />);
    expect(screen.getByText("Fix the auth bug")).toBeInTheDocument();
  });

  it("strips <local-command-caveat> tag from title before rendering", () => {
    // This is the exact format that leaked from the CLI — tag with no closing counterpart
    const brokenTitle = "<local-command-caveat>Caveat: The messages below were generated";
    render(<SessionItem {...defaultProps} session={makeSession({ title: brokenTitle })} />);

    // The tag itself must never appear in the DOM
    expect(screen.queryByText(/<local-command-caveat>/)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("<local-command-caveat>");

    // The clean text content should be visible instead
    expect(screen.getByText(/Caveat: The messages below were generated/)).toBeInTheDocument();
  });

  it("strips a fully closed <local-command-caveat>…</local-command-caveat> block", () => {
    const brokenTitle =
      "<local-command-caveat>DO NOT RESPOND TO THESE</local-command-caveat> Fix the real bug";
    render(<SessionItem {...defaultProps} session={makeSession({ title: brokenTitle })} />);
    expect(document.body.innerHTML).not.toContain("<local-command-caveat>");
    expect(screen.getByText(/Fix the real bug/)).toBeInTheDocument();
  });

  it("falls back to sessionName when title is empty after stripping", () => {
    // A title that is ONLY a tag with no visible text content becomes empty after stripping
    render(
      <SessionItem
        {...defaultProps}
        session={makeSession({ title: "<local-command-caveat></local-command-caveat>" })}
        sessionName="My Session Name"
      />,
    );
    expect(screen.getByText("My Session Name")).toBeInTheDocument();
  });

  it("falls back to model name when title and sessionName are absent", () => {
    // Fallback priority: cleanTitle → sessionName → model → shortId
    render(<SessionItem {...defaultProps} session={makeSession({ title: undefined })} />);
    expect(screen.getByText(/claude-opus-4-6/)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <SessionItem {...defaultProps} session={makeSession({ title: "Clean session title" })} />,
    );
    const { axe } = await import("vitest-axe");
    const results = await axe(container);
    expect(results).toEqual(expect.objectContaining({ violations: [] }));
  });
});
