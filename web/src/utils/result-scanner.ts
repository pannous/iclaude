/**
 * ResultScanner — scans assistant message text for image references
 * (URLs and local file paths) and HTML fragments, extracting them for inline display.
 */

const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|heic|avif|tiff?)$/i;
const HTML_FILE_EXTENSIONS = /\.html?$/i;

const URL_PATTERN = /https?:\/\/[^\s)<>"'`]+/g;

// Absolute paths: /Users/..., /tmp/..., ~/... (macOS/Linux)
const LOCAL_PATH_PATTERN = /(?:~\/|\/)[^\s<>"'`*?|:,;(){}\[\]]+/g;

// --- HTML fragment extraction patterns ---
const CODE_BLOCK_HTML_RE = /```html\s*\n([\s\S]*?)```/gi;
const ALL_CODE_BLOCKS_RE = /```[\s\S]*?```/g;
const HTML_DOCUMENT_RE = /(?:<!DOCTYPE\s+html[^>]*>|<html[\s>])[\s\S]*?(?:<\/html>|<\/body>)/gi;
const BODY_FRAGMENT_RE = /<body[\s>][\s\S]*?<\/body>/gi;

// Fragments with fewer meaningful characters than this are considered trivial
// (e.g. just punctuation/whitespace) and skipped.
const MIN_MEANINGFUL_HTML_CHARS = 5;

/**
 * Extract HTML fragments from text. Supports:
 * 1. ```html code blocks (most common from LLM output)
 * 2. <!DOCTYPE html> ... </html> or </body> documents
 * 3. <html ...> ... </html> documents
 * 4. <body ...> ... </body> fragments
 */
interface ExtractedFragment {
  html: string;
  /** The full original text as it appeared in the message (for stripping) */
  original: string;
}

function extractHtmlFragments(text: string): ExtractedFragment[] {
  const fragments: ExtractedFragment[] = [];

  // 1. HTML from markdown code blocks: ```html ... ```
  for (const m of text.matchAll(CODE_BLOCK_HTML_RE)) {
    fragments.push({ html: m[1].trim(), original: m[0] });
  }

  // 2. Bare HTML documents (not inside code blocks)
  // Strip code blocks first to avoid double-matching
  const stripped = text.replace(ALL_CODE_BLOCKS_RE, "");
  for (const m of stripped.matchAll(HTML_DOCUMENT_RE)) {
    fragments.push({ html: m[0].trim(), original: m[0] });
  }

  // 3. Bare <body> fragments (no doctype/html wrapper)
  if (fragments.length === 0) {
    for (const m of stripped.matchAll(BODY_FRAGMENT_RE)) {
      fragments.push({ html: m[0].trim(), original: m[0] });
    }
  }

  return fragments;
}

export interface ScannedImage {
  src: string;
  kind: "url" | "local";
  /** Original text matched in the content */
  original: string;
}

export interface ScannedHtmlFile {
  /** Absolute or ~/... path to the HTML file */
  path: string;
  /** Filename for display */
  filename: string;
  /** Original text matched in the content */
  original: string;
}

export interface ScannedHtml {
  html: string;
  /** Original text matched in the content */
  original: string;
  /** Truncated preview for display */
  preview: string;
}

export class ResultScanner {
  /**
   * Scan text content for image references.
   * Returns deduplicated list of images found.
   */
  scanImages(text: string): ScannedImage[] {
    const seen = new Set<string>();
    const images: ScannedImage[] = [];

    const add = (src: string, kind: ScannedImage["kind"], original: string) => {
      if (seen.has(src)) return;
      seen.add(src);
      images.push({ src, kind, original });
    };

    // Scan for URLs with image extensions
    for (const match of text.matchAll(URL_PATTERN)) {
      const url = cleanTrailing(match[0]);
      if (IMAGE_EXTENSIONS.test(extractPathFromUrl(url))) {
        add(url, "url", match[0]);
      }
    }

    // Scan for local file paths with image extensions
    for (const match of text.matchAll(LOCAL_PATH_PATTERN)) {
      const raw = cleanTrailing(match[0]);
      if (IMAGE_EXTENSIONS.test(raw)) {
        add(raw, "local", match[0]);
      }
    }

    return images;
  }

  /**
   * Convert a ScannedImage to a displayable src.
   * URLs pass through; local paths get routed to the server file endpoint.
   */
  toDisplaySrc(image: ScannedImage): string {
    if (image.kind === "url") return image.src;
    return `/api/fs/image?path=${encodeURIComponent(image.src)}`;
  }

  /**
   * Scan text for local HTML file paths (e.g. /Users/.../index.html, ~/project/page.htm).
   */
  scanHtmlFiles(text: string): ScannedHtmlFile[] {
    const seen = new Set<string>();
    const files: ScannedHtmlFile[] = [];

    for (const match of text.matchAll(LOCAL_PATH_PATTERN)) {
      const raw = cleanTrailing(match[0]);
      if (!HTML_FILE_EXTENSIONS.test(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      const filename = raw.split("/").pop() || raw;
      files.push({ path: raw, filename, original: match[0] });
    }

    return files;
  }

  /** Convert a ScannedHtmlFile path to a proxied URL for viewing in a tab */
  toHtmlFileUrl(file: ScannedHtmlFile): string {
    return `/api/fs/html?path=${encodeURIComponent(file.path)}`;
  }

  /**
   * Scan text content for HTML fragments.
   * Returns deduplicated list of HTML blocks found.
   */
  scanHtml(text: string): ScannedHtml[] {
    const seen = new Set<string>();
    const htmlFragments: ScannedHtml[] = [];

    for (const frag of extractHtmlFragments(text)) {
      // Exact string dedup — intentional: fragments are typically small HTML snippets
      // so full-string comparison in the Set is cheap and catches identical duplicates.
      if (seen.has(frag.html)) continue;
      seen.add(frag.html);

      const preview = this.createHtmlPreview(frag.html);

      // Skip trivial fragments (just punctuation/whitespace)
      const meaningfulChars = preview.replace(/[.\s,;:!?-]+/g, "");
      if (meaningfulChars.length < MIN_MEANINGFUL_HTML_CHARS) continue;

      htmlFragments.push({ html: frag.html, original: frag.original, preview });
    }

    return htmlFragments;
  }

  /**
   * Create a short preview of HTML content for display.
   */
  private createHtmlPreview(html: string): string {
    // Strip script/style content, then strip all tags
    const withoutScripts = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
    const text = withoutScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > 100 ? text.slice(0, 97) + "..." : text;
  }
}

/** Strip common trailing punctuation that gets captured by greedy regex */
function cleanTrailing(s: string): string {
  return s.replace(/[).,;:!?]+$/, "");
}

/** Extract pathname from URL for extension matching (ignores query/hash) */
function extractPathFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Scan text for both images and HTML fragments.
 */
export function scanContent(text: string): { images: ScannedImage[]; html: ScannedHtml[]; htmlFiles: ScannedHtmlFile[] } {
  const scanner = new ResultScanner();
  return {
    images: scanner.scanImages(text),
    html: scanner.scanHtml(text),
    htmlFiles: scanner.scanHtmlFiles(text),
  };
}

/** Singleton for convenience */
export const resultScanner = new ResultScanner();
