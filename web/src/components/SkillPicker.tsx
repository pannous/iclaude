import { useState, useEffect, useRef } from "react";
import { useStore } from "../store.js";
import { api, type SkillInfo } from "../api.js";

/** Lucide-compatible SVG paths keyed by icon name. Fallback: "terminal". */
const ICON_PATHS: Record<string, string> = {
  terminal: "M4 17l6-5-6-5M12 19h8",
  cpu: "M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M6 6h12v12H6zM9 9h6v6H9z",
  clock: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  map: "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16",
  "volume-2": "M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07",
  music: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z",
  globe: "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8",
};

function SkillIcon({ name, className }: { name?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={ICON_PATHS[name || ""] || ICON_PATHS.terminal} />
    </svg>
  );
}

export function SkillPicker() {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const openSkill = useStore((s) => s.openSkill);

  useEffect(() => {
    if (open) {
      api.listSkills().then(setSkills).catch(() => setSkills([]));
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
        className="h-8 mb-px px-2 rounded-[8px_8px_0_0] text-[12px] font-semibold text-cc-muted hover:text-cc-fg hover:bg-cc-hover/70 transition-colors cursor-pointer"
        title="Open skill panel"
      >
        +
      </button>
      {open && skills.length > 0 && (
        <div className="absolute right-0 top-full mt-1 bg-cc-card border border-cc-border rounded-lg shadow-lg py-1 min-w-[200px] z-50">
          {skills.map((s) => (
            <button
              key={s.slug}
              onClick={() => { openSkill(s.slug); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2"
            >
              <SkillIcon name={s.icon} className="w-3.5 h-3.5 shrink-0 text-cc-muted" />
              <span className="font-medium">{s.name}</span>
              {s.description && (
                <span className="text-cc-muted ml-auto text-[11px] truncate max-w-[120px]">{s.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && skills.length === 0 && (
        <div className="absolute right-0 top-full mt-1 bg-cc-card border border-cc-border rounded-lg shadow-lg py-2 px-3 min-w-[180px] z-50">
          <span className="text-[12px] text-cc-muted">No skills found in ~/.companion/skills/</span>
        </div>
      )}
    </div>
  );
}
