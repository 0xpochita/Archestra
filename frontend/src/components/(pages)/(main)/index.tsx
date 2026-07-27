import { AppBar } from "./components/AppBar";
import { WorkflowStudio } from "./components/WorkflowStudio";

export function WorkflowBuilderPage() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-shell text-ink">
      <AppBar />
      <WorkflowStudio />
    </div>
  );
}
