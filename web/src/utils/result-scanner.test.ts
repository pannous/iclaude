import { describe, it, expect } from "vitest";
import { resultScanner, scanContent } from "./result-scanner";

describe("ResultScanner", () => {
  describe("scanImages", () => {
    it("detects local image paths in plain text", () => {
      const text = "Here is the file /Users/me/Pictures/cat.jpg for you";
      const images = resultScanner.scanImages(text);
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("/Users/me/Pictures/cat.jpg");
      expect(images[0].kind).toBe("local");
    });

    it("detects tilde-prefixed image paths", () => {
      const text = "Check ~/Pictures/cat.jpg please";
      const images = resultScanner.scanImages(text);
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("~/Pictures/cat.jpg");
      expect(images[0].kind).toBe("local");
    });

    it("detects image paths wrapped in backticks", () => {
      const text = "Here is the image `~/Pictures/cat.jpg` rendered inline";
      const images = resultScanner.scanImages(text);
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("~/Pictures/cat.jpg");
      expect(images[0].kind).toBe("local");
    });

    it("detects image paths inside parentheses with backticks", () => {
      const text = "demo image (`~/Pictures/cat.jpg`) — a watercolor";
      const images = resultScanner.scanImages(text);
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe("~/Pictures/cat.jpg");
    });

    it("detects image URLs wrapped in backticks", () => {
      const text = "See `https://example.com/photo.png` here";
      const images = resultScanner.scanImages(text);
      const urlMatch = images.find((i) => i.kind === "url");
      expect(urlMatch).toBeDefined();
      expect(urlMatch!.src).toBe("https://example.com/photo.png");
    });

    it("detects multiple image formats", () => {
      const text = "/tmp/a.png and /tmp/b.webp and /tmp/c.heic";
      const images = resultScanner.scanImages(text);
      expect(images).toHaveLength(3);
    });

    it("ignores non-image file paths", () => {
      const text = "Config at /etc/nginx/nginx.conf and ~/docs/readme.md";
      const images = resultScanner.scanImages(text);
      expect(images).toHaveLength(0);
    });

    it("deduplicates identical paths", () => {
      const text = "/tmp/photo.jpg appears twice: /tmp/photo.jpg";
      const images = resultScanner.scanImages(text);
      expect(images).toHaveLength(1);
    });
  });

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

  describe("scanHtmlFiles", () => {
    it("detects absolute HTML file paths", () => {
      const text = "Check /Users/me/project/index.html for the output";
      const files = resultScanner.scanHtmlFiles(text);
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe("/Users/me/project/index.html");
      expect(files[0].filename).toBe("index.html");
    });

    it("detects tilde-prefixed .htm paths", () => {
      const text = "Open ~/Sites/page.htm in your browser";
      const files = resultScanner.scanHtmlFiles(text);
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe("~/Sites/page.htm");
      expect(files[0].filename).toBe("page.htm");
    });

    it("ignores non-HTML file paths", () => {
      const text = "/Users/me/project/main.py and ~/readme.md";
      expect(resultScanner.scanHtmlFiles(text)).toHaveLength(0);
    });

    it("deduplicates identical paths", () => {
      const text = "/tmp/out.html and again /tmp/out.html";
      expect(resultScanner.scanHtmlFiles(text)).toHaveLength(1);
    });

    it("toHtmlFileUrl generates correct proxy URL", () => {
      const files = resultScanner.scanHtmlFiles("See ~/project/index.html");
      expect(resultScanner.toHtmlFileUrl(files[0])).toBe(
        `/api/fs/html?path=${encodeURIComponent("~/project/index.html")}`,
      );
    });
  });

  describe("scanContent", () => {
    it("returns htmlFiles alongside images and html", () => {
      const text = "Image: /tmp/photo.png, page: /tmp/output.html";
      const result = scanContent(text);
      expect(result.images).toHaveLength(1);
      expect(result.htmlFiles).toHaveLength(1);
      expect(result.htmlFiles[0].filename).toBe("output.html");
    });
  });
});
