"use client";

import { motion } from "framer-motion";
import { useEffect, useId } from "react";
import { LuCircleCheckBig, LuOctagonPause } from "react-icons/lu";
import { Icon } from "@/components/ui/Icon";
import { backdropVariants, panelVariants } from "@/components/ui/motion";
import { explorerTxUrl } from "@/config/chain";
import { BLOCK_CATALOG } from "@/constants/blocks";
import type { RunOutcome, RunStepResult } from "@/lib/chain/decode-run";
import { findTokenByAddress } from "@/lib/chain/tokens";
import { formatTokenAmount, truncateAddress } from "@/lib/format";
import { STEP_RESULT_FALLBACK, STEP_RESULT_NOTES } from "../constants";

interface RunReceiptPanelProps {
  outcome: RunOutcome;
  onClose: () => void;
}

function StepOutput({ step }: { step: RunStepResult }) {
  const token = findTokenByAddress(step.tokenOut);

  if (token && step.amountOut > 0n) {
    return (
      <span className="text-ink">
        {formatTokenAmount(step.amountOut, token.decimals)} {token.symbol}
      </span>
    );
  }

  const note = step.kind ? STEP_RESULT_NOTES[step.kind] : undefined;
  return <span>{note ?? STEP_RESULT_FALLBACK}</span>;
}

export function RunReceiptPanel({ outcome, onClose }: RunReceiptPanelProps) {
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
        aria-label="Close the run receipt"
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
        className="relative flex w-120 max-w-full flex-col gap-5 border border-line bg-surface p-6 text-center shadow-xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 grid size-8 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <Icon name="close" className="size-4" />
        </button>

        <div className="flex flex-col items-center gap-3 pt-2">
          {outcome.stopped ? (
            <LuOctagonPause className="size-12 text-ink" strokeWidth={1.5} />
          ) : (
            <LuCircleCheckBig className="size-12 text-ink" strokeWidth={1.5} />
          )}

          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {outcome.stopped
                ? "The guard stopped the run"
                : "Strategy ran successfully"}
            </h2>
            <p className="text-xs leading-relaxed text-ink-subtle">
              {outcome.stopped
                ? `A price bound was not met at step ${(outcome.guardStop?.position ?? 0) + 1}, so the run ended early. That is a success, not a failure, and nothing else moved.`
                : `All ${outcome.stepsExecuted} step${outcome.stepsExecuted === 1 ? "" : "s"} executed in one transaction.`}
            </p>
          </div>
        </div>

        {outcome.steps.length > 0 ? (
          <ul className="flex flex-col border border-line bg-surface-raised text-left">
            {outcome.steps.map((step) => (
              <li
                key={step.position}
                className="flex items-center justify-between gap-3 border-b border-line/60 px-3 py-2 text-xs last:border-b-0"
              >
                <span className="flex items-center gap-2 text-ink">
                  <span className="grid size-5 shrink-0 place-items-center border border-line bg-surface text-[10px] text-ink-muted">
                    {step.position + 1}
                  </span>
                  {step.kind
                    ? BLOCK_CATALOG[step.kind].label
                    : `Step type ${step.stepType}`}
                </span>
                <span className="font-mono text-ink-subtle">
                  <StepOutput step={step} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <dl className="flex flex-col gap-1.5 text-left text-[11px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-subtle">Transaction</dt>
            <dd>
              <a
                href={explorerTxUrl(outcome.txHash)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-ink underline underline-offset-2"
              >
                {truncateAddress(outcome.txHash)}
              </a>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-subtle">Gas for the whole run</dt>
            <dd className="font-mono text-ink-muted">
              {outcome.gasUsed.toString()}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-subtle">Run id</dt>
            <dd className="font-mono text-ink-muted">
              {truncateAddress(outcome.runId)}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="bg-brand px-4 py-2.5 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
        >
          Done
        </button>
      </motion.div>
    </div>
  );
}
