import { useState, useContext, useMemo, useCallback, type ComponentProps } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ContentBlock } from "../types.js";
import { ToolBlock, getToolIcon, getToolLabel, getPreview, ToolIcon } from "./ToolBlock.js";
import { CopyButton } from "./CopyButton.js";
import { RunnableCodeBlock, RUNNABLE_LANGS } from "./RunCodeButton.js";
import { messageToText } from "../utils/message-text.js";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { FeedSessionIdContext } from "./feed-context.js";
import { ansiToHtml, hasAnsi } from "../utils/ansi.js";

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    const isHook = typeof message.content === "string" && message.content.startsWith("Hook ");
    if (isHook) {
      return (
        <div className="-my-1.5 sm:-my-2.5 text-center leading-tight">
          <span className="text-[10px] text-cc-muted/50 font-mono-code">
            {message.content}
          </span>
        </div>
      );
    }
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
    return <UserMessage message={message} />;
  }

  // Assistant message
  return (
    <div className="animate-[fadeSlideIn_0.2s_ease-out]">
      <AssistantMessage message={message} />
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  const sessionId = useContext(FeedSessionIdContext);
  const isQueued = useStore(
    (s) => !!message.id && (s.queuedMessageIds.get(sessionId ?? "") ?? new Set()).has(message.id)
  );
  const unmarkMessageQueued = useStore((s) => s.unmarkMessageQueued);
  const setMessages = useStore((s) => s.setMessages);

  const handleCancel = useCallback(async () => {
    if (!sessionId || !message.id) return;
    // Optimistically remove from store; server will echo user_message_dequeued to confirm.
    unmarkMessageQueued(sessionId, message.id);
    const current = useStore.getState().messages.get(sessionId) ?? [];
    setMessages(sessionId, current.filter(m => m.id !== message.id));
    await api.cancelQueuedMessage(sessionId, message.id).catch(() => {});
  }, [sessionId, message.id, unmarkMessageQueued, setMessages]);

  const handleSendNow = useCallback(async () => {
    if (!sessionId || !message.id) return;
    unmarkMessageQueued(sessionId, message.id);
    await api.flushQueuedMessage(sessionId, message.id).catch(() => {});
  }, [sessionId, message.id, unmarkMessageQueued]);

  const cleanUserContent = stripScannedHtml(message.content, message.scannedHtml);
  return (
    <div className="flex flex-col items-end gap-2 animate-[fadeSlideIn_0.2s_ease-out]">
      <div className="flex justify-end gap-1.5 items-start">
        {isQueued && (
          <>
            <button
              onClick={handleSendNow}
              title="Send now (bypass queue)"
              className="mt-2 p-1 rounded-full text-cc-muted hover:text-cc-fg hover:bg-cc-surface-raised transition-colors"
            >
              {/* right-pointing triangle / play icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <polygon points="3,2 12,7 3,12" />
              </svg>
            </button>
            <button
              onClick={handleCancel}
              title="Cancel queued message"
              className="mt-2 p-1 rounded-full text-cc-muted hover:text-cc-fg hover:bg-cc-surface-raised transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
              </svg>
            </button>
          </>
        )}
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
          {cleanUserContent && (
            <div className="text-[13px] sm:text-[14px] leading-relaxed break-words">
              <MarkdownContent text={cleanUserContent} />
            </div>
          )}
        </div>
        <div className="mt-2">
          <CopyButton getText={() => messageToText(message)} title="Copy message" />
        </div>
      </div>
      {message.scannedHtml && message.scannedHtml.length > 0 && (
        <div className="w-full space-y-2">
          {message.scannedHtml.map((htmlFragment) => (
            <HtmlPreview key={htmlFragment.fragmentId} html={htmlFragment.html} preview={htmlFragment.preview} fragmentId={htmlFragment.fragmentId} />
          ))}
        </div>
      )}
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
          {message.scannedHtmlFiles && message.scannedHtmlFiles.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {message.scannedHtmlFiles.map((file, i) => (
                <HtmlFileLink key={i} filename={file.filename} url={file.url} path={file.path} />
              ))}
            </div>
          )}
          {message.scannedHtml && message.scannedHtml.length > 0 && (
            <div className="space-y-2 mt-3">
              {message.scannedHtml.map((htmlFragment, i) => (
                <HtmlPreview key={htmlFragment.fragmentId} html={htmlFragment.html} preview={htmlFragment.preview} fragmentId={htmlFragment.fragmentId} />
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
        {message.scannedHtmlFiles && message.scannedHtmlFiles.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {message.scannedHtmlFiles.map((file, i) => (
              <HtmlFileLink key={i} filename={file.filename} url={file.url} path={file.path} />
            ))}
          </div>
        )}
        {message.scannedHtml && message.scannedHtml.length > 0 && (
          <div className="space-y-2">
            {message.scannedHtml.map((htmlFragment, i) => (
              <HtmlPreview key={htmlFragment.fragmentId} html={htmlFragment.html} preview={htmlFragment.preview} fragmentId={htmlFragment.fragmentId} />
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
              const codeText = typeof children === "string" ? children : String(children ?? "");
              const pre = (
                <pre className="px-2 sm:px-3 py-2 sm:py-2.5 bg-cc-code-bg text-cc-code-fg text-[12px] sm:text-[13px] font-mono-code leading-relaxed overflow-x-auto">
                  <code>{children}</code>
                </pre>
              );

              if (lang && RUNNABLE_LANGS.has(lang)) {
                return (
                  <RunnableCodeBlock lang={lang} code={codeText}>
                    {pre}
                  </RunnableCodeBlock>
                );
              }

              return (
                <div className="my-2 rounded-lg overflow-hidden border border-cc-border">
                  {lang && (
                    <div className="px-3 py-1.5 bg-cc-code-bg/80 border-b border-cc-border text-[10px] text-cc-muted font-mono-code uppercase tracking-wider">
                      {lang}
                    </div>
                  )}
                  {pre}
                </div>
              );
            }

            // Detect file paths in inline code and make them clickable.
            // HTML files open in a new tab via the proxy; others open in the editor.
            // Bare filenames with a known extension trigger a project-wide search.
            const text = typeof children === "string" ? children : "";
            const filePathMatch = text.match(/^(\/[^\s:]+|[a-zA-Z][\w.-]*(?:\/[\w.-]+)+)(?::(\d+))?$/);
            if (filePathMatch) {
              const filePath = filePathMatch[1];
              const isHtmlFile = /\.html?$/i.test(filePath);
              if (isHtmlFile) {
                return (
                  <a
                    href={`/api/fs/html?path=${encodeURIComponent(filePath)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-1 py-0.5 rounded bg-cc-code-bg/30 text-[13px] font-mono-code text-cc-primary hover:bg-cc-primary/20 cursor-pointer transition-colors underline decoration-cc-primary/30 inline"
                    title={`Open ${filePath} in browser`}
                  >
                    {children}
                  </a>
                );
              }
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
            const urlMatch = text.match(INLINE_URL_RE);
            if (urlMatch) {
              const href = urlMatch[1].startsWith("http") ? urlMatch[1] : `https://${urlMatch[1]}`;
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-1 py-0.5 rounded bg-cc-code-bg/30 text-[13px] font-mono-code text-cc-primary hover:bg-cc-primary/20 cursor-pointer transition-colors underline decoration-cc-primary/30 inline"
                  title={`Open ${href}`}
                >
                  {children}
                </a>
              );
            }
            const bareMatch = text.match(BARE_FILENAME_RE);
            if (bareMatch) {
              return <BareFilenameLink filename={bareMatch[1]} line={bareMatch[3]} />;
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
  const darkMode = useStore(s => s.darkMode);
  const lines = text.split(/\r?\n/);
  const hasMore = lines.length > 20;
  const [showFull, setShowFull] = useState(false);
  const rawText = showFull || !hasMore ? text : lines.slice(-20).join("\n");
  const hasColor = hasAnsi(rawText);
  const htmlContent = hasColor ? ansiToHtml(rawText, darkMode) : null;

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
        <div className="flex items-center gap-1">
          {hasMore && (
            <button
              onClick={() => setShowFull(!showFull)}
              className="text-[10px] text-cc-primary hover:underline cursor-pointer"
            >
              {showFull ? "Show tail" : "Show full"}
            </button>
          )}
          <CopyButton getText={() => text} title="Copy output" />
        </div>
      </div>
      {htmlContent != null ? (
        <pre
          className="text-xs font-mono-code px-3 py-2 whitespace-pre-wrap max-h-60 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      ) : (
        <pre className={`text-xs font-mono-code px-3 py-2 whitespace-pre-wrap max-h-60 overflow-y-auto ${
          isError ? "text-cc-error" : "text-cc-muted"
        }`}>
          {rawText}
        </pre>
      )}
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
        <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <CopyButton
            getText={() => {
              if (name === "Bash") {
                return items.map(item => String(item.input.command || "")).filter(Boolean).join("\n");
              }
              return items.map(item => getPreview(item.name, item.input)).filter(Boolean).join("\n");
            }}
            title="Copy"
          />
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

/** Bridge injected into every HTML fragment iframe: console forwarding + vibeReportState push */
function buildFragmentBridge(fragmentId: string): string {
  return `(function(){
  var FID='${fragmentId}';
  var _post=function(msg){window.parent.postMessage(msg,'*')};
  ['log','warn','error','info'].forEach(function(lvl){
    var orig=console[lvl];
    console[lvl]=function(){
      orig.apply(console,arguments);
      var args=Array.from(arguments).map(function(a){
        try{return typeof a==='string'?a:JSON.stringify(a)}catch(e){return String(a)}
      });
      _post({type:'vibe:console',fragmentId:FID,level:lvl,args:args});
    };
  });
  window.addEventListener('error',function(e){
    _post({type:'vibe:console',fragmentId:FID,level:'error',args:[e.message+' at '+e.filename+':'+e.lineno]});
  });
  window.vibeReportState=function(state){
    _post({type:'vibe:state_update',fragmentId:FID,state:state});
  };
})();`;
}

function buildYoloApi(): string {
  return `window.vibeCommand = async function(command, options = {}) {
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
  };`;
}

/** Prepend bridge + optional YOLO API as <script> tags so they load with the document. */
export function injectBridgeIntoHtml(html: string, fragmentId: string, yoloMode: boolean): string {
  const scripts = `<script>${buildFragmentBridge(fragmentId)}${yoloMode ? buildYoloApi() : ""}</script>`;
  // Insert before </head> if present, otherwise prepend
  if (html.includes("</head>")) return html.replace("</head>", `${scripts}</head>`);
  return scripts + html;
}

/**
 * Matches URLs in inline code: full http(s):// URLs, or bare domain-like strings
 * ending with a well-known TLD (e.g. "console.anthropic.com", "api.example.io/v1").
 * Deliberately narrow TLD list to avoid false-positives on version strings like "2.0.0".
 */
const INLINE_URL_RE =
  /^(https?:\/\/[^\s<>"'`]+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+(?:com|org|net|io|dev|ai|app|co|edu|gov|me|info|biz|tv|tech|cloud|xyz|software|tools|services|platform|site|online|store|shop|blog|media|digital|labs|works|studio)(?:\/[^\s<>"'`]*)?)$/i;

/** Common source-code extensions to recognise as bare filenames (e.g. "SessionRouter.swift"). */
const BARE_FILENAME_RE =
  /^([a-zA-Z][\w.-]+\.(ts|tsx|js|jsx|mjs|cjs|py|swift|kt|java|go|rs|c|cc|cpp|h|hpp|rb|php|cs|fs|ex|exs|elm|hs|lua|r|sh|bash|zsh|fish|ps1|css|scss|sass|less|html|htm|json|jsonc|yaml|yml|toml|ini|env|md|mdx|sql|graphql|proto|dart|vue|svelte|astro))(?::(\d+))?$/i;

/**
 * Renders a bare filename (e.g. `SessionRouter.swift`) as a button that searches the
 * session's working directory for the file and opens the first match in the editor.
 */
function BareFilenameLink({ filename, line }: { filename: string; line?: string }) {
  const sessionId = useContext(FeedSessionIdContext);
  const cwd = useStore((s) => s.sdkSessions.find((sess) => sess.sessionId === sessionId)?.cwd ?? "");
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleClick = useCallback(async () => {
    if (!cwd) return;
    setSearching(true);
    setNotFound(false);
    try {
      const { matches } = await api.findFiles(filename, cwd);
      if (matches.length === 0) {
        setNotFound(true);
        setTimeout(() => setNotFound(false), 2000);
        return;
      }
      // Prefer exact basename match; fall back to first result
      const target = matches.find((m) => m.endsWith(`/${filename}`)) ?? matches[0];
      const path = line ? `${target}:${line}` : target;
      useStore.getState().openFileInEditor(path);
    } finally {
      setSearching(false);
    }
  }, [cwd, filename, line]);

  return (
    <span
      role="button"
      tabIndex={0}
      className={`px-1 py-0.5 rounded bg-cc-code-bg/30 text-[13px] font-mono-code text-cc-primary hover:bg-cc-primary/20 cursor-pointer transition-colors underline decoration-cc-primary/30${searching || !cwd ? " opacity-50 pointer-events-none" : ""}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
      title={cwd ? `Search for ${filename} in ${cwd}` : "Session working directory unknown"}
    >
      {notFound ? `${filename} (not found)` : filename}{line ? `:${line}` : ""}
    </span>
  );
}

function HtmlFileLink({ filename, url, path }: { filename: string; url: string; path: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cc-border bg-cc-card hover:bg-cc-hover transition-colors text-xs font-mono-code group"
      title={path}
    >
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-cc-primary shrink-0">
        <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z" />
      </svg>
      <span className="text-cc-fg group-hover:text-cc-primary transition-colors">{filename}</span>
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-cc-muted group-hover:text-cc-primary transition-colors shrink-0">
        <path d="M12 3H8.5l1 1H12v8H4V8.5l-1-1V12a1 1 0 001 1h8a1 1 0 001-1V4a1 1 0 00-1-1zM3 2l4 0v1H4.7l5.15 5.15-.7.7L4 3.7V6H3V2z" />
      </svg>
    </a>
  );
}

function HtmlPreview({ html, preview, fragmentId }: { html: string; preview: string; fragmentId: string }) {
  const [open, setOpen] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [editedHtml, setEditedHtml] = useState<string | null>(null);
  const yoloMode = useStore((s) => s.yoloMode);
  const currentHtml = editedHtml ?? html;
  const enrichedHtml = useMemo(() => injectBridgeIntoHtml(currentHtml, fragmentId, yoloMode), [currentHtml, fragmentId, yoloMode]);
  const isEdited = editedHtml !== null;

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
        {isEdited && (
          <button
            onClick={() => setEditedHtml(null)}
            className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 cursor-pointer text-cc-warning hover:text-cc-fg transition-colors"
            title="Reset to original"
          >
            Reset
          </button>
        )}
        <button
          onClick={() => setShowSource(!showSource)}
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 cursor-pointer transition-colors ${
            showSource ? "bg-cc-primary/10 text-cc-primary" : "text-cc-muted hover:text-cc-fg"
          }`}
        >
          {showSource ? "Preview" : "Edit"}
        </button>
      </div>
      {open && (
        <div className={showSource ? "flex border-t border-cc-border" : "border-t border-cc-border"}>
          {showSource ? (
            <>
              <textarea
                value={currentHtml}
                onChange={(e) => setEditedHtml(e.target.value)}
                spellCheck={false}
                className="w-1/2 px-3 py-2 text-[11px] font-mono-code text-cc-fg bg-cc-code-bg h-[400px] resize-none focus:outline-none border-r border-cc-border"
              />
              <iframe
                srcDoc={enrichedHtml}
                className="w-1/2 h-[400px] bg-white"
                sandbox={yoloMode ? undefined : "allow-scripts"}
                title="HTML preview"
              />
            </>
          ) : (
            <iframe
              srcDoc={enrichedHtml}
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
