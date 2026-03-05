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
  listDirs: vi.fn(),
};

vi.mock("../api.js", () => ({
  api: {
    listPrompts: (...args: unknown[]) => mockApi.listPrompts(...args),
    createPrompt: (...args: unknown[]) => mockApi.createPrompt(...args),
    deletePrompt: (...args: unknown[]) => mockApi.deletePrompt(...args),
    listDirs: (...args: unknown[]) => mockApi.listDirs(...args),
  },
}));

vi.mock("../store.js", () => {
  const useStoreFn = (selector: (state: MockStoreState) => unknown) => selector(mockState);
  useStoreFn.getState = () => mockState;
  return { useStore: useStoreFn };
});

// Mock createPortal for FolderPicker
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
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
  mockApi.listDirs.mockResolvedValue({ path: "/", dirs: [], home: "/" });
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
    fireEvent.click(screen.getByRole("button", { name: /new prompt/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "review-pr" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Review this PR" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Prompt" }));

    await waitFor(() => {
      expect(mockApi.createPrompt).toHaveBeenCalledWith({
        name: "review-pr",
        content: "Review this PR",
        scope: "global",
        cwd: undefined,
      });
    });
  });

  it("creates a project-scoped prompt with cwd pre-filled", async () => {
    // Validates clicking "Project folders" scope sets cwd for project storage.
    render(<PromptsPage embedded />);
    fireEvent.click(screen.getByRole("button", { name: /new prompt/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "project-prompt" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Project content" } });

    // Switch to project scope
    fireEvent.click(screen.getByRole("button", { name: "Project folders" }));

    fireEvent.click(screen.getByRole("button", { name: "Create Prompt" }));

    await waitFor(() => {
      expect(mockApi.createPrompt).toHaveBeenCalledWith({
        name: "project-prompt",
        content: "Project content",
        scope: "project",
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
    fireEvent.click(screen.getByRole("button", { name: /new prompt/i }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "global" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Always do X" } });
    const btn = screen.getByRole("button", { name: "Create Prompt" });
    expect(btn).toBeDisabled();
  });

  it("deletes an existing prompt", async () => {
    // Validates delete action passes name and cwd to API.
    mockApi.listPrompts.mockResolvedValueOnce([
      { name: "review-pr", content: "Review this PR", scope: "global" },
    ]);
    render(<PromptsPage embedded />);
    await screen.findByText("review-pr");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockApi.deletePrompt).toHaveBeenCalledWith("review-pr", undefined);
    });
  });

  it("edits an existing prompt content", async () => {
    // Validates inline edit saves updated content via createPrompt (overwrite).
    mockApi.listPrompts.mockResolvedValueOnce([
      { name: "review-pr", content: "Review this PR", scope: "global" },
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
        scope: "global",
        cwd: undefined,
      });
    });
  });

  it("filters prompts by search query", async () => {
    // Validates in-page filtering over prompt name/content.
    mockApi.listPrompts.mockResolvedValueOnce([
      { name: "review-pr", content: "Review this PR", scope: "global" },
      { name: "write-tests", content: "Write missing tests", scope: "global" },
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

  it("shows scope badge with folder chip for project prompts", async () => {
    // Validates the scope badge renders a folder chip for project-scoped prompts.
    mockApi.listPrompts.mockResolvedValueOnce([
      {
        id: "p1",
        name: "project-prompt",
        content: "Content",
        scope: "project",
        projectPath: "/home/user/my-project",
        projectPaths: ["/home/user/my-project"],
      },
    ]);
    render(<PromptsPage embedded />);
    await screen.findByText("project-prompt");
    // Folder name appears in both the group header and the scope badge chip
    const folderElements = screen.getAllByText("my-project");
    expect(folderElements.length).toBeGreaterThanOrEqual(2);
  });

  it("shows scope selector in create form with Global and Project folders buttons", async () => {
    // Validates the scope selector UI is rendered.
    render(<PromptsPage embedded />);
    fireEvent.click(screen.getByRole("button", { name: /new prompt/i }));
    expect(screen.getByText("Scope")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Global" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Project folders" })).toBeInTheDocument();
  });

  it("shows folder chips and Add folder button when project scope selected", async () => {
    // Validates the folder chip UI renders with remove buttons when project scope is active.
    render(<PromptsPage embedded />);
    fireEvent.click(screen.getByRole("button", { name: /new prompt/i }));
    fireEvent.click(screen.getByRole("button", { name: "Project folders" }));

    // cwd "/repo" should be auto-filled as a chip
    expect(screen.getByText("repo")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove folder /repo")).toBeInTheDocument();
    expect(screen.getByText("Add folder")).toBeInTheDocument();
  });

  it("removes a folder chip when remove button clicked", async () => {
    // Validates folder removal interaction in the scope selector.
    render(<PromptsPage embedded />);
    fireEvent.click(screen.getByRole("button", { name: /new prompt/i }));
    fireEvent.click(screen.getByRole("button", { name: "Project folders" }));

    // Remove the auto-filled folder
    fireEvent.click(screen.getByLabelText("Remove folder /repo"));

    // No chips should remain, but Add folder should still be visible
    expect(screen.queryByText("repo")).not.toBeInTheDocument();
    expect(screen.getByText("Add folder")).toBeInTheDocument();
  });

  it("displays individual folder chips for multi-folder prompts", async () => {
    // Validates scope badge shows a chip per folder for prompts assigned to multiple folders.
    mockApi.listPrompts.mockResolvedValueOnce([
      {
        id: "p1",
        name: "multi-folder",
        content: "Content",
        scope: "project",
        projectPath: "/home/user/repo-a",
        projectPaths: ["/home/user/repo-a", "/home/user/repo-b", "/home/user/repo-c"],
      },
    ]);
    render(<PromptsPage embedded />);
    await screen.findByText("multi-folder");
    expect(screen.getByText("repo-a")).toBeInTheDocument();
    expect(screen.getByText("repo-b")).toBeInTheDocument();
    expect(screen.getByText("repo-c")).toBeInTheDocument();
  });

  it("renders grouped sections for mixed global and project prompts", async () => {
    // Validates that prompts are grouped under Global and project folder headers.
    mockApi.listPrompts.mockResolvedValueOnce([
      {
        id: "g1",
        name: "global-prompt",
        content: "Global content",
        scope: "global",
      },
      {
        id: "p1",
        name: "project-prompt",
        content: "Project content",
        scope: "project",
        projectPath: "/home/user/my-app",
        projectPaths: ["/home/user/my-app"],
      },
    ]);
    render(<PromptsPage embedded />);
    await screen.findByText("global-prompt");

    // Both prompts visible
    expect(screen.getByText("global-prompt")).toBeInTheDocument();
    expect(screen.getByText("project-prompt")).toBeInTheDocument();

    // Group headers present — "Global" header and "my-app" folder header
    expect(screen.getByText("Global")).toBeInTheDocument();
    // "my-app" appears in both group header and scope badge chip
    const folderElements = screen.getAllByText("my-app");
    expect(folderElements.length).toBeGreaterThanOrEqual(2);
  });

  it("shows Back button in non-embedded mode", async () => {
    // Validates the Back button renders when not embedded.
    render(<PromptsPage />);
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("cancels editing and resets state", async () => {
    // Validates cancel in edit mode clears edit state.
    mockApi.listPrompts.mockResolvedValueOnce([
      {
        name: "review-pr",
        content: "Review this PR",
        scope: "global",
      },
    ]);
    render(<PromptsPage embedded />);
    await screen.findByText("review-pr");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    // Should be back to display mode
    expect(screen.getByText("review-pr")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    // Validates loading indicator appears before prompts load.
    render(<PromptsPage embedded />);
    expect(screen.getByText("Loading prompts...")).toBeInTheDocument();
  });

  it("passes axe accessibility checks", async () => {
    // Ensures the PromptsPage meets WCAG accessibility standards.
    const { axe } = await import("vitest-axe");
    mockApi.listPrompts.mockResolvedValueOnce([
      {
        id: "p1",
        name: "review-pr",
        content: "Review this PR",
        scope: "global",
      },
    ]);
    const { container } = render(<PromptsPage embedded />);
    await screen.findByText("review-pr");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
