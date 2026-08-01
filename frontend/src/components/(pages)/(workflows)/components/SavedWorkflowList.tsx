"use client";

import Link from "next/link";
import { BlockGlyph } from "@/components/ui/BlockGlyph";
import { Icon } from "@/components/ui/Icon";
import { NEW_STUDIO_PATH, STUDIO_PATH } from "@/constants/assets";
import { useStoredStrategies } from "@/hooks/useStoredStrategies";
import type { RunRecord, SavedStrategy } from "@/lib/schemas/strategy";
import {
  MY_WORKFLOWS_EMPTY_BODY,
  MY_WORKFLOWS_EMPTY_TITLE,
  MY_WORKFLOWS_SUBTITLE,
  MY_WORKFLOWS_TITLE,
} from "../constants";

const formatWhen = (updatedAt: number) =>
  new Date(updatedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

function WorkflowCard({
  strategy,
  runs,
  onRemove,
}: {
  strategy: SavedStrategy;
  runs: RunRecord[];
  onRemove: (id: string) => void;
}) {
  const lastRun = runs.at(0);

  return (
    <article className="flex flex-col border border-line bg-surface">
      <div className="workflow-grid flex min-h-28 items-center justify-center gap-2 border-b border-line p-4">
        {strategy.graph.nodes.length === 0 ? (
          <span className="text-xs text-ink-subtle">Empty canvas</span>
        ) : (
          strategy.graph.nodes.slice(0, 5).map((node) => (
            <span
              key={node.id}
              className="grid size-9 place-items-center border border-line bg-surface text-ink"
            >
              <BlockGlyph kind={node.kind} className="size-5" />
            </span>
          ))
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h2 className="truncate text-sm font-semibold text-ink">
            {strategy.name}
          </h2>
          <p className="text-xs text-ink-subtle">
            {strategy.graph.nodes.length} block
            {strategy.graph.nodes.length === 1 ? "" : "s"}
            {strategy.onchainId
              ? `, workflow #${strategy.onchainId}`
              : ", not on chain yet"}
          </p>
          <p className="text-[11px] text-ink-subtle">
            Saved {formatWhen(strategy.updatedAt)}
          </p>
        </div>

        <p className="text-[11px] text-ink-subtle">
          {runs.length === 0
            ? "Never run"
            : `${runs.length} run${runs.length === 1 ? "" : "s"}, last one ${
                lastRun?.status === "stopped"
                  ? "stopped by a guard"
                  : "succeeded"
              }`}
        </p>

        <div className="mt-auto flex items-center gap-2">
          <Link
            href={`${STUDIO_PATH}?strategy=${strategy.id}`}
            className="flex flex-1 items-center justify-center gap-2 bg-brand px-3 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
          >
            Open in studio
          </Link>
          <button
            type="button"
            aria-label={`Delete ${strategy.name}`}
            onClick={() => onRemove(strategy.id)}
            className="grid size-9 shrink-0 place-items-center border border-line text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="trash" className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function SavedWorkflowList() {
  const { strategies, runs, removeStrategy, isHydrated } =
    useStoredStrategies();

  return (
    <div className="scroll-slim min-w-0 flex-1 overflow-y-auto p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {MY_WORKFLOWS_TITLE}
        </h1>
        <p className="text-sm text-ink-muted">{MY_WORKFLOWS_SUBTITLE}</p>
      </div>

      {isHydrated && strategies.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 border border-dashed border-line-strong bg-surface p-10 text-center">
          <span className="grid size-10 place-items-center border border-line bg-surface-raised text-ink">
            <Icon name="addBlocks" className="size-5" />
          </span>
          <span className="text-sm font-semibold text-ink">
            {MY_WORKFLOWS_EMPTY_TITLE}
          </span>
          <span className="max-w-sm text-xs text-ink-subtle">
            {MY_WORKFLOWS_EMPTY_BODY}
          </span>
          <Link
            href={NEW_STUDIO_PATH}
            className="mt-1 flex items-center gap-2 bg-brand px-4 py-2.5 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
          >
            <Icon name="plus" className="size-4" />
            New workflow
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {strategies.map((strategy) => (
          <WorkflowCard
            key={strategy.id}
            strategy={strategy}
            runs={runs.filter((run) => run.strategyId === strategy.id)}
            onRemove={removeStrategy}
          />
        ))}
      </div>
    </div>
  );
}
