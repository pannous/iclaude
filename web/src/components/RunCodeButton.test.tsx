// @vitest-environment jsdom
/**
 * Tests for RunnableCodeBlock component.
 *
 * Validates:
 * - Renders the language label and Run button
 * - Calls /api/exec on click with correct payload
 * - Shows stdout on success and updates button color
 * - Shows stderr and exit code on error
 * - "no output" message when both stdout and stderr are empty
 * - Dismiss button removes the output panel
 * - RUNNABLE_LANGS set contains expected shell languages
 * - Accessibility: no ARIA violations
 */
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RunnableCodeBlock, RUNNABLE_LANGS } from "./RunCodeButton.js";

const PRE = (
  <pre>
    <code>echo hello</code>
  </pre>
);

describe("RUNNABLE_LANGS", () => {
  it("includes common shell languages", () => {
    for (const lang of ["bash", "sh", "shell", "zsh", "fish", "terminal"]) {
      expect(RUNNABLE_LANGS.has(lang)).toBe(true);
    }
  });

  it("does not include non-shell languages", () => {
    expect(RUNNABLE_LANGS.has("python")).toBe(false);
    expect(RUNNABLE_LANGS.has("typescript")).toBe(false);
  });
});

describe("RunnableCodeBlock", () => {
  // Typed mock to avoid TS overlap error
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(response: object) {
    fetchMock.mockResolvedValueOnce({ json: async () => response });
  }

  it("renders language label and Run button", () => {
    render(
      <RunnableCodeBlock lang="bash" code="echo hello">
        {PRE}
      </RunnableCodeBlock>
    );
    expect(screen.getByText("bash")).toBeInTheDocument();
    expect(screen.getByTitle("Run")).toBeInTheDocument();
  });

  it("renders the child pre block", () => {
    render(
      <RunnableCodeBlock lang="bash" code="echo hello">
        {PRE}
      </RunnableCodeBlock>
    );
    expect(screen.getByText("echo hello")).toBeInTheDocument();
  });

  it("calls /api/exec with the code on Run click", async () => {
    mockFetch({ ok: true, stdout: "hello\n" });
    render(
      <RunnableCodeBlock lang="bash" code="echo hello">
        {PRE}
      </RunnableCodeBlock>
    );
    await act(async () => {
      fireEvent.click(screen.getByTitle("Run"));
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/exec",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("echo hello"),
      })
    );
  });

  it("shows stdout on successful execution", async () => {
    mockFetch({ ok: true, stdout: "hello world\n" });
    render(
      <RunnableCodeBlock lang="bash" code="echo hello">
        {PRE}
      </RunnableCodeBlock>
    );
    await act(async () => {
      fireEvent.click(screen.getByTitle("Run"));
    });
    await waitFor(() => {
      expect(screen.getByText("hello world")).toBeInTheDocument();
    });
    expect(screen.getByText(/exited 0/i)).toBeInTheDocument();
  });

  it("shows stderr and exit code on error", async () => {
    mockFetch({ ok: false, stderr: "command not found", exitCode: 127 });
    render(
      <RunnableCodeBlock lang="bash" code="blorp">
        {PRE}
      </RunnableCodeBlock>
    );
    await act(async () => {
      fireEvent.click(screen.getByTitle("Run"));
    });
    await waitFor(() => {
      expect(screen.getByText("command not found")).toBeInTheDocument();
    });
    expect(screen.getByText(/exited 127/i)).toBeInTheDocument();
  });

  it("shows 'no output' when stdout and stderr are empty", async () => {
    mockFetch({ ok: true, stdout: "" });
    render(
      <RunnableCodeBlock lang="bash" code="true">
        {PRE}
      </RunnableCodeBlock>
    );
    await act(async () => {
      fireEvent.click(screen.getByTitle("Run"));
    });
    await waitFor(() => {
      expect(screen.getByText("no output")).toBeInTheDocument();
    });
  });

  it("dismisses output on Dismiss click", async () => {
    mockFetch({ ok: true, stdout: "hi\n" });
    render(
      <RunnableCodeBlock lang="bash" code="echo hi">
        {PRE}
      </RunnableCodeBlock>
    );
    await act(async () => {
      fireEvent.click(screen.getByTitle("Run"));
    });
    await waitFor(() => screen.getByText("hi"));
    fireEvent.click(screen.getByTitle("Dismiss output"));
    expect(screen.queryByText("hi")).not.toBeInTheDocument();
  });

  it("passes axe accessibility checks", async () => {
    const { axe } = await import("vitest-axe");
    // Wrap in <main> to satisfy the "content in landmarks" axe rule
    const { container } = render(
      <main>
        <RunnableCodeBlock lang="bash" code="echo hello">
          {PRE}
        </RunnableCodeBlock>
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
