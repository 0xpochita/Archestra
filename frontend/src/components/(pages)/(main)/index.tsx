import { Suspense } from "react";
import { WorkflowStudio } from "./components/WorkflowStudio";

export { BlockGlyph } from "./components/BlockGlyph";
export { BLOCK_CATALOG, STRATEGY_TEMPLATES } from "./constants";
export type { BlockKind, StrategyTemplate } from "./types";

export function WorkflowBuilderPage() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-shell text-ink">
      <Suspense fallback={null}>
        <WorkflowStudio />
      </Suspense>
    </div>
  );
}
