import { useRef, useEffect, useCallback } from "react";
import { api } from "../api.js";
import { useStore } from "../store.js";

export function Panel({ slug }: { slug: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const focusedFolder = useStore((s) => s.focusedFolder);
  const activeTab = useStore((s) => s.activeTab);
  const darkMode = useStore((s) => s.darkMode);

  const sendPath = useCallback(
    (path: string | null) => {
      if (!path || !iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage({ type: "companion:setPath", path }, "*");
    },
    [],
  );

  const sendTheme = useCallback((dark: boolean) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: "companion:setTheme", dark }, "*");
  }, []);

  // Re-send when focusedFolder changes while panel is already loaded
  useEffect(() => {
    if (activeTab !== `panel:${slug}`) return;
    sendPath(focusedFolder);
  }, [focusedFolder, activeTab, slug, sendPath]);

  // Push theme updates to the panel iframe
  useEffect(() => {
    sendTheme(darkMode);
  }, [darkMode, sendTheme]);

  const src = focusedFolder
    ? `${api.getPanelUrl(slug)}?path=${encodeURIComponent(focusedFolder)}`
    : api.getPanelUrl(slug);

  return (
    <div className="h-full flex flex-col bg-cc-bg">
      <iframe
        ref={iframeRef}
        src={src}
        className="flex-1 w-full border-0"
        title={`Panel: ${slug}`}
        sandbox="allow-scripts allow-same-origin allow-forms"
        // Also send via postMessage for live folder-switch and theme updates
        onLoad={() => { sendPath(focusedFolder); sendTheme(darkMode); }}
      />
    </div>
  );
}
