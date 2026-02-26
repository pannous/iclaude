import { useRef, useEffect } from "react";
import { api } from "../api.js";
import { useStore } from "../store.js";

export function Panel({ slug }: { slug: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const focusedFolder = useStore((s) => s.focusedFolder);
  const activeTab = useStore((s) => s.activeTab);

  // Forward folder focus changes to the panel when it's the active tab
  useEffect(() => {
    if (activeTab !== `panel:${slug}` || !focusedFolder || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "companion:setPath", path: focusedFolder },
      "*",
    );
  }, [focusedFolder, activeTab, slug]);

  return (
    <div className="h-full flex flex-col bg-cc-bg">
      <iframe
        ref={iframeRef}
        src={api.getPanelUrl(slug)}
        className="flex-1 w-full border-0"
        title={`Panel: ${slug}`}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
