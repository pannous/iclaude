import { useState, useContext, useMemo, useCallback, type ComponentProps } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ContentBlock } from "../types.js";
import { ToolBlock, getToolIcon, getToolLabel, getPreview, ToolIcon } from "./ToolBlock.js";
import { CopyButton } from "./CopyButton.js";
import { messageToText } from "../utils/message-text.js";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { FeedSessionIdContext } from "./feed-context.js";

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-cc-border" />
        <span className="text-[11px] text-cc-muted italic font-mono-code shrink-0 px-1">
          {message.content}
        </span>
        <div className="flex-1 h-px bg-cc-border" />
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end gap-1.5 items-start animate-[fadeSlideIn_0.2s_ease-out]">
        <div className="max-w-[85%] sm:max-w-[80%] px-3 sm:px-4 py-2.5 rounded-[14px] rounded-br-[4px] bg-cc-user-bubble text-cc-fg">
          {message.images && message.images.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {message.images.map((img, i) => (
                <img
                  key={i}
                  src={`data:${img.media_type};base64,${img.data}`}
                  alt="attachment"
                  className="max-w-[150px] sm:max-w-[200px] max-h-[120px] sm:max-h-[150px] rounded-lg object-cover"
                />
              ))}
            </div>
          )}
          <div className="text-[13px] sm:text-[14px] leading-relaxed break-words">
            <MarkdownContent text={message.content} />
          </div>
        </div>
        <div className="mt-2">
          <CopyButton getText={() => messageToText(message)} title="Copy message" />
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="animate-[fadeSlideIn_0.2s_ease-out]">
      <AssistantMessage message={message} />
    </div>
  );
}

interface ToolGroupItem {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface ToolUseInfo {
  name: string;
  input: Record<string, unknown>;
}

type GroupedBlock =
  | { kind: "content"; block: ContentBlock }
  | { kind: "tool_group"; name: string; items: ToolGroupItem[] };

function groupContentBlocks(blocks: ContentBlock[]): GroupedBlock[] {
  const groups: GroupedBlock[] = [];

  for (const block of blocks) {
    if (block.type === "tool_use") {
      const last = groups[groups.length - 1];
      if (last?.kind === "tool_group" && last.name === block.name) {
        last.items.push({ id: block.id, name: block.name, input: block.input });
      } else {
        groups.push({
          kind: "tool_group",
          name: block.name,
          items: [{ id: block.id, name: block.name, input: block.input }],
        });
      }
    } else {
      groups.push({ kind: "content", block });
    }
  }

  return groups;
}

function stripScannedHtml(text: string, scannedHtml?: { original: string }[]): string {
  if (!scannedHtml || scannedHtml.length === 0) return text;
  let result = text;
  for (const frag of scannedHtml) {
    result = result.replace(frag.original, "");
  }
  return result.trim();
}

function mapToolUsesById(blocks: ContentBlock[]): Map<string, ToolUseInfo> {
  const map = new Map<string, ToolUseInfo>();
  for (const block of blocks) {
    if (block.type === "tool_use") {
      map.set(block.id, { name: block.name, input: block.input });
    }
  }
  return map;
}


function AssistantMessage({ message }: { message: ChatMessage }) {
  const blocks = message.contentBlocks || [];
  const grouped = useMemo(() => groupContentBlocks(blocks), [blocks]);
  const getText = useCallback(() => messageToText(message), [message]);
  const hasText = message.content || blocks.some(b => b.type === "text" || b.type === "thinking");
  const cleanContent = useMemo(() => stripScannedHtml(message.content, message.scannedHtml), [message.content, message.scannedHtml]);
  const toolUseById = useMemo(() => mapToolUsesById(blocks), [blocks]);

  if (blocks.length === 0 && message.content) {
    return (
      <div className="flex items-start gap-3">
        <AssistantAvatar />
        <div className="flex-1 min-w-0">
          {cleanContent && <MarkdownContent text={cleanContent} showCursor={!!message.isStreaming} />}
          {message.scannedImages && message.scannedImages.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {message.scannedImages.map((img, i) => (
                <img
                  key={i}
                  src={img.src}
                  alt="detected image"
                  className="max-w-[400px] max-h-[300px] rounded-lg border border-cc-border object-contain"
                  loading="lazy"
                />
              ))}
            </div>
          )}
          {message.scannedHtml && message.scannedHtml.length > 0 && (
            <div className="space-y-2 mt-3">
              {message.scannedHtml.map((htmlFragment, i) => (
                <HtmlPreview key={i} html={htmlFragment.html} preview={htmlFragment.preview} />
              ))}
            </div>
          )}
        </div>
        <div className="mt-0.5">
          <CopyButton getText={getText} title="Copy response" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="flex-1 min-w-0 space-y-3">
        {grouped.map((group, i) => {
          if (group.kind === "content") {
            return <ContentBlockRenderer key={i} block={group.block} scannedHtml={message.scannedHtml} toolUseById={toolUseById} />;
          }
          if (group.items.length === 1) {
            const item = group.items[0];
            return <ToolBlock key={i} name={item.name} input={item.input} toolUseId={item.id} />;
          }
          return <ToolGroupBlock key={i} name={group.name} items={group.items} />;
        })}
        {message.scannedImages && message.scannedImages.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {message.scannedImages.map((img, i) => (
              <img
                key={i}
                src={img.src}
                alt="detected image"
                className="max-w-[400px] max-h-[300px] rounded-lg border border-cc-border object-contain"
                loading="lazy"
              />
            ))}
          </div>
        )}
        {message.scannedHtml && message.scannedHtml.length > 0 && (
          <div className="space-y-2">
            {message.scannedHtml.map((htmlFragment, i) => (
              <HtmlPreview key={i} html={htmlFragment.html} preview={htmlFragment.preview} />
            ))}
          </div>
        )}
      </div>
      {hasText && (
        <div className="mt-0.5">
          <CopyButton getText={getText} title="Copy response" />
        </div>
      )}
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-cc-primary/10 flex items-center justify-center shrink-0 mt-0.5">
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-cc-primary">
        <circle cx="8" cy="8" r="3" />
      </svg>
    </div>
  );
}

