import { api } from "../api.js";

export function SkillPanel({ slug }: { slug: string }) {
  return (
    <div className="h-full flex flex-col bg-cc-bg">
      <iframe
        src={api.getSkillPanelUrl(slug)}
        className="flex-1 w-full border-0"
        title={`Skill: ${slug}`}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
