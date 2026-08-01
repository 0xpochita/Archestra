"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStrategyStore } from "@/stores/strategy-store";
import type { LogoName } from "@/types/logo";
import type { WorkflowGraph } from "../types";

const CONFIRMATION_MS = 2000;

interface SaveWorkflowButtonProps {
  graph: WorkflowGraph;
  workflowName: string;
  workflowTokens: LogoName[];
}

export function SaveWorkflowButton({
  graph,
  workflowName,
  workflowTokens,
}: SaveWorkflowButtonProps) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!isSaved) return;

    const timer = window.setTimeout(() => setIsSaved(false), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isSaved]);

  const save = () => {
    const store = useStrategyStore.getState();
    if (!store.activeStrategyId) store.createStrategy(workflowName);

    store.saveActiveStrategy({
      name: workflowName,
      tokens: workflowTokens,
      graph,
    });
    setIsSaved(true);
  };

  return (
    <button
      type="button"
      onClick={save}
      title="Saved automatically as you edit. This writes it right away."
      className="flex items-center gap-2 border border-line px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-hover"
    >
      <Icon name={isSaved ? "check" : "deposit"} className="size-4" />
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
