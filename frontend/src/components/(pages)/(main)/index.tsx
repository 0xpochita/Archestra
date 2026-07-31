import { Suspense } from "react";
import { ChainProvider } from "@/providers/ChainProvider";
import { WorkflowStudio } from "./components/WorkflowStudio";

export function WorkflowBuilderPage() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-shell text-ink">
      <ChainProvider>
        <Suspense fallback={null}>
          <WorkflowStudio />
        </Suspense>
      </ChainProvider>
    </div>
  );
}
