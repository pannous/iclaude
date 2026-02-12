import { useState, useEffect, useRef } from "react";
import { useStore } from "../store.js";
import { api, type SkillInfo } from "../api.js";

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
        className="px-1.5 py-1 rounded-md text-[11px] font-medium text-cc-muted hover:text-cc-fg transition-colors cursor-pointer"
        title="Open skill panel"
      >
        +
      </button>
      {open && skills.length > 0 && (
        <div className="absolute right-0 top-full mt-1 bg-cc-card border border-cc-border rounded-lg shadow-lg py-1 min-w-[180px] z-50">
          {skills.map((s) => (
            <button
              key={s.slug}
              onClick={() => { openSkill(s.slug); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
            >
              <span className="font-medium">{s.name}</span>
              {s.description && (
                <span className="text-cc-muted ml-1.5">{s.description}</span>
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
