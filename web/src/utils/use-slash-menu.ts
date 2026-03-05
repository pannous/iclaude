import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useStore } from "../store.js";

export interface CommandItem {
  name: string;
  type: "command" | "skill";
}

/**
 * Collects slash commands and skills from all active sessions.
 * Useful on the HomePage where no single session is selected yet.
 */
export function useCachedSlashCommands(): CommandItem[] {
  const sessions = useStore((s) => s.sessions);
  return useMemo(() => {
    const seen = new Set<string>();
    const cmds: CommandItem[] = [];
    if (!sessions) return cmds;
    for (const session of sessions.values()) {
      if (session.slash_commands) {
        for (const cmd of session.slash_commands) {
          const key = `cmd:${cmd}`;
          if (!seen.has(key)) { seen.add(key); cmds.push({ name: cmd, type: "command" }); }
        }
      }
      if (session.skills) {
        for (const skill of session.skills) {
          const key = `skill:${skill}`;
          if (!seen.has(key)) { seen.add(key); cmds.push({ name: skill, type: "skill" }); }
        }
      }
    }
    return cmds;
  }, [sessions]);
}

/**
 * Reusable slash command menu logic for any textarea.
 * Provide the current text and a list of available commands.
 */
export function useSlashMenu(text: string, commands: CommandItem[]) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredCommands = useMemo(() => {
    if (!slashMenuOpen) return [];
    const match = text.match(/^\/(\S*)$/);
    if (!match) return [];
    const query = match[1].toLowerCase();
    if (query === "") return commands;
    return commands.filter((cmd) => cmd.name.toLowerCase().includes(query));
  }, [text, slashMenuOpen, commands]);

  useEffect(() => {
    const shouldOpen = text.startsWith("/") && /^\/\S*$/.test(text) && commands.length > 0;
    if (shouldOpen && !slashMenuOpen) {
      setSlashMenuOpen(true);
      setSlashMenuIndex(0);
    } else if (!shouldOpen && slashMenuOpen) {
      setSlashMenuOpen(false);
    }
  }, [text, commands.length, slashMenuOpen]);

  useEffect(() => {
    if (slashMenuIndex >= filteredCommands.length) {
      setSlashMenuIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, slashMenuIndex]);

  useEffect(() => {
    if (!menuRef.current || !slashMenuOpen) return;
    const items = menuRef.current.querySelectorAll("[data-cmd-index]");
    const selected = items[slashMenuIndex];
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [slashMenuIndex, slashMenuOpen]);

  const selectCommand = useCallback((cmd: CommandItem): string => {
    setSlashMenuOpen(false);
    return `/${cmd.name} `;
  }, []);

  const close = useCallback(() => setSlashMenuOpen(false), []);

  return {
    slashMenuOpen,
    slashMenuIndex,
    setSlashMenuIndex,
    filteredCommands,
    menuRef,
    selectCommand,
    close,
  };
}
