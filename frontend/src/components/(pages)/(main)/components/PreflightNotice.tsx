"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { panelVariants } from "@/components/ui/motion";
import type { GraphProblem } from "../types";

interface PreflightNoticeProps {
  problems: GraphProblem[];
  warnings: GraphProblem[];
  onSelectNode: (id: string) => void;
}

function NoticeRow({
  problem,
  onSelectNode,
}: {
  problem: GraphProblem;
  onSelectNode: (id: string) => void;
}) {
  if (!problem.nodeId) {
    return <li className="text-ink-muted">{problem.message}</li>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelectNode(problem.nodeId ?? "")}
        className="text-left text-ink-muted underline decoration-line underline-offset-2 transition-colors hover:text-ink"
      >
        {problem.message}
      </button>
    </li>
  );
}

export function PreflightNotice({
  problems,
  warnings,
  onSelectNode,
}: PreflightNoticeProps) {
  const hasContent = problems.length > 0 || warnings.length > 0;

  return (
    <AnimatePresence>
      {hasContent ? (
        <motion.section
          key="preflight"
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-label="Preflight report"
          className="shrink-0 border-b border-line bg-surface-raised px-4 py-2.5"
        >
          <div className="flex items-start gap-2.5">
            <Icon
              name={problems.length > 0 ? "alert" : "sparkle"}
              className="mt-0.5 size-4 shrink-0 text-ink"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink">
                {problems.length > 0
                  ? `${problems.length} block${problems.length === 1 ? "" : "s"} cannot be sent on chain yet`
                  : "Ready to encode"}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                {problems.map((problem) => (
                  <NoticeRow
                    key={`${problem.nodeId ?? "graph"}-${problem.message}`}
                    problem={problem}
                    onSelectNode={onSelectNode}
                  />
                ))}
                {warnings.map((warning) => (
                  <li key={warning.message} className="text-ink-subtle">
                    {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
