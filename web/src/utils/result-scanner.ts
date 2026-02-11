/**
 * ResultScanner — scans assistant message text for image references
 * (URLs and local file paths) and extracts them for inline display.
 */

const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|heic|avif|tiff?)$/i;

const URL_PATTERN = /https?:\/\/[^\s)<>"']+/g;

// Absolute paths: /Users/..., /tmp/..., ~/... (macOS/Linux)
const LOCAL_PATH_PATTERN = /(?:~\/|\/)[^\s<>"'*?|:,;(){}\[\]]+/g;

export interface ScannedImage {
  src: string;
  kind: "url" | "local";
  /** Original text matched in the content */
  original: string;
}

export class ResultScanner {
  /**
   * Scan text content for image references.
   * Returns deduplicated list of images found.
   */
  scan(text: string): ScannedImage[] {
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

/** Singleton for convenience */
export const resultScanner = new ResultScanner();
