"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { parseEventLogs } from "viem";
import {
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { REGISTRY_ADDRESS } from "@/config/chain";
import {
  buildRunOutcome,
  parseRunEvents,
  type RunOutcome,
} from "@/lib/chain/decode-run";
import {
  type EncodeInput,
  encodeWorkflow,
  type StepProblem,
} from "@/lib/chain/encode-steps";
import { toChainError } from "@/lib/chain/errors";
import { executorAbi, workflowRegistryAbi } from "@/lib/chain/generated";

const WORKFLOW_PARAM = "workflow";

function readWorkflowId(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

export function useWorkflowRun(acceptedExecutor?: `0x${string}`) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workflowId = readWorkflowId(searchParams.get(WORKFLOW_PARAM));

  const create = useWriteContract();
  const createReceipt = useWaitForTransactionReceipt({ hash: create.data });

  const run = useWriteContract();
  const runReceipt = useWaitForTransactionReceipt({ hash: run.data });

  const simulation = useSimulateContract({
    abi: executorAbi,
    address: acceptedExecutor,
    functionName: "run",
    args: workflowId === null ? undefined : [workflowId],
    query: { enabled: workflowId !== null && Boolean(acceptedExecutor) },
  });

  const [outcome, setOutcome] = useState<RunOutcome | null>(null);

  useEffect(() => {
    if (!createReceipt.data) return;

    const [created] = parseEventLogs({
      abi: workflowRegistryAbi,
      eventName: "WorkflowCreated",
      logs: createReceipt.data.logs,
    });
    if (!created) return;

    const next = new URLSearchParams(searchParams.toString());
    next.set(WORKFLOW_PARAM, created.args.workflowId.toString());
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [createReceipt.data, router, pathname, searchParams]);

  useEffect(() => {
    const receipt = runReceipt.data;
    if (!receipt) return;

    setOutcome(
      buildRunOutcome(parseRunEvents(receipt.logs), {
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
      }),
    );
  }, [runReceipt.data]);

  const createWorkflow = (steps: EncodeInput[]): StepProblem[] => {
    const encoded = encodeWorkflow(steps, {
      nowSeconds: Math.floor(Date.now() / 1000),
    });

    if (!encoded.ok) return encoded.problems;

    create.writeContract({
      abi: workflowRegistryAbi,
      address: REGISTRY_ADDRESS,
      functionName: "create",
      args: [encoded.steps],
    });

    return [];
  };

  const runWorkflow = () => {
    if (workflowId === null || !acceptedExecutor) return;
    setOutcome(null);

    run.writeContract({
      abi: executorAbi,
      address: acceptedExecutor,
      functionName: "run",
      args: [workflowId],
    });
  };

  const runError = run.error;
  const resetRun = run.reset;
  const isSimulationReady = simulation.isSuccess;

  useEffect(() => {
    if (isSimulationReady && runError) resetRun();
  }, [isSimulationReady, runError, resetRun]);

  const isRunFailed =
    runReceipt.data !== undefined && runReceipt.data.status === "reverted";

  return {
    workflowId,
    isCreated: workflowId !== null,
    createWorkflow,
    createHash: create.data,
    isCreating: create.isPending || createReceipt.isLoading,
    createError: toChainError(create.error ?? createReceipt.error),

    runWorkflow,
    runHash: run.data,
    isRunning: run.isPending || runReceipt.isLoading,
    runError: toChainError(run.error ?? runReceipt.error),
    blockedReason: toChainError(simulation.error),
    isRunFailed,
    outcome,
    clearOutcome: () => setOutcome(null),
  };
}
