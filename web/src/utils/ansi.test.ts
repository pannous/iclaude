import { describe, it, expect } from "vitest";
import { ansiToHtml, hasAnsi } from "./ansi.js";

describe("hasAnsi", () => {
  it("returns false for plain text", () => {
    expect(hasAnsi("hello world")).toBe(false);
  });

  it("returns true when ESC[ is present", () => {
    expect(hasAnsi("\x1b[32mgreen\x1b[0m")).toBe(true);
  });
});

describe("ansiToHtml", () => {
  it("passes through plain text unchanged (no spans)", () => {
    // Plain text has no ANSI codes so it should come through escaped but un-wrapped
    expect(ansiToHtml("hello")).toBe("hello");
  });

  it("escapes HTML special characters in text", () => {
    expect(ansiToHtml("<b>&amp;</b>")).toBe("&lt;b&gt;&amp;amp;&lt;/b&gt;");
  });

  it("wraps colored text in a span with correct color (dark palette)", () => {
    // ESC[32m = green (dark) = #4ade80
    const html = ansiToHtml("\x1b[32mgreen\x1b[0m", true);
    expect(html).toContain('<span style="color:#4ade80">green</span>');
  });

  it("wraps colored text in a span with correct color (light palette)", () => {
    // ESC[32m = green (light) = #2d7d46
    const html = ansiToHtml("\x1b[32mgreen\x1b[0m", false);
    expect(html).toContain('<span style="color:#2d7d46">green</span>');
  });

  it("applies bold", () => {
    const html = ansiToHtml("\x1b[1mbold\x1b[0m");
    expect(html).toContain("font-weight:bold");
    expect(html).toContain("bold");
  });

  it("applies italic", () => {
    const html = ansiToHtml("\x1b[3mitalic\x1b[0m");
    expect(html).toContain("font-style:italic");
  });

  it("applies underline", () => {
    const html = ansiToHtml("\x1b[4munderline\x1b[0m");
    expect(html).toContain("text-decoration:underline");
  });

  it("handles multiple SGR codes in one sequence", () => {
    // ESC[1;32m = bold + green
    const html = ansiToHtml("\x1b[1;32mbold green\x1b[0m");
    expect(html).toContain("font-weight:bold");
    expect(html).toContain("color:#4ade80");
  });

  it("resets styles on ESC[0m", () => {
    // After reset, plain text should not be wrapped
    const html = ansiToHtml("\x1b[32mgreen\x1b[0mplain");
    expect(html).toContain(">green<");
    // "plain" segment after reset has no style — no span wrapping
    expect(html).toMatch(/plain$/);
  });

  it("strips non-SGR escape sequences (cursor movement etc.)", () => {
    // ESC[2J = clear screen, should be stripped
    const html = ansiToHtml("\x1b[2Jhello");
    expect(html).toBe("hello");
    expect(html).not.toContain("\x1b");
  });

  it("handles 24-bit RGB color", () => {
    // ESC[38;2;255;128;0m = orange fg
    const html = ansiToHtml("\x1b[38;2;255;128;0mtext\x1b[0m");
    expect(html).toContain("color:rgb(255,128,0)");
  });

  it("handles 8-bit (256) color", () => {
    // ESC[38;5;196m = index 196 in 6x6x6 cube = bright red
    const html = ansiToHtml("\x1b[38;5;196mtext\x1b[0m");
    expect(html).toContain("color:");
    expect(html).toContain("text");
  });

  it("handles bright colors (90-97)", () => {
    // ESC[91m = bright red in dark palette = #fc8181
    const html = ansiToHtml("\x1b[91mtext\x1b[0m", true);
    expect(html).toContain("color:#fc8181");
  });

  it("handles background color", () => {
    // ESC[41m = red background (maps to fg[31] = #f87171)
    const html = ansiToHtml("\x1b[41mtext\x1b[0m", true);
    expect(html).toContain("background-color:");
  });

  it("preserves newlines in output", () => {
    const html = ansiToHtml("line1\nline2");
    expect(html).toBe("line1\nline2");
  });

  it("handles mixed colored and plain segments", () => {
    const html = ansiToHtml("plain \x1b[32mgreen\x1b[0m more plain");
    expect(html).toContain("plain ");
    expect(html).toContain(">green<");
    expect(html).toContain("more plain");
  });

  it("defaults to dark palette when no argument is given", () => {
    // ESC[31m = red. Dark: #f87171, Light: #c53030
    const html = ansiToHtml("\x1b[31mred\x1b[0m");
    expect(html).toContain("color:#f87171");
  });
});
