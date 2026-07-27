"use client";

import { motion } from "framer-motion";
import { useEffect, useId } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  backdropVariants,
  itemVariants,
  panelVariants,
} from "@/components/ui/motion";
import { BLOCK_CATALOG } from "../constants";
import type { WorkflowNode } from "../types";

interface SimulationModalProps {
  workflowName: string;
  steps: WorkflowNode[];
  completed: number;
  onReplay: () => void;
  onClose: () => void;
}

interface SimulationStepProps {
  node: WorkflowNode;
  state: "done" | "active" | "pending";
}

function SimulationStep({ node, state }: SimulationStepProps) {
  const definition = BLOCK_CATALOG[node.kind];

  return (
    <motion.div variants={itemVariants} className="w-28 shrink-0">
      <div
        className={`flex flex-col items-center gap-2 text-center transition-opacity duration-200 ${
          state === "pending" ? "opacity-40" : "opacity-100"
        }`}
      >
        <span
          className={`grid size-12 place-items-center border ${
            state === "done"
              ? "border-ink bg-ink text-on-brand"
              : state === "active"
                ? "border-ink bg-surface text-ink"
                : "border-line bg-surface-raised text-ink-muted"
          }`}
        >
          {state === "done" ? (
            <Icon name="check" className="size-5" />
          ) : state === "active" ? (
            <Icon name="loader" className="size-5 animate-spin" />
          ) : (
            <Icon name={definition.icon} className="size-5" />
          )}
        </span>
        <span className="w-full truncate text-xs font-semibold text-ink">
          {node.title}
        </span>
        <span className="w-full truncate text-[11px] text-ink-subtle">
          {node.subtitle}
        </span>
      </div>
    </motion.div>
  );
}

export function SimulationModal({
  workflowName,
  steps,
  completed,
  onReplay,
  onClose,
}: SimulationModalProps) {
  const titleId = useId();
  const isFinished = completed >= steps.length;
  const activeStep = steps[completed];

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <motion.button
        type="button"
        aria-label="Close simulation"
        onClick={onClose}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative flex max-h-[82vh] w-[820px] max-w-full flex-col border border-line bg-surface shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-line p-4">
          <span className="grid size-10 shrink-0 place-items-center border border-line bg-surface-raised text-ink">
            <Icon name="sparkle" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold">
              Simulate strategy
            </h2>
            <p className="truncate text-xs text-ink-subtle">{workflowName}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-8 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="close" className="size-4" />
          </button>
        </header>

        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-xs">
          <span className="truncate text-ink-muted">
            {isFinished
              ? `All ${steps.length} steps settled`
              : `Running ${activeStep?.title ?? ""} (${completed + 1} of ${steps.length})`}
          </span>
          <span className="shrink-0 font-mono text-ink-subtle">
            est. gas 0.0021 ETH
          </span>
        </div>

        <div className="scroll-slim overflow-x-auto overflow-y-auto px-6 py-8">
          <ol className="flex min-w-max items-start justify-center">
            {steps.map((node, index) => (
              <li key={node.id} className="flex items-start">
                {index > 0 ? (
                  <span
                    className={`mt-6 h-0.5 w-10 transition-colors ${
                      index <= completed ? "bg-ink" : "bg-line"
                    }`}
                  />
                ) : null}
                <SimulationStep
                  node={node}
                  state={
                    index < completed
                      ? "done"
                      : index === completed
                        ? "active"
                        : "pending"
                  }
                />
              </li>
            ))}
          </ol>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line p-4">
          <p className="text-xs text-ink-subtle">
            {isFinished
              ? "Simulation complete. Nothing was broadcast on-chain."
              : "Dry run only. No transaction is broadcast."}
          </p>
          {isFinished ? (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onReplay}
                className="flex items-center gap-2 border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-hover"
              >
                <Icon name="undo" className="size-4" />
                Replay
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
              >
                Done
              </button>
            </div>
          ) : null}
        </footer>
      </motion.div>
    </div>
  );
}
