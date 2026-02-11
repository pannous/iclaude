import { useState, useCallback } from "react";

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
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

  const dim = size === "sm" ? "w-5 h-5" : "w-7 h-7";
  const iconDim = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <button
      onClick={handleCopy}
      title={title}
      className={`${dim} flex items-center justify-center rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer shrink-0`}
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
