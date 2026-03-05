/**
 * Client-side commands — intercepted before reaching the CLI agent.
 * Commands are consumed silently: input is cleared, nothing is sent or shown in chat.
 */

import { useStore } from "../store.js";
import { stopReadback, toggleReadback } from "./readback.js";

export interface ClientCommand {
  name: string;
  description: string;
  handler: (args: string) => void;
}

const CLIENT_COMMANDS: ClientCommand[] = [
  {
    name: "readback",
    description: "Toggle TTS readback of assistant responses",
    handler: () => toggleReadback(),
  },
  {
    name: "clear",
    description: "Reset current session",
    handler: () => {
      stopReadback();
      useStore.getState().newSession();
    },
  },
];

const commandMap = new Map(CLIENT_COMMANDS.map((c) => [c.name.toLowerCase(), c]));

/**
 * Try to handle a message as a client-side command.
 * Returns true if the message was consumed (caller should not send it to CLI).
 */
export function tryClientCommand(message: string): boolean {
  const match = message.match(/^\/(\S+)(.*)$/);
  if (!match) return false;
  const cmd = commandMap.get(match[1].toLowerCase());
  if (!cmd) return false;
  cmd.handler(match[2].trim());
  return true;
}

export function getClientCommands(): ClientCommand[] {
  return CLIENT_COMMANDS;
}
