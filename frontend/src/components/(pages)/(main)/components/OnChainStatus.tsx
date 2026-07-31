"use client";

import { useEffect, useRef } from "react";
import { AddressLink } from "@/components/ui/AddressLink";
import { Icon } from "@/components/ui/Icon";
import { REGISTRY_ADDRESS } from "@/config/chain";
import { useSessions } from "@/hooks/useSession";
import { useVault } from "@/hooks/useVault";
import { useWorkflowRun } from "@/hooks/useWorkflowRun";
import type { RunOutcome } from "@/lib/chain/decode-run";
import { getRunStage, getRunStageLabel } from "@/lib/chain/run-stage";
import type { TokenId } from "@/lib/chain/tokens";
import type { WorkflowNode } from "../types";

interface OnChainStatusProps {
  orderedNodes: WorkflowNode[];
  canEncode: boolean;
  tokenIds: TokenId[];
  onRequestActivate: () => void;
  onRunOutcome: (outcome: RunOutcome, nodeIds: string[]) => void;
  onMockRun: () => void;
  isMockRunning: boolean;
}

const PRIMARY_CLASS =
  "flex items-center gap-2 bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60";
const SECONDARY_CLASS =
  "flex items-center gap-2 border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-50";

export function OnChainStatus({
  orderedNodes,
  canEncode,
  tokenIds,
  onRequestActivate,
  onRunOutcome,
  onMockRun,
  isMockRunning,
}: OnChainStatusProps) {
  const vault = useVault();
  const run = useWorkflowRun(vault.acceptedExecutor);
  const sessions = useSessions(
    vault.vaultAddress,
    tokenIds,
    vault.isVaultDeployed,
  );

  const { outcome } = run;
  const lastRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!outcome || lastRunIdRef.current === outcome.runId) return;
    lastRunIdRef.current = outcome.runId;
    onRunOutcome(
      outcome,
      outcome.steps.flatMap((step) => {
        const node = orderedNodes.at(step.position);
        return node ? [node.id] : [];
      }),
    );
  }, [outcome, orderedNodes, onRunOutcome]);

  const missingSession = sessions.sessions.find((session) => !session.isActive);
  const isUnfunded = tokenIds.some(
    (id) =>
      vault.balances.find((balance) => balance.token.id === id)?.vaultAmount ===
      0n,
  );
  const stage = getRunStage({
    isConnected: vault.isConnected,
    isWrongNetwork: vault.isWrongNetwork,
    canEncode,
    isCreated: run.isCreated,
    hasMissingSession: Boolean(missingSession),
    isUnfunded,
  });

  if (stage === "connect" || stage === "switch_network") {
    return (
      <button
        type="button"
        disabled={isMockRunning}
        onClick={onMockRun}
        title="Preview the run on the canvas without a wallet"
        className={PRIMARY_CLASS}
      >
        <Icon
          name={isMockRunning ? "loader" : "play"}
          className={`size-4 ${isMockRunning ? "animate-spin" : ""}`}
        />
        {isMockRunning ? "Running preview" : getRunStageLabel("connect")}
      </button>
    );
  }

  const error = run.runError ?? run.createError ?? run.blockedReason;

  const renderAction = () => {
    if (stage === "create" || stage === "fix_graph") {
      return (
        <button
          type="button"
          disabled={!canEncode || run.isCreating}
          onClick={() => run.createWorkflow(orderedNodes)}
          className={SECONDARY_CLASS}
        >
          <Icon
            name={run.isCreating ? "loader" : "vault"}
            className={`size-4 ${run.isCreating ? "animate-spin" : ""}`}
          />
          {run.isCreating ? "Creating" : getRunStageLabel(stage)}
        </button>
      );
    }

    if (stage === "open_session") {
      return (
        <button
          type="button"
          onClick={onRequestActivate}
          className={SECONDARY_CLASS}
        >
          <Icon name="approve" className="size-4" />
          {getRunStageLabel(stage)}
        </button>
      );
    }

    if (stage === "fund") {
      return (
        <button
          type="button"
          disabled
          title="Send tokens to the vault from the panel on the right"
          className={SECONDARY_CLASS}
        >
          <Icon name="deposit" className="size-4" />
          {getRunStageLabel(stage)}
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={run.isRunning || run.blockedReason !== null}
        onClick={run.runWorkflow}
        title={run.blockedReason?.detail}
        className={PRIMARY_CLASS}
      >
        <Icon
          name={run.isRunning ? "loader" : "play"}
          className={`size-4 ${run.isRunning ? "animate-spin" : ""}`}
        />
        {run.isRunning ? "Running" : getRunStageLabel("run")}
      </button>
    );
  };

  return (
    <span className="flex items-center gap-3">
      {run.workflowId !== null ? (
        <span className="hidden items-center gap-2 text-xs text-ink-muted lg:flex">
          <Icon name="check" className="size-3.5 text-ink" />
          Workflow #{run.workflowId.toString()}
          <AddressLink address={REGISTRY_ADDRESS} label="registry" />
        </span>
      ) : null}

      {run.isRunFailed ? (
        <span className="hidden text-xs font-medium text-ink md:block">
          The run reverted on chain and nothing moved.
        </span>
      ) : null}

      {error ? (
        <span className="hidden max-w-72 flex-col md:flex">
          <span className="truncate text-xs font-medium text-ink">
            {error.title}
          </span>
          <span className="truncate text-[11px] text-ink-subtle">
            {error.detail}
          </span>
        </span>
      ) : null}

      {renderAction()}
    </span>
  );
}
