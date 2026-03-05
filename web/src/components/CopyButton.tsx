import { useState, useCallback } from "react";

/** Clipboard write with execCommand fallback for iPad/non-HTTPS contexts */
export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}

function fallbackCopy(text: string): Promise<void> {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

/** Inline copy icon that shows a checkmark on success */
export function CopyButton({ getText, size = "sm", title = "Copy" }: {
  getText: () => string;
  size?: "sm" | "md";
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = getText();
    if (!text) return;
    copyToClipboard(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [getText]);

  const iconDim = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <button
      onClick={handleCopy}
      title={title}
      className={`min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-5 sm:h-5 flex items-center justify-center rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover active:scale-90 active:bg-cc-hover transition-all cursor-pointer shrink-0`}
    >
      {copied ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${iconDim} text-cc-success`}>
          <polyline points="3 8.5 6.5 12 13 4" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={iconDim}>
          <rect x="5.5" y="5.5" width="7" height="8" rx="1.5" />
          <path d="M10.5 5.5V4a1.5 1.5 0 00-1.5-1.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5" />
        </svg>
      )}
    </button>
  );
}
