import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";

/** Which AI provider to use for validation and auto-naming. Persisted only when non-default. */
export type AiProvider = "openrouter" | "claude";

export interface CompanionSettings {
  openrouterApiKey: string;
  openrouterModel: string;
  /** OpenAI API key for session title generation fallback. Stored in settings.json. */
  openaiApiKey?: string;
  /** Which AI provider to use for validation and auto-naming. Absent means "openrouter" (default). */
  aiProvider?: AiProvider;
  linearApiKey: string;
  linearAutoTransition: boolean;
  linearAutoTransitionStateId: string;
  linearAutoTransitionStateName: string;
  editorTabEnabled: boolean;
  aiValidationEnabled: boolean;
  aiValidationAutoApprove: boolean;
  aiValidationAutoDeny: boolean;
  updatedAt: number;
}

const DEFAULT_PATH = join(homedir(), ".companion", "settings.json");

let loaded = false;
let filePath = DEFAULT_PATH;
let settings: CompanionSettings = {
  openrouterApiKey: "",
  openrouterModel: DEFAULT_OPENROUTER_MODEL,
  linearApiKey: "",
  linearAutoTransition: false,
  linearAutoTransitionStateId: "",
  linearAutoTransitionStateName: "",
  editorTabEnabled: false,
  aiValidationEnabled: false,
  aiValidationAutoApprove: true,
  aiValidationAutoDeny: true,
  updatedAt: 0,
};

function normalize(raw: Partial<CompanionSettings> | null | undefined): CompanionSettings {
  const openaiApiKey = typeof raw?.openaiApiKey === "string" && raw.openaiApiKey.trim()
    ? raw.openaiApiKey.trim()
    : undefined;
  return {
    openrouterApiKey: typeof raw?.openrouterApiKey === "string" ? raw.openrouterApiKey : "",
    openrouterModel:
      typeof raw?.openrouterModel === "string" && raw.openrouterModel.trim()
        ? raw.openrouterModel
        : DEFAULT_OPENROUTER_MODEL,
    ...(openaiApiKey !== undefined ? { openaiApiKey } : {}),
    ...(raw?.aiProvider === "claude" || raw?.aiProvider === "openrouter" ? { aiProvider: raw.aiProvider } : {}),
    linearApiKey: typeof raw?.linearApiKey === "string" ? raw.linearApiKey : "",
    linearAutoTransition: typeof raw?.linearAutoTransition === "boolean" ? raw.linearAutoTransition : false,
    linearAutoTransitionStateId: typeof raw?.linearAutoTransitionStateId === "string" ? raw.linearAutoTransitionStateId : "",
    linearAutoTransitionStateName: typeof raw?.linearAutoTransitionStateName === "string" ? raw.linearAutoTransitionStateName : "",
    editorTabEnabled: typeof raw?.editorTabEnabled === "boolean" ? raw.editorTabEnabled : false,
    aiValidationEnabled: typeof raw?.aiValidationEnabled === "boolean" ? raw.aiValidationEnabled : false,
    aiValidationAutoApprove: typeof raw?.aiValidationAutoApprove === "boolean" ? raw.aiValidationAutoApprove : true,
    aiValidationAutoDeny: typeof raw?.aiValidationAutoDeny === "boolean" ? raw.aiValidationAutoDeny : true,
    updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : 0,
  };
}

function ensureLoaded(): void {
  if (loaded) return;
  try {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf-8");
      settings = normalize(JSON.parse(raw) as Partial<CompanionSettings>);
    }
  } catch {
    settings = normalize(null);
  }
  loaded = true;
}

function persist(): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
}

export function getSettings(): CompanionSettings {
  ensureLoaded();
  return { ...settings };
}

export function updateSettings(
  patch: Partial<Pick<CompanionSettings, "openrouterApiKey" | "openrouterModel" | "openaiApiKey" | "aiProvider" | "linearApiKey" | "linearAutoTransition" | "linearAutoTransitionStateId" | "linearAutoTransitionStateName" | "editorTabEnabled" | "aiValidationEnabled" | "aiValidationAutoApprove" | "aiValidationAutoDeny">>,
): CompanionSettings {
  ensureLoaded();
  settings = normalize({
    openrouterApiKey: patch.openrouterApiKey ?? settings.openrouterApiKey,
    openrouterModel: patch.openrouterModel ?? settings.openrouterModel,
    openaiApiKey: patch.openaiApiKey ?? settings.openaiApiKey,
    aiProvider: patch.aiProvider ?? settings.aiProvider,
    linearApiKey: patch.linearApiKey ?? settings.linearApiKey,
    linearAutoTransition: patch.linearAutoTransition ?? settings.linearAutoTransition,
    linearAutoTransitionStateId: patch.linearAutoTransitionStateId ?? settings.linearAutoTransitionStateId,
    linearAutoTransitionStateName: patch.linearAutoTransitionStateName ?? settings.linearAutoTransitionStateName,
    editorTabEnabled: patch.editorTabEnabled ?? settings.editorTabEnabled,
    aiValidationEnabled: patch.aiValidationEnabled ?? settings.aiValidationEnabled,
    aiValidationAutoApprove: patch.aiValidationAutoApprove ?? settings.aiValidationAutoApprove,
    aiValidationAutoDeny: patch.aiValidationAutoDeny ?? settings.aiValidationAutoDeny,
    updatedAt: Date.now(),
  });
  persist();
  return { ...settings };
}

export function _resetForTest(customPath?: string): void {
  loaded = false;
  filePath = customPath || DEFAULT_PATH;
  settings = normalize(null);
}
