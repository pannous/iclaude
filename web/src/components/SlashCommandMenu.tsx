import type { CommandItem } from "../utils/use-slash-menu.js";

interface SlashCommandMenuProps {
  open: boolean;
  commands: CommandItem[];
  selectedIndex: number;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (cmd: CommandItem) => void;
}

export function SlashCommandMenu({ open, commands, selectedIndex, menuRef, onSelect }: SlashCommandMenuProps) {
  if (!open || commands.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute left-2 right-2 bottom-full mb-1 max-h-[240px] overflow-y-auto bg-cc-card border border-cc-border rounded-[10px] shadow-lg z-20 py-1"
    >
      {commands.map((cmd, i) => (
        <button
          key={`${cmd.type}-${cmd.name}`}
          data-cmd-index={i}
          onClick={() => onSelect(cmd)}
          className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
            i === selectedIndex ? "bg-cc-hover" : "hover:bg-cc-hover/50"
          }`}
        >
          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-cc-hover text-cc-muted shrink-0">
            {cmd.type === "skill" ? (
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 1l1.796 3.64L14 5.255l-3 2.924.708 4.126L8 10.5l-3.708 1.805L5 8.18 2 5.255l4.204-.615L8 1z" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path d="M5 12L10 4" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-medium text-cc-fg">/{cmd.name}</span>
            <span className="ml-2 text-[11px] text-cc-muted">{cmd.type}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
