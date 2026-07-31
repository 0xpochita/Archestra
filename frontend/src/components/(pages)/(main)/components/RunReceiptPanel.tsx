"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { panelVariants } from "@/components/ui/motion";
import { explorerTxUrl } from "@/config/chain";
import type { RunOutcome } from "@/lib/chain/decode-run";
import { findTokenByAddress } from "@/lib/chain/tokens";
import { formatTokenAmount, truncateAddress } from "@/lib/format";

interface RunReceiptPanelProps {
  outcome: RunOutcome;
  onClose: () => void;
}

function StepOutput({
  tokenOut,
  amountOut,
}: {
  tokenOut: string;
  amountOut: bigint;
}) {
  const token = findTokenByAddress(tokenOut);
  if (!token || amountOut === 0n) return <span>no token output</span>;

  return (
    <span>
      {formatTokenAmount(amountOut, token.decimals)} {token.symbol}
    </span>
  );
}

export function RunReceiptPanel({ outcome, onClose }: RunReceiptPanelProps) {
  return (
    <motion.section
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-label="Run receipt"
      className="shrink-0 border-b border-line bg-surface-raised px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <Icon
          name={outcome.stopped ? "condition" : "check"}
          className="mt-0.5 size-4 shrink-0 text-ink"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink">
            {outcome.stopped
              ? `Guard stopped the run at step ${(outcome.guardStop?.position ?? 0) + 1}, and that is a success`
              : `Run finished with ${outcome.stepsExecuted} step${outcome.stepsExecuted === 1 ? "" : "s"}`}
          </p>

          <ul className="mt-1.5 flex flex-col gap-0.5 font-mono text-[11px] text-ink-subtle">
            {outcome.steps.map((step) => (
              <li key={step.position}>
                {step.position + 1}. {step.kind ?? `type ${step.stepType}`}
                {" -> "}
                <StepOutput
                  tokenOut={step.tokenOut}
                  amountOut={step.amountOut}
                />
              </li>
            ))}
          </ul>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-ink-subtle">
            <a
              href={explorerTxUrl(outcome.txHash)}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-ink"
            >
              {truncateAddress(outcome.txHash)}
            </a>
            <span>{outcome.gasUsed.toString()} gas for the whole run</span>
            <span>run {truncateAddress(outcome.runId)}</span>
          </p>
        </div>

        <button
          type="button"
          aria-label="Dismiss the run receipt"
          onClick={onClose}
          className="grid size-7 shrink-0 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <Icon name="close" className="size-3.5" />
        </button>
      </div>
    </motion.section>
  );
}
