import { type Address, type Hex, type Log, type TransactionReceipt, decodeEventLog } from "viem";
import type { BlockKind } from "../schemas/common.js";
import { decodeRevertData } from "./errors.js";
import { EXECUTOR_ABI } from "./generated/index.js";
import { stepTypeToBlockKind } from "./step-types.js";

export interface DecodedStep {
  position: number;
  stepType: number;
  kind: BlockKind;
  adapter: string;
  tokenOut: string;
  amountOut: bigint;
}

export interface DecodedRunOutcome {
  runId: string;
  txHash: string;
  workflowId: bigint | null;
  caller: string | null;
  stopped: boolean;
  stepsExecuted: number;
  totalGasUsed: bigint;
  steps: DecodedStep[];
  guardStop: { position: number; answer: bigint } | null;
  alerts: Array<{ channel: string; messageId: string }>;
  errorCode?: string;
  errorTitle?: string;
}

interface DecodedEvent {
  eventName: string;
  args: Record<string, unknown>;
}

function tryDecode(log: Log): DecodedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: EXECUTOR_ABI,
      data: log.data,
      topics: log.topics,
      strict: false,
    });
    if (!decoded.eventName || !decoded.args) return null;
    return {
      eventName: decoded.eventName,
      args: decoded.args as unknown as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

export function decodeRunReceipt(
  receipt: TransactionReceipt,
  executorAddress: Address,
): DecodedRunOutcome {
  const emitter = executorAddress.toLowerCase();
  const isRuntimeFailure = receipt.status === "reverted";

  if (isRuntimeFailure) {
    return {
      runId: "",
      txHash: receipt.transactionHash,
      workflowId: null,
      caller: null,
      stopped: false,
      stepsExecuted: 0,
      totalGasUsed: receipt.gasUsed,
      steps: [],
      guardStop: null,
      alerts: [],
      errorCode: "unknown_revert",
      errorTitle: "Transaction reverted",
    };
  }

  const steps: DecodedStep[] = [];
  const alerts: DecodedRunOutcome["alerts"] = [];
  let runId = "";
  let workflowId: bigint | null = null;
  let caller: string | null = null;
  let stopped = false;
  let stepsExecuted = 0;
  let guardStop: DecodedRunOutcome["guardStop"] = null;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== emitter) continue;
    const decoded = tryDecode(log);
    if (!decoded) continue;

    switch (decoded.eventName) {
      case "RunStarted": {
        runId = decoded.args.runId as Hex;
        workflowId = decoded.args.workflowId as bigint;
        caller = decoded.args.caller as Address;
        break;
      }
      case "StepExecuted": {
        steps.push({
          position: Number(decoded.args.position as bigint),
          stepType: decoded.args.stepType as number,
          kind: stepTypeToBlockKind(decoded.args.stepType as number),
          adapter: decoded.args.adapter as Address,
          tokenOut: decoded.args.tokenOut as Address,
          amountOut: decoded.args.amountOut as bigint,
        });
        break;
      }
      case "GuardStopped": {
        guardStop = {
          position: Number(decoded.args.position as bigint),
          answer: decoded.args.answer as bigint,
        };
        break;
      }
      case "AlertRaised": {
        alerts.push({
          channel: decoded.args.channel as Hex,
          messageId: decoded.args.messageId as Hex,
        });
        break;
      }
      case "RunCompleted": {
        stopped = decoded.args.stopped as boolean;
        stepsExecuted = Number(decoded.args.stepsExecuted as bigint);
        break;
      }
      default:
        break;
    }
  }

  steps.sort((a, b) => a.position - b.position);

  return {
    runId,
    txHash: receipt.transactionHash,
    workflowId,
    caller,
    stopped,
    stepsExecuted,
    totalGasUsed: receipt.gasUsed,
    steps,
    guardStop,
    alerts,
  };
}

export { decodeRevertData };