function MarkdownContent({ text, showCursor = false }: { text: string; showCursor?: boolean }) {
  return (
    <div className="markdown-body text-[14px] sm:text-[15px] text-cc-fg leading-relaxed overflow-hidden">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-cc-fg">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-cc-fg mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-cc-fg mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-cc-fg mt-3 mb-1">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-cc-fg">{children}</li>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-cc-primary hover:underline">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-cc-primary/30 pl-3 my-2 text-cc-muted italic">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="border-cc-border my-4" />
          ),
          code: (props: ComponentProps<"code">) => {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = match || (typeof children === "string" && children.includes("\n"));

            if (isBlock) {
              const lang = match?.[1] || "";
              return (
                <div className="my-2 rounded-lg overflow-hidden border border-cc-border">
                  {lang && (
                    <div className="px-3 py-1.5 bg-cc-code-bg/80 border-b border-cc-border text-[10px] text-cc-muted font-mono-code uppercase tracking-wider">
                      {lang}
                    </div>
                  )}
                  <pre className="px-2 sm:px-3 py-2 sm:py-2.5 bg-cc-code-bg text-cc-code-fg text-[12px] sm:text-[13px] font-mono-code leading-relaxed overflow-x-auto">
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }

            // Detect file paths in inline code and make them clickable
            // Uses <button> for reliable touch handling on iOS/iPadOS
            const text = typeof children === "string" ? children : "";
            const filePathMatch = text.match(/^(\/[^\s:]+|[a-zA-Z][\w.-]*(?:\/[\w.-]+)+)(?::(\d+))?$/);
            if (filePathMatch) {
              const filePath = filePathMatch[1];
              return (
                <button
                  type="button"
                  className="px-1 py-0.5 rounded bg-cc-code-bg/30 text-[13px] font-mono-code text-cc-primary hover:bg-cc-primary/20 cursor-pointer transition-colors underline decoration-cc-primary/30 inline"
                  onClick={() => useStore.getState().openFileInEditor(filePath)}
                  title={`Open ${filePath} in editor`}
                >
                  {children}
                </button>
              );
            }

            return (
              <code className="px-1.5 py-0.5 rounded-md bg-cc-fg/[0.06] text-[13px] font-mono-code text-cc-fg/80">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border border-cc-border rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-cc-code-bg/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-1.5 text-left text-xs font-semibold text-cc-fg border-b border-cc-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 text-xs text-cc-fg border-b border-cc-border">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </Markdown>
      {showCursor && (
        <span
          data-testid="assistant-stream-cursor"
          className="inline-block w-0.5 h-4 bg-cc-primary ml-0.5 align-middle animate-[pulse-dot_0.8s_ease-in-out_infinite]"
        />
      )}
    </div>
  );
}

function ContentBlockRenderer({
  block,
  scannedHtml,
  toolUseById,
}: {
  block: ContentBlock;
  scannedHtml?: { original: string }[];
  toolUseById: Map<string, ToolUseInfo>;
}) {
  if (block.type === "text") {
    const cleaned = stripScannedHtml(block.text, scannedHtml);
    return cleaned ? <MarkdownContent text={cleaned} /> : null;
  }

  if (block.type === "thinking") {
    return <ThinkingBlock text={block.thinking} />;
  }

  if (block.type === "tool_use") {
    return <ToolBlock name={block.name} input={block.input} toolUseId={block.id} />;
  }

  if (block.type === "tool_result") {
    const rawContent = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
    const linkedTool = toolUseById.get(block.tool_use_id);
    const toolName = linkedTool?.name;
    const isError = block.is_error ?? false;

    // Lazy result: content was stripped server-side for subagent messages
    if (rawContent === "__LAZY_RESULT__") {
      return <LazyToolResult toolUseId={block.tool_use_id} toolName={toolName} />;
    }

    if (toolName === "Bash") {
      return <BashResultBlock text={rawContent} isError={isError} />;
    }
    return (
      <div className={`text-xs font-mono-code rounded-lg px-3 py-2 border ${
        isError
          ? "bg-cc-error/5 border-cc-error/20 text-cc-error"
          : "bg-cc-card border-cc-border text-cc-muted"
      } max-h-40 overflow-y-auto whitespace-pre-wrap`}>
        {rawContent}
      </div>
    );
  }

  return null;
}

function BashResultBlock({ text, isError }: { text: string; isError: boolean }) {
  const lines = text.split(/\r?\n/);
  const hasMore = lines.length > 20;
  const [showFull, setShowFull] = useState(false);
  const rendered = showFull || !hasMore ? text : lines.slice(-20).join("\n");

  return (
    <div className={`rounded-lg border ${
      isError
        ? "bg-cc-error/5 border-cc-error/20"
        : "bg-cc-card border-cc-border"
    }`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cc-border">
        <span className={`text-[10px] font-medium ${
          isError ? "text-cc-error" : "text-cc-muted"
        }`}>
          {hasMore && !showFull ? "Output (last 20 lines)" : "Output"}
        </span>
        {hasMore && (
          <button
            onClick={() => setShowFull(!showFull)}
            className="text-[10px] text-cc-primary hover:underline cursor-pointer"
          >
            {showFull ? "Show tail" : "Show full"}
          </button>
        )}
      </div>
      <pre className={`text-xs font-mono-code px-3 py-2 whitespace-pre-wrap max-h-60 overflow-y-auto ${
        isError ? "text-cc-error" : "text-cc-muted"
      }`}>
        {rendered}
      </pre>
    </div>
  );
}

/** Lazy-loads tool_result content stripped from subagent messages */
function LazyToolResult({ toolUseId, toolName }: { toolUseId: string; toolName?: string }) {
  const sessionId = useContext(FeedSessionIdContext);
  const [data, setData] = useState<{ content: string; is_error: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (data || loading) return;
    setLoading(true);
    try {
      setData(await api.getToolResult(sessionId, toolUseId));
    } catch {
      setData({ content: "(failed to load result)", is_error: true });
    } finally {
      setLoading(false);
    }
  }, [sessionId, toolUseId, data, loading]);

  const handleClick = useCallback(() => {
    if (!expanded) load();
    setExpanded(!expanded);
  }, [expanded, load]);

  return (
    <button
      onClick={handleClick}
      className="w-full text-left text-[10px] text-cc-muted hover:text-cc-primary cursor-pointer py-1 transition-colors"
    >
      {!expanded && (loading ? "Loading output..." : "Show output")}
      {expanded && data && (
        toolName === "Bash"
          ? <BashResultBlock text={data.content} isError={data.is_error} />
          : <div className={`text-xs font-mono-code rounded-lg px-3 py-2 border ${
              data.is_error ? "bg-cc-error/5 border-cc-error/20 text-cc-error" : "bg-cc-card border-cc-border text-cc-muted"
            } max-h-40 overflow-y-auto whitespace-pre-wrap`}>{data.content}</div>
      )}
      {expanded && loading && <span className="animate-pulse">Loading output...</span>}
      {expanded && !loading && !data && "Show output"}
    </button>
  );
}

function ToolGroupBlock({ name, items }: { name: string; items: ToolGroupItem[] }) {
  const [open, setOpen] = useState(false);
  const iconType = getToolIcon(name);
  const label = getToolLabel(name);

  return (
    <div className="border border-cc-border rounded-[10px] overflow-hidden bg-cc-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-cc-hover transition-colors cursor-pointer"
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 text-cc-muted transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <ToolIcon type={iconType} />
        <span className="text-xs font-medium text-cc-fg">{label}</span>
        <span className="text-[10px] text-cc-muted bg-cc-hover rounded-full px-1.5 py-0.5 tabular-nums">
          {items.length}
        </span>
      </button>

      {open && (
        <div className="border-t border-cc-border px-3 py-1.5">
          {items.map((item, i) => {
            const preview = getPreview(item.name, item.input);
            // For Bash tools, show the actual command when expanded (description is already in the header)
            const expandedText = item.name === "Bash" && typeof item.input.command === "string"
              ? item.input.command : preview;
            const filePath = (item.name === "Read" || item.name === "Write" || item.name === "Edit") && item.input.file_path
              ? String(item.input.file_path) : null;
            return (
              <div key={item.id || i} className="flex items-center gap-2 py-1 text-xs font-mono-code truncate">
                <span className="w-1 h-1 rounded-full bg-cc-muted/40 shrink-0" />
                {filePath ? (
                  <button
                    type="button"
                    className="truncate text-cc-muted hover:text-cc-primary cursor-pointer underline decoration-cc-muted/30 hover:decoration-cc-primary/50 transition-colors text-left"
                    onClick={() => useStore.getState().openFileInEditor(filePath)}
                    title={`Open ${filePath} in editor`}
                  >
                    {preview || filePath}
                  </button>
                ) : (
                  <span className="truncate text-cc-muted">{expandedText || JSON.stringify(item.input).slice(0, 80)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const normalized = text.trim();
  const preview = normalized.replace(/\s+/g, " ").slice(0, 90);
  const [open, setOpen] = useState(Boolean(normalized));

  return (
    <div className="border border-cc-border rounded-[12px] overflow-hidden bg-cc-card/70 backdrop-blur-[2px]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-cc-muted hover:bg-cc-hover/70 transition-colors cursor-pointer"
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-cc-primary/10 text-cc-primary shrink-0">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
            <path d="M8 2.5a3.5 3.5 0 013.5 3.5c0 1.3-.7 2.1-1.4 2.8-.6.6-1.1 1.1-1.1 1.7V11" strokeLinecap="round" />
            <circle cx="8" cy="13" r="0.7" fill="currentColor" stroke="none" />
            <path d="M5.3 3.8A3.5 3.5 0 004.5 6c0 1.3.7 2.1 1.4 2.8.6.6 1.1 1.1 1.1 1.7V11" strokeLinecap="round" />
          </svg>
        </span>
        <span className="font-medium text-cc-fg">Reasoning</span>
        <span className="text-cc-muted/60">{text.length} chars</span>
        {!open && preview && (
          <span className="text-cc-muted truncate max-w-[55%]">{preview}</span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0">
          <div className="border border-cc-border/70 rounded-lg px-3 py-2 bg-cc-bg/60 max-h-60 overflow-y-auto">
            <div className="markdown-body text-[13px] text-cc-muted leading-relaxed">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  code: ({ children }) => (
                    <code className="px-1.5 py-0.5 rounded-md bg-cc-fg/[0.06] text-cc-fg/80 font-mono-code text-[12px]">
                      {children}
                    </code>
                  ),
                }}
              >
                {normalized || "No thinking text captured."}
              </Markdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HtmlPreview({ html, preview }: { html: string; preview: string }) {
  const [open, setOpen] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const yoloMode = useStore((s) => s.yoloMode);
  const iframeRef = useState<HTMLIFrameElement | null>(null)[0];

  const handleIframeLoad = (iframe: HTMLIFrameElement) => {
    if (!yoloMode || !iframe.contentWindow) return;
    (iframe.contentWindow as any).eval(`
      window.vibeCommand = async function(command, options = {}) {
        try {
          const response = await fetch('/api/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: command, cwd: options && options.cwd })
          });
          const result = await response.json();
          return result.success
            ? { success: true, output: result.output }
            : { success: false, error: result.error, exitCode: result.exitCode, stderr: result.stderr, stdout: result.stdout };
        } catch (err) { return { success: false, error: err.message }; }
      };
      window.vibe = {
        command: window.vibeCommand,
        playSound: (sound = 'Ping') => window.vibeCommand('afplay /System/Library/Sounds/' + (sound || 'Ping') + '.aiff'),
        notify: (title, body) => {
          window.parent.postMessage({ type: 'vibe:notify', title: title, body: body }, '*');
        }
      };
    `);
  };

  return (
    <div className="border border-cc-border rounded-[10px] overflow-hidden bg-cc-card">
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 flex-1 min-w-0 hover:bg-cc-hover rounded transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 16 16" fill="currentColor"
            className={`w-3 h-3 text-cc-muted transition-transform shrink-0 ${open ? "rotate-90" : ""}`}>
            <path d="M6 4l4 4-4 4" />
          </svg>
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-cc-primary shrink-0">
            <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z" />
          </svg>
          <span className="font-medium text-cc-fg">HTML Fragment</span>
          <span className="text-cc-muted/70 truncate flex-1 text-left">{preview}</span>
        </button>
        {yoloMode && (
          <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded font-mono shrink-0">
            YOLO
          </span>
        )}
        <button
          onClick={() => setShowSource(!showSource)}
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 cursor-pointer transition-colors ${
            showSource ? "bg-cc-primary/10 text-cc-primary" : "text-cc-muted hover:text-cc-fg"
          }`}
        >
          Source
        </button>
      </div>
      {open && (
        <div className="border-t border-cc-border">
          {showSource ? (
            <pre className="px-3 py-2 text-[11px] font-mono-code text-cc-muted bg-cc-code-bg max-h-[400px] overflow-auto whitespace-pre-wrap">
              {html}
            </pre>
          ) : (
            <iframe
              ref={(el) => { if (el && el !== iframeRef) handleIframeLoad(el); }}
              srcDoc={html}
              className="w-full h-[400px] bg-white"
              sandbox={yoloMode ? undefined : "allow-scripts"}
              title="HTML preview"
            />
          )}
        </div>
      )}
    </div>
  );
}
