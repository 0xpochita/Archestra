import { Suspense } from "react";
import { ChainProvider } from "@/providers/ChainProvider";
import { WorkflowStudio } from "./components/WorkflowStudio";

export function WorkflowBuilderPage() {
  return (
    <ChainProvider>
      <div className="flex h-svh flex-col overflow-hidden bg-shell text-ink">
        <Suspense fallback={null}>
          <WorkflowStudio />
        </Suspense>
      </div>
    </ChainProvider>
  );
}
