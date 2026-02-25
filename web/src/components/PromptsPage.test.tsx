// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

interface MockStoreState {
  currentSessionId: string | null;
  sessions: Map<string, { cwd?: string }>;
  sdkSessions: Array<{ sessionId: string; cwd: string }>;
}

let mockState: MockStoreState;

const mockApi = {
  listPrompts: vi.fn(),
  createPrompt: vi.fn(),
  deletePrompt: vi.fn(),
};

vi.mock("../api.js", () => ({
  api: {
    listPrompts: (...args: unknown[]) => mockApi.listPrompts(...args),
    createPrompt: (...args: unknown[]) => mockApi.createPrompt(...args),
    deletePrompt: (...args: unknown[]) => mockApi.deletePrompt(...args),
  },
}));

vi.mock("../store.js", () => {
  const useStoreFn = (selector: (state: MockStoreState) => unknown) => selector(mockState);
  useStoreFn.getState = () => mockState;
  return { useStore: useStoreFn };
});

import { PromptsPage } from "./PromptsPage.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockState = {
    currentSessionId: "s1",
    sessions: new Map([["s1", { cwd: "/repo" }]]),
    sdkSessions: [],
  };
  mockApi.listPrompts.mockResolvedValue([]);
  mockApi.createPrompt.mockResolvedValue({ name: "review-pr", content: "Review this PR" });
  mockApi.deletePrompt.mockResolvedValue({ ok: true });
});

describe("PromptsPage", () => {
  it("loads prompts on mount using current session cwd", async () => {
    // Validates prompt listing is fetched with project cwd.
    render(<PromptsPage embedded />);
    await waitFor(() => {
      expect(mockApi.listPrompts).toHaveBeenCalledWith("/repo");
    });
  });

  it("creates a prompt with cwd", async () => {
    // Validates create payload includes cwd for file-based storage.
    render(<PromptsPage embedded />);
    // Open the collapsible create form first
    fireEvent.click(screen.getByRole("button", { name: /new prompt/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "review-pr" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Review this PR" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Prompt" }));

    await waitFor(() => {
      expect(mockApi.createPrompt).toHaveBeenCalledWith({
        name: "review-pr",
        content: "Review this PR",
        cwd: "/repo",
      });
    });
  });

  it("disables create button without cwd", async () => {
    // Edge case: without an active session, create should be disabled.
    mockState = {
      currentSessionId: null,
      sessions: new Map(),
      sdkSessions: [],
    };
    render(<PromptsPage embedded />);
    // Open the collapsible create form first
    fireEvent.click(screen.getByRole("button", { name: /new prompt/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "global" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Always do X" } });
    const btn = screen.getByRole("button", { name: "Create Prompt" });
    expect(btn).toBeDisabled();
  });

  it("deletes an existing prompt", async () => {
    // Validates delete action passes name and cwd to API.
    mockApi.listPrompts.mockResolvedValueOnce([
      { name: "review-pr", content: "Review this PR" },
    ]);
    render(<PromptsPage embedded />);
    await screen.findByText("review-pr");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockApi.deletePrompt).toHaveBeenCalledWith("review-pr", "/repo");
    });
  });

  it("edits an existing prompt content", async () => {
    // Validates inline edit saves updated content via createPrompt (overwrite).
    mockApi.listPrompts.mockResolvedValueOnce([
      { name: "review-pr", content: "Review this PR" },
    ]);
    render(<PromptsPage embedded />);
    await screen.findByText("review-pr");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const contentInput = screen.getByDisplayValue("Review this PR");
    fireEvent.change(contentInput, { target: { value: "Updated content" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockApi.createPrompt).toHaveBeenCalledWith({
        name: "review-pr",
        content: "Updated content",
        cwd: "/repo",
      });
    });
  });

  it("filters prompts by search query", async () => {
    // Validates in-page filtering over prompt name/content.
    mockApi.listPrompts.mockResolvedValueOnce([
      { name: "review-pr", content: "Review this PR" },
      { name: "write-tests", content: "Write missing tests" },
    ]);
    render(<PromptsPage embedded />);
    await screen.findByText("review-pr");

    fireEvent.change(screen.getByPlaceholderText("Search by title or content..."), {
      target: { value: "write" },
    });
    expect(screen.getByText("write-tests")).toBeInTheDocument();
    expect(screen.queryByText("review-pr")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search by title or content..."), {
      target: { value: "not-found" },
    });
    expect(screen.getByText("No prompts match your search.")).toBeInTheDocument();
  });
});
