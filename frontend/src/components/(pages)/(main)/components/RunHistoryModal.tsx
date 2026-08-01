"use client";

import { motion } from "framer-motion";
import { useEffect, useId } from "react";
import { LuCircleCheckBig, LuOctagonPause } from "react-icons/lu";
import { Icon } from "@/components/ui/Icon";
import { backdropVariants, panelVariants } from "@/components/ui/motion";
import { explorerTxUrl } from "@/config/chain";
import { BLOCK_CATALOG } from "@/constants/blocks";
import { truncateAddress } from "@/lib/format";
import type { RunRecord } from "@/lib/schemas/strategy";

interface RunHistoryModalProps {
  runs: RunRecord[];
  onClose: () => void;
}

const formatWhen = (finishedAt: number) =>
  new Date(finishedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function RunHistoryModal({ runs, onClose }: RunHistoryModalProps) {
  const titleId = useId();

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
        aria-label="Close the run history"
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
        className="scroll-slim relative flex max-h-[80vh] w-140 max-w-full flex-col overflow-y-auto border border-line bg-surface shadow-xl"
      >
        <header className="sticky top-0 flex items-center gap-3 border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              Run history
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Kept in this browser, newest first.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="close" className="size-4" />
          </button>
        </header>

        {runs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-subtle">
            No runs yet. The result of every run lands here.
          </p>
        ) : (
          <ul className="flex flex-col">
            {runs.map((run) => (
              <li
                key={run.runId}
                className="flex gap-3 border-b border-line/60 px-5 py-4 last:border-b-0"
              >
                {run.status === "stopped" ? (
                  <LuOctagonPause className="mt-0.5 size-5 shrink-0 text-ink" />
                ) : (
                  <LuCircleCheckBig className="mt-0.5 size-5 shrink-0 text-ink" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-ink">
                    {run.strategyName}
                    {run.onchainId ? (
                      <span className="text-xs font-normal text-ink-subtle">
                        workflow #{run.onchainId}
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-0.5 text-xs text-ink-muted">
                    {run.status === "stopped"
                      ? "Guard stopped the run early, which is a success"
                      : `${run.stepsExecuted} step${run.stepsExecuted === 1 ? "" : "s"} executed`}
                  </p>

                  <p className="mt-1 flex flex-wrap gap-x-1.5 text-[11px] text-ink-subtle">
                    {run.steps.map((step) => (
                      <span key={step.position} className="font-mono">
                        {step.kind ? BLOCK_CATALOG[step.kind].label : "step"}
                        {step.position < run.steps.length - 1 ? " ->" : ""}
                      </span>
                    ))}
                  </p>

                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-ink-subtle">
                    <span>{formatWhen(run.finishedAt)}</span>
                    <span>{run.gasUsed} gas</span>
                    <a
                      href={explorerTxUrl(run.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono underline underline-offset-2 transition-colors hover:text-ink"
                    >
                      {truncateAddress(run.txHash)}
                    </a>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
}
