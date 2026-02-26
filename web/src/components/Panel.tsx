import { useRef, useEffect, useCallback } from "react";
import { api } from "../api.js";
import { useStore } from "../store.js";

export function Panel({ slug }: { slug: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const focusedFolder = useStore((s) => s.focusedFolder);
  const activeTab = useStore((s) => s.activeTab);

  const sendPath = useCallback(
    (path: string | null) => {
      if (!path || !iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage({ type: "companion:setPath", path }, "*");
    },
    [],
  );

  // Re-send when focusedFolder changes while panel is already loaded
  useEffect(() => {
    if (activeTab !== `panel:${slug}`) return;
    sendPath(focusedFolder);
  }, [focusedFolder, activeTab, slug, sendPath]);

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
        // Also send via postMessage for live folder-switch updates
        onLoad={() => sendPath(focusedFolder)}
      />
    </div>
  );
}
