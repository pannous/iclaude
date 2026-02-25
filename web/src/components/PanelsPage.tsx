import { useEffect, useMemo, useState } from "react";
import { api, type PanelInfo } from "../api.js";
import { useStore } from "../store.js";
import { PANEL_ICON_PATHS } from "../utils/panel-icons.js";

function PanelIcon({ name, className }: { name?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={PANEL_ICON_PATHS[name || ""] || PANEL_ICON_PATHS.terminal} />
    </svg>
  );
}

function PanelCard({ panel, onClick }: { panel: PanelInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cc-card border border-cc-border hover:border-cc-primary/40 hover:bg-cc-hover transition-colors cursor-pointer text-left group"
    >
      <div className="w-9 h-9 rounded-lg bg-cc-hover flex items-center justify-center shrink-0 group-hover:bg-cc-primary/10 transition-colors">
        <PanelIcon name={panel.icon} className="w-5 h-5 text-cc-muted group-hover:text-cc-primary transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-cc-fg">{panel.name}</div>
        {panel.description && (
          <div className="text-xs text-cc-muted truncate">{panel.description}</div>
        )}
      </div>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
        className="w-3.5 h-3.5 text-cc-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <path d="M6 4l4 4-4 4" />
      </svg>
    </button>
  );
}

export function PanelsPage() {
  const [panels, setPanels] = useState<PanelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const openPanel = useStore((s) => s.openPanel);

  useEffect(() => {
    setLoading(true);
    api.listPanels()
      .then(setPanels)
      .catch(() => setPanels([]))
      .finally(() => setLoading(false));
  }, []);

  const htmlPanels = useMemo(() => panels.filter((s) => s.type !== "markdown"), [panels]);
  const commands = useMemo(() => panels.filter((s) => s.type === "markdown"), [panels]);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-cc-fg mb-1">Plugins</h1>
      <p className="text-sm text-cc-muted mb-6">
        Interactive panels and slash commands.
        Add panels in <code className="text-xs bg-cc-hover px-1 py-0.5 rounded">~/.companion/panels/</code>,
        commands in <code className="text-xs bg-cc-hover px-1 py-0.5 rounded">.claude/commands/</code>.
      </p>

      {loading ? (
        <div className="text-sm text-cc-muted text-center py-12">Loading...</div>
      ) : panels.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-cc-muted mb-3">No panels or commands found.</p>
          <p className="text-xs text-cc-muted">
            Create a folder in <code className="bg-cc-hover px-1 py-0.5 rounded">~/.companion/panels/my-panel/</code> with
            a <code className="bg-cc-hover px-1 py-0.5 rounded">panel.json</code> and <code className="bg-cc-hover px-1 py-0.5 rounded">panel.html</code>.
          </p>
        </div>
      ) : (
        <>
          {htmlPanels.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-semibold text-cc-muted uppercase tracking-wider mb-2">Panels</h2>
              <div className="grid gap-2">
                {htmlPanels.map((s) => (
                  <PanelCard key={s.slug} panel={s} onClick={() => openPanel(s.slug)} />
                ))}
              </div>
            </section>
          )}

          {commands.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-cc-muted uppercase tracking-wider mb-2">Slash Commands</h2>
              <div className="grid gap-2">
                {commands.map((s) => (
                  <PanelCard key={s.slug} panel={s} onClick={() => openPanel(s.slug)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
