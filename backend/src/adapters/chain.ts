import type { BlockKind } from "../schemas/common.js";
import type { StepConfig } from "../schemas/step-config.js";

export interface StepRequest {
  kind: BlockKind;
  params: Record<string, string>;
  config?: StepConfig;
}

export interface StepResult {
  txHash: string | null;
  gasUsed: bigint;
  error: string | null;
}

export interface RunCall {
  to: string;
  data: string;
  chainId: number;
}

export interface OnchainRunOutcome {
  runId: string;
  stopped: boolean;
  stepsExecuted: number;
  totalGasUsed: bigint;
  txHash: string;
  steps: Array<{
    position: number;
    stepType: number;
    kind: BlockKind;
    adapter: string;
    tokenOut: string;
    amountOut: bigint;
  }>;
  errorCode?: string;
  errorDetail?: string;
}

export interface ChainAdapter {
  readonly mode: "mock" | "arc";
  estimateGas(steps: StepRequest[]): Promise<bigint>;
  execute?(step: StepRequest, runId: string, position: number): Promise<StepResult>;
  buildRunCall?(onchainWorkflowId: bigint): Promise<RunCall>;
  readRun?(txHash: string): Promise<OnchainRunOutcome>;
}

const GAS_TABLE: Record<BlockKind, bigint> = {
  trigger: 0n,
  approve: 46000n,
  deposit: 180000n,
  swap: 145000n,
  yield: 210000n,
  harvest: 120000n,
  bridge: 250000n,
  withdraw: 160000n,
  condition: 35000n,
  alert: 0n,
};

const STEP_DELAY_MS = 700;

function deterministicHash(runId: string, position: number): string {
  let hash = 0n;
  const input = `${runId}:${position}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31n + BigInt(input.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return `0x${hash.toString(16).padStart(16, "0")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockChainAdapter implements ChainAdapter {
  readonly mode = "mock" as const;

  private readonly clock: () => number;

  constructor(clock: () => number = Date.now) {
    this.clock = clock;
  }

  async estimateGas(steps: StepRequest[]): Promise<bigint> {
    const total = steps.reduce((sum, step) => sum + (GAS_TABLE[step.kind] ?? 0n), 0n);
    return (total * 110n) / 100n;
  }

  async execute(step: StepRequest, runId: string, position: number): Promise<StepResult> {
    await sleep(STEP_DELAY_MS);

    if (step.params.mockFail === "true") {
      return {
        txHash: null,
        gasUsed: 0n,
        error: "mock failure injected",
      };
    }

    return {
      txHash: deterministicHash(runId, position),
      gasUsed: GAS_TABLE[step.kind] ?? 0n,
      error: null,
    };
  }
}

export { GAS_TABLE };
