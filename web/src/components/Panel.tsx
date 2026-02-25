import { api } from "../api.js";

export function Panel({ slug }: { slug: string }) {
  return (
    <div className="h-full flex flex-col bg-cc-bg">
      <iframe
        src={api.getPanelUrl(slug)}
        className="flex-1 w-full border-0"
        title={`Panel: ${slug}`}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
