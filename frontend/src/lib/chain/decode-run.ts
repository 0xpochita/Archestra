import {
  type Address,
  type Hex,
  isAddress,
  isHex,
  type Log,
  parseEventLogs,
  zeroAddress,
} from "viem";
import { BLOCK_KINDS } from "@/constants/blocks";
import type { BlockKind } from "@/types/block";
import { STEP_TYPE } from "./adapters";
import { executorAbi } from "./generated";

export interface RunStepResult {
  position: number;
  stepType: number;
  kind: BlockKind | null;
  adapter: Address;
  tokenOut: Address;
  amountOut: bigint;
}

export interface RunOutcome {
  runId: Hex;
  workflowId: bigint;
  caller: Address;
  steps: RunStepResult[];
  guardStop: { position: number; answer: bigint } | null;
  stopped: boolean;
  stepsExecuted: number;
  txHash: Hex;
  gasUsed: bigint;
}

export interface RunEvent {
  name: string;
  args: Record<string, unknown>;
}

export interface RunMeta {
  txHash: Hex;
  gasUsed: bigint;
}

const KIND_BY_STEP_TYPE = new Map<number, BlockKind>(
  BLOCK_KINDS.map((kind) => [STEP_TYPE[kind], kind]),
);

export const toBlockKind = (stepType: number) =>
  KIND_BY_STEP_TYPE.get(stepType) ?? null;

const asBigInt = (value: unknown) =>
  typeof value === "bigint" ? value : BigInt(String(value ?? 0));

const asNumber = (value: unknown) => Number(asBigInt(value));

const asAddress = (value: unknown): Address =>
  typeof value === "string" && isAddress(value) ? value : zeroAddress;

const asHex = (value: unknown): Hex => (isHex(value) ? value : "0x");

export function parseRunEvents(logs: Log[]): RunEvent[] {
  return parseEventLogs({ abi: executorAbi, logs }).map((log) => ({
    name: log.eventName,
    args: { ...log.args },
  }));
}

export function buildRunOutcome(
  events: RunEvent[],
  meta: RunMeta,
): RunOutcome | null {
  const started = events.find((event) => event.name === "RunStarted");
  const completed = events.find((event) => event.name === "RunCompleted");
  if (!started) return null;

  const steps = events
    .filter((event) => event.name === "StepExecuted")
    .map((event) => {
      const stepType = asNumber(event.args.stepType);
      return {
        position: asNumber(event.args.position),
        stepType,
        kind: toBlockKind(stepType),
        adapter: asAddress(event.args.adapter),
        tokenOut: asAddress(event.args.tokenOut),
        amountOut: asBigInt(event.args.amountOut),
      };
    })
    .sort((left, right) => left.position - right.position);

  const guard = events.find((event) => event.name === "GuardStopped");

  return {
    runId: asHex(started.args.runId),
    workflowId: asBigInt(started.args.workflowId),
    caller: asAddress(started.args.caller),
    steps,
    guardStop: guard
      ? {
          position: asNumber(guard.args.position),
          answer: asBigInt(guard.args.answer),
        }
      : null,
    stopped: Boolean(completed?.args.stopped),
    stepsExecuted: completed ? asNumber(completed.args.stepsExecuted) : 0,
    txHash: meta.txHash,
    gasUsed: meta.gasUsed,
  };
}
