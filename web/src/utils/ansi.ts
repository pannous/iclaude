/**
 * Lightweight ANSI escape code → HTML converter.
 * Only handles SGR (Select Graphic Rendition) sequences — colors, bold, italic,
 * dim, underline, and reset. All other escape sequences are stripped.
 */

// Tuned for light backgrounds (matches TerminalView.tsx LIGHT_ANSI)
const LIGHT: Record<number, string> = {
  30: "#141413", 31: "#c53030", 32: "#2d7d46", 33: "#b7791f",
  34: "#2b6cb0", 35: "#805ad5", 36: "#0e7490", 37: "#d4d4d4",
  90: "#6f6e69", 91: "#e53e3e", 92: "#38a169", 93: "#d69e2e",
  94: "#3182ce", 95: "#9f7aea", 96: "#0891b2", 97: "#faf9f5",
};

// Tuned for dark backgrounds
const DARK: Record<number, string> = {
  30: "#6e6e6e", 31: "#f87171", 32: "#4ade80", 33: "#fbbf24",
  34: "#60a5fa", 35: "#c084fc", 36: "#22d3ee", 37: "#e5e7eb",
  90: "#a0a0a0", 91: "#fc8181", 92: "#68d391", 93: "#f6d860",
  94: "#76b2f7", 95: "#d095f7", 96: "#4ad9f0", 97: "#f5f5f5",
};

interface Style {
  fg: string | null;
  bg: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
}

function resetStyle(): Style {
  return { fg: null, bg: null, bold: false, dim: false, italic: false, underline: false };
}

function styleAttr(s: Style): string {
  const parts: string[] = [];
  if (s.fg) parts.push(`color:${s.fg}`);
  if (s.bg) parts.push(`background-color:${s.bg}`);
  if (s.bold) parts.push("font-weight:bold");
  if (s.dim) parts.push("opacity:0.6");
  if (s.italic) parts.push("font-style:italic");
  if (s.underline) parts.push("text-decoration:underline");
  return parts.join(";");
}

function escHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function applyCodes(codes: number[], s: Style, palette: Record<number, string>): Style {
  let i = 0;
  const next = { ...s };
  while (i < codes.length) {
    const c = codes[i++];
    if (c === 0) { Object.assign(next, resetStyle()); continue; }
    if (c === 1) { next.bold = true; continue; }
    if (c === 2) { next.dim = true; continue; }
    if (c === 3) { next.italic = true; continue; }
    if (c === 4) { next.underline = true; continue; }
    if (c === 22) { next.bold = false; next.dim = false; continue; }
    if (c === 23) { next.italic = false; continue; }
    if (c === 24) { next.underline = false; continue; }
    if (c === 39) { next.fg = null; continue; }
    if (c === 49) { next.bg = null; continue; }
    // 8-bit fg: ESC[38;5;Nm
    if (c === 38 && codes[i] === 5) { i++; next.fg = ansi256(codes[i++]); continue; }
    // 8-bit bg: ESC[48;5;Nm
    if (c === 48 && codes[i] === 5) { i++; next.bg = ansi256(codes[i++]); continue; }
    // 24-bit fg: ESC[38;2;R;G;Bm
    if (c === 38 && codes[i] === 2) { i++; next.fg = `rgb(${codes[i++]},${codes[i++]},${codes[i++]})`; continue; }
    // 24-bit bg: ESC[48;2;R;G;Bm
    if (c === 48 && codes[i] === 2) { i++; next.bg = `rgb(${codes[i++]},${codes[i++]},${codes[i++]})`; continue; }
    // Standard fg (30-37, 90-97) and bg (40-47, 100-107)
    if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) { next.fg = palette[c] ?? null; continue; }
    if ((c >= 40 && c <= 47) || (c >= 100 && c <= 107)) { next.bg = palette[c - 10] ?? null; continue; }
  }
  return next;
}

/** Maps an xterm-256 index to a CSS color string. */
function ansi256(n: number): string {
  if (n < 16) {
    // Standard 16 colors — use a basic approximation
    const basic = ["#000","#800000","#008000","#808000","#000080","#800080","#008080","#c0c0c0",
                   "#808080","#f00","#0f0","#ff0","#00f","#f0f","#0ff","#fff"];
    return basic[n] ?? "#ccc";
  }
  if (n < 232) {
    // 6×6×6 color cube
    const idx = n - 16;
    const r = Math.floor(idx / 36) * 51;
    const g = Math.floor((idx % 36) / 6) * 51;
    const b = (idx % 6) * 51;
    return `rgb(${r},${g},${b})`;
  }
  // Grayscale ramp
  const v = 8 + (n - 232) * 10;
  return `rgb(${v},${v},${v})`;
}

/**
 * Matches:
 * 1. SGR sequences: ESC [ <digits/semicolons> m  (capturing group 1 = params)
 * 2. Other CSI sequences: ESC [ <digits/semicolons> <letter other than m>
 * 3. Two-char non-CSI escape sequences: ESC <any non-[>
 * Using `[0-9;]*` (not `[^m]*`) prevents the greedy group from eating trailing text.
 */
const SGR_RE = /\x1b\[([0-9;]*)m|\x1b\[[0-9;:<=?>]*[A-Za-ln-z]|\x1b[^[]/g;

/**
 * Converts a string containing ANSI escape codes to safe HTML.
 * @param text  Raw text with ANSI codes
 * @param dark  Use dark-theme palette (default: true)
 */
export function ansiToHtml(text: string, dark = true): string {
  const palette = dark ? DARK : LIGHT;
  let style = resetStyle();
  let html = "";
  let last = 0;

  const flush = (segment: string, s: Style) => {
    if (!segment) return;
    const attr = styleAttr(s);
    html += attr ? `<span style="${attr}">${escHtml(segment)}</span>` : escHtml(segment);
  };

  for (const match of text.matchAll(SGR_RE)) {
    flush(text.slice(last, match.index), style);
    last = match.index! + match[0].length;
    if (match[1] !== undefined) {
      // It's an SGR — parse the codes
      const codes = match[1] === "" ? [0] : match[1].split(";").map(Number);
      style = applyCodes(codes, style, palette);
    }
    // Non-SGR escapes are silently stripped (last updated, no flush)
  }
  flush(text.slice(last), style);
  return html;
}

/** Returns true if the string contains at least one ANSI escape sequence. */
export function hasAnsi(text: string): boolean {
  return /\x1b\[/.test(text);
}
