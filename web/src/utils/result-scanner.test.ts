import { describe, it, expect } from "vitest";
import { resultScanner } from "./result-scanner";

describe("ResultScanner", () => {
  describe("scanHtml", () => {
    it("sets original to the full code block so stripScannedHtml can remove it", () => {
      const markdown = [
        "Here is a button:",
        "",
        "```html",
        "<button>Click Me Please</button>",
        "```",
        "",
        "Enjoy!",
      ].join("\n");

      const results = resultScanner.scanHtml(markdown);
      expect(results).toHaveLength(1);
      expect(results[0].html).toBe("<button>Click Me Please</button>");
      // original must include the ```html ... ``` markers so it can be stripped from markdown
      expect(results[0].original).toContain("```html");
      expect(results[0].original).toMatch(/```$/);

      // Verify stripping actually works (the core bug being fixed)
      const stripped = markdown.replace(results[0].original, "").trim();
      expect(stripped).not.toContain("```html");
      expect(stripped).not.toContain("<button>");
    });

    it("preserves original for bare HTML documents", () => {
      const text =
        "Look:\n<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>\nDone.";
      const results = resultScanner.scanHtml(text);
      expect(results).toHaveLength(1);
      expect(results[0].original).toContain("<!DOCTYPE html>");
    });

    it("skips trivial fragments", () => {
      const text = "```html\n...\n```";
      expect(resultScanner.scanHtml(text)).toHaveLength(0);
    });
  });
});
