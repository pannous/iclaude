// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const getFileTreeMock = vi.hoisted(() => vi.fn());
const statFileMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());

vi.mock("../api.js", () => ({
  api: {
    getFileTree: getFileTreeMock,
    statFile: statFileMock,
    readFile: readFileMock,
    writeFile: writeFileMock,
  },
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      aria-label="Code editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const setEditorActiveFilePathMock = vi.hoisted(() => vi.fn());

interface MockStoreState {
  darkMode: boolean;
  sessions: Map<string, { cwd?: string }>;
  sdkSessions: { sessionId: string; cwd?: string }[];
  editorActiveFilePath: string | null;
  setEditorActiveFilePath: (path: string | null) => void;
}

let storeState: MockStoreState;

function resetStore(overrides: Partial<MockStoreState> = {}) {
  storeState = {
    darkMode: false,
    sessions: new Map([["s1", { cwd: "/repo" }]]),
    sdkSessions: [],
    editorActiveFilePath: null,
    setEditorActiveFilePath: setEditorActiveFilePathMock,
    ...overrides,
  };
}

vi.mock("../store.js", () => ({
  useStore: (selector: (s: MockStoreState) => unknown) => selector(storeState),
}));

import { SessionEditorPane } from "./SessionEditorPane.js";

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  // Default: small file
  statFileMock.mockResolvedValue({ path: "/repo/src/a.ts", size: 100, isFile: true });
});

describe("SessionEditorPane", () => {
  it("loads tree and file content", async () => {
    // Ensures the editor initializes: stat check then read for small files
    getFileTreeMock.mockResolvedValue({
      path: "/repo",
      tree: [
        { name: "src", path: "/repo/src", type: "directory", children: [{ name: "a.ts", path: "/repo/src/a.ts", type: "file" }] },
      ],
    });
    readFileMock.mockResolvedValue({ path: "/repo/src/a.ts", content: "const a = 1;\n" });

    render(<SessionEditorPane sessionId="s1" />);

    await waitFor(() => expect(getFileTreeMock).toHaveBeenCalledWith("/repo"));
    await waitFor(() => expect(statFileMock).toHaveBeenCalledWith("/repo/src/a.ts"));
    await waitFor(() => expect(readFileMock).toHaveBeenCalledWith("/repo/src/a.ts"));
    expect(await screen.findByText("src/a.ts")).toBeInTheDocument();
  });

  it("saves when content changes", async () => {
    getFileTreeMock.mockResolvedValue({
      path: "/repo",
      tree: [{ name: "index.ts", path: "/repo/index.ts", type: "file" }],
    });
    statFileMock.mockResolvedValue({ path: "/repo/index.ts", size: 50, isFile: true });
    readFileMock.mockResolvedValue({ path: "/repo/index.ts", content: "hello\n" });
    writeFileMock.mockResolvedValue({ ok: true, path: "/repo/index.ts" });

    render(<SessionEditorPane sessionId="s1" />);

    await waitFor(() => expect(readFileMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Code editor"), { target: { value: "hello!\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(writeFileMock).toHaveBeenCalled();
      expect(writeFileMock.mock.calls[0][0]).toBe("/repo/index.ts");
    });
  });

  it("shows reconnecting message when cwd is unavailable", () => {
    resetStore({ sessions: new Map([["s1", {}]]) });
    render(<SessionEditorPane sessionId="s1" />);
    expect(screen.getByText("Editor unavailable while session is reconnecting.")).toBeInTheDocument();
  });

  it("shows large file warning and loads on confirm", async () => {
    // File is 600 KB — above 512 KB threshold
    const largeSize = 600 * 1024;
    getFileTreeMock.mockResolvedValue({
      path: "/repo",
      tree: [{ name: "big.json", path: "/repo/big.json", type: "file" }],
    });
    statFileMock.mockResolvedValue({ path: "/repo/big.json", size: largeSize, isFile: true });
    readFileMock.mockResolvedValue({ path: "/repo/big.json", content: "{}" });

    render(<SessionEditorPane sessionId="s1" />);

    // Warning should appear
    await waitFor(() => expect(screen.getByText(/Large file/)).toBeInTheDocument());
    expect(screen.getByText("Open anyway")).toBeInTheDocument();
    // readFile should NOT have been called yet
    expect(readFileMock).not.toHaveBeenCalled();

    // Click "Open anyway"
    fireEvent.click(screen.getByText("Open anyway"));

    await waitFor(() => expect(readFileMock).toHaveBeenCalledWith("/repo/big.json"));
  });

  it("shows error for files exceeding 2 MB limit", async () => {
    const hugeSize = 3 * 1024 * 1024;
    getFileTreeMock.mockResolvedValue({
      path: "/repo",
      tree: [{ name: "huge.bin", path: "/repo/huge.bin", type: "file" }],
    });
    statFileMock.mockResolvedValue({ path: "/repo/huge.bin", size: hugeSize, isFile: true });

    render(<SessionEditorPane sessionId="s1" />);

    await waitFor(() => expect(screen.getByText(/too large to edit/i)).toBeInTheDocument());
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("close button clears content and resets state", async () => {
    getFileTreeMock.mockResolvedValue({
      path: "/repo",
      tree: [{ name: "a.ts", path: "/repo/a.ts", type: "file" }],
    });
    statFileMock.mockResolvedValue({ path: "/repo/a.ts", size: 50, isFile: true });
    readFileMock.mockResolvedValue({ path: "/repo/a.ts", content: "const x = 1;" });

    render(<SessionEditorPane sessionId="s1" />);

    // Wait for file to load
    await waitFor(() => expect(readFileMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText("Code editor")).toBeInTheDocument());

    // Click close button
    fireEvent.click(screen.getByRole("button", { name: "Close file" }));

    // Editor should be gone, placeholder shown
    await waitFor(() => expect(screen.getByText("Select a file to start editing.")).toBeInTheDocument());
    expect(setEditorActiveFilePathMock).toHaveBeenCalledWith(null);
  });

  it("displays file size in the header bar", async () => {
    getFileTreeMock.mockResolvedValue({
      path: "/repo",
      tree: [{ name: "a.ts", path: "/repo/a.ts", type: "file" }],
    });
    statFileMock.mockResolvedValue({ path: "/repo/a.ts", size: 2048, isFile: true });
    readFileMock.mockResolvedValue({ path: "/repo/a.ts", content: "x" });

    render(<SessionEditorPane sessionId="s1" />);

    await waitFor(() => expect(readFileMock).toHaveBeenCalled());
    expect(await screen.findByText("2.0 KB")).toBeInTheDocument();
  });
});
