import { TemplateGallery } from "./components/TemplateGallery";
import { WorkflowsRail } from "./components/WorkflowsRail";

export function WorkflowsPage() {
  return (
    <div className="flex h-svh bg-canvas text-ink">
      <WorkflowsRail />
      <TemplateGallery />
    </div>
  );
}
