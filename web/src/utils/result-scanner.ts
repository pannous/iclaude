/**
 * ResultScanner — scans assistant message text for image references
 * (URLs and local file paths) and HTML fragments, extracting them for inline display.
 */

const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|heic|avif|tiff?)$/i;

const URL_PATTERN = /https?:\/\/[^\s)<>"']+/g;

// Absolute paths: /Users/..., /tmp/..., ~/... (macOS/Linux)
const LOCAL_PATH_PATTERN = /(?:~\/|\/)[^\s<>"'*?|:,;(){}\[\]]+/g;

// HTML fragments: looks for blocks starting with <!DOCTYPE, <html, or multi-line tags
const HTML_PATTERN = /(?:<!DOCTYPE\s+html[^>]*>[\s\S]*?<html[\s\S]*?<\/html>|<html[\s\S]*?<\/html>|(?:<(?:div|section|article|main|header|footer|nav|aside)[^>]*>[\s\S]{50,}?<\/(?:div|section|article|main|header|footer|nav|aside)>))/gi;

export interface ScannedImage {
  src: string;
  kind: "url" | "local";
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
   * Scan text content for HTML fragments.
   * Returns deduplicated list of HTML blocks found.
   */
  scanHtml(text: string): ScannedHtml[] {
    const seen = new Set<string>();
    const htmlFragments: ScannedHtml[] = [];

    for (const match of text.matchAll(HTML_PATTERN)) {
      const html = match[0].trim();
      if (seen.has(html)) continue;
      seen.add(html);

      const preview = this.createHtmlPreview(html);
      htmlFragments.push({ html, original: match[0], preview });
    }

    return htmlFragments;
  }

  /**
   * Create a short preview of HTML content for display.
   */
  private createHtmlPreview(html: string): string {
    // Strip tags and get first 100 chars
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
export function scanContent(text: string): { images: ScannedImage[]; html: ScannedHtml[] } {
  const scanner = new ResultScanner();
  return {
    images: scanner.scanImages(text),
    html: scanner.scanHtml(text),
  };
}

/** Singleton for convenience */
export const resultScanner = new ResultScanner();
