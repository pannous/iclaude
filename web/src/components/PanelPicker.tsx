import { useState, useEffect, useRef } from "react";
import { useStore } from "../store.js";
import { api, type PanelInfo } from "../api.js";
import { PANEL_ICON_PATHS } from "../utils/panel-icons.js";

function PanelIcon({ name, className }: { name?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={PANEL_ICON_PATHS[name || ""] || PANEL_ICON_PATHS.terminal} />
    </svg>
  );
}

export function PanelPicker() {
  const [open, setOpen] = useState(false);
  const [panels, setPanels] = useState<PanelInfo[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const openPanel = useStore((s) => s.openPanel);

  useEffect(() => {
    if (open) {
      api.listPanels().then(setPanels).catch(() => setPanels([]));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center h-8 w-8 mb-px rounded-[8px_8px_0_0] text-cc-muted hover:text-cc-fg hover:bg-cc-hover/70 transition-colors cursor-pointer"
        title="Open panel"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 01-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 10-3.214 3.214c.446.166.855.497.925.968a.979.979 0 01-.276.837l-1.61 1.61a2.404 2.404 0 01-1.705.707 2.402 2.402 0 01-1.704-.706l-1.568-1.568a1.026 1.026 0 00-.877-.29c-.493.074-.84.504-1.005.964a2.5 2.5 0 11-3.214-3.214c.46-.166.89-.512.964-1.005a1.026 1.026 0 00-.29-.877L2.293 13.56a2.414 2.414 0 010-3.408l1.61-1.611a.98.98 0 01.838-.276c.47.07.801.48.968.925a2.501 2.501 0 103.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 01.276-.837l1.61-1.61a2.404 2.404 0 011.705-.707c.617 0 1.233.235 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.075.84-.505 1.005-.965a2.5 2.5 0 113.214 3.214c-.46.166-.89.513-.964 1.005z" />
        </svg>
      </button>
      {open && panels.length > 0 && (
        <div className="absolute right-0 top-full mt-1 bg-cc-card border border-cc-border rounded-lg shadow-lg py-1 min-w-[200px] z-50">
          {panels.map((s) => (
            <button
              key={s.slug}
              onClick={() => { openPanel(s.slug); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2"
            >
              <PanelIcon name={s.icon} className="w-3.5 h-3.5 shrink-0 text-cc-muted" />
              <span className="font-medium">{s.name}</span>
              {s.description && (
                <span className="text-cc-muted ml-auto text-[11px] truncate max-w-[120px]">{s.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && panels.length === 0 && (
        <div className="absolute right-0 top-full mt-1 bg-cc-card border border-cc-border rounded-lg shadow-lg py-2 px-3 min-w-[180px] z-50">
          <span className="text-[12px] text-cc-muted">No panels found in ~/.companion/panels/</span>
        </div>
      )}
    </div>
  );
}
