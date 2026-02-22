import { DiffViewer } from "./DiffViewer.js";
import { useStore } from "../store.js";

type ToolInput = Record<string, unknown>;

export function BashDisplay({ input }: { input: ToolInput }) {
  return (
    <div className="space-y-1.5">
      {!!input.description && (
        <div className="text-[11px] text-cc-muted italic">{String(input.description)}</div>
      )}
      <pre className="px-3 py-2 rounded-lg bg-cc-code-bg text-cc-code-fg text-[12px] font-mono-code leading-relaxed overflow-x-auto">
        <span className="text-cc-muted select-none">$ </span>
        {String(input.command || "")}
      </pre>
      {!!input.timeout && (
        <div className="text-[10px] text-cc-muted">timeout: {String(input.timeout)}ms</div>
      )}
    </div>
  );
}

export function EditDisplay({ input }: { input: ToolInput }) {
  const filePath = String(input.file_path || "");
  const oldStr = String(input.old_string || "");
  const newStr = String(input.new_string || "");
  const rawChanges = Array.isArray(input.changes)
    ? input.changes as Array<{ path?: unknown; kind?: unknown }>
    : [];
  const changes = rawChanges
    .map((c) => ({
      path: typeof c.path === "string" ? c.path : "",
      kind: typeof c.kind === "string" ? c.kind : "update",
    }))
    .filter((c) => c.path);

  return (
    <div className="space-y-1.5">
      {!!input.replace_all && (
        <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-cc-warning/10 text-cc-warning">
          replace all
        </span>
      )}
      {(oldStr || newStr) ? (
        <DiffViewer oldText={oldStr} newText={newStr} fileName={filePath} mode="compact" />
      ) : changes.length > 0 ? (
        <div className="space-y-1.5">
          {!!filePath && <div className="text-xs text-cc-muted font-mono-code">{filePath}</div>}
          {changes.map((change, i) => (
            <div key={`${change.path}-${i}`} className="flex items-center gap-2 text-[11px] text-cc-fg">
              <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-cc-primary/10 text-cc-primary min-w-[54px] text-center">
                {change.kind}
              </span>
              <span className="font-mono-code truncate">{change.path}</span>
            </div>
          ))}
        </div>
      ) : (
        <pre className="text-[11px] text-cc-muted font-mono-code whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function WriteDisplay({ input }: { input: ToolInput }) {
  const filePath = String(input.file_path || "");
  const content = String(input.content || "");
  return <DiffViewer newText={content} fileName={filePath} mode="compact" />;
}

export function ReadDisplay({ input }: { input: ToolInput }) {
  const filePath = String(input.file_path || input.path || "");
  const offset = input.offset as number | undefined;
  const limit = input.limit as number | undefined;

  return (
    <div className="space-y-1">
      <div
        className="text-xs text-cc-muted font-mono-code hover:text-cc-primary cursor-pointer transition-colors"
        onClick={() => filePath && useStore.getState().openFileInEditor(filePath)}
        title={`Open ${filePath} in editor`}
      >{filePath}</div>
      {(offset != null || limit != null) && (
        <div className="flex gap-2 text-[10px] text-cc-muted">
          {offset != null && <span>offset: {offset}</span>}
          {limit != null && <span>limit: {limit}</span>}
        </div>
      )}
    </div>
  );
}

export function GlobDisplay({ input }: { input: ToolInput }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-mono-code text-cc-code-fg">{String(input.pattern || "")}</div>
      {!!input.path && (
        <div className="text-[10px] text-cc-muted">
          in: <span className="font-mono-code">{String(input.path)}</span>
        </div>
      )}
    </div>
  );
}

export function GrepDisplay({ input }: { input: ToolInput }) {
  return (
    <div className="space-y-1">
      <pre className="px-2 py-1.5 rounded bg-cc-code-bg text-cc-code-fg text-[12px] font-mono-code overflow-x-auto">
        {String(input.pattern || "")}
      </pre>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-cc-muted">
        {!!input.path && (
          <span>path: <span className="font-mono-code">{String(input.path)}</span></span>
        )}
        {!!input.glob && (
          <span>glob: <span className="font-mono-code">{String(input.glob)}</span></span>
        )}
        {!!input.output_mode && <span>mode: {String(input.output_mode)}</span>}
        {!!input.context && <span>context: {String(input.context)}</span>}
        {!!input.head_limit && <span>limit: {String(input.head_limit)}</span>}
      </div>
    </div>
  );
}

export function GenericDisplay({
  input,
  description,
}: {
  input: ToolInput;
  description?: string;
}) {
  const entries = Object.entries(input).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );

  if (entries.length === 0 && description) {
    return <div className="text-xs text-cc-fg">{description}</div>;
  }

  return (
    <div className="space-y-1">
      {description && <div className="text-xs text-cc-muted mb-1">{description}</div>}
      <div className="bg-cc-code-bg/30 rounded-lg px-3 py-2 space-y-1">
        {entries.map(([key, value]) => {
          const displayValue = typeof value === "string"
            ? value.length > 200 ? value.slice(0, 200) + "..." : value
            : JSON.stringify(value);
          return (
            <div key={key} className="flex gap-2 text-[11px] font-mono-code">
              <span className="text-cc-muted shrink-0">{key}:</span>
              <span className="text-cc-fg break-all">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
