import { type Address, type Hex, encodeFunctionData, getAddress } from "viem";
import { getPublicClient } from "../chain/client.js";
import { decodeRunReceipt } from "../chain/decode-run.js";
import { EXECUTOR_ABI, WORKFLOW_REGISTRY_ABI } from "../chain/generated/index.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { GAS_TABLE } from "./chain.js";
import type { ChainAdapter, OnchainRunOutcome, RunCall, StepRequest } from "./chain.js";

export class ArcChainAdapter implements ChainAdapter {
  readonly mode = "arc" as const;

  private executorAddressCache: Address | null = null;

  async estimateGas(steps: StepRequest[]): Promise<bigint> {
    const total = steps.reduce((sum, step) => sum + (GAS_TABLE[step.kind] ?? 0n), 0n);
    return (total * 110n) / 100n;
  }

  async getExecutorAddress(): Promise<Address> {
    if (this.executorAddressCache) return this.executorAddressCache;
    const client = getPublicClient();
    const result = (await client.readContract({
      address: getAddress(config.REGISTRY_ADDRESS),
      abi: WORKFLOW_REGISTRY_ABI,
      functionName: "executor",
    })) as Address;
    if (!result || result === "0x0000000000000000000000000000000000000000") {
      throw new Error("no active executor published by registry");
    }
    this.executorAddressCache = getAddress(result);
    logger.info("executor address resolved", { address: this.executorAddressCache });
    return this.executorAddressCache;
  }

  invalidateExecutorCache(): void {
    this.executorAddressCache = null;
  }

  async buildRunCall(onchainWorkflowId: bigint): Promise<RunCall> {
    const executor = await this.getExecutorAddress();
    const data = encodeFunctionData({
      abi: EXECUTOR_ABI,
      functionName: "run",
      args: [onchainWorkflowId],
    });
    return {
      to: executor,
      data,
      chainId: config.CHAIN_ID,
    };
  }

  async readRun(txHash: string): Promise<OnchainRunOutcome> {
    const client = getPublicClient();
    const executor = await this.getExecutorAddress();
    const receipt = await client.getTransactionReceipt({ hash: txHash as Hex });
    const decoded = decodeRunReceipt(receipt, executor);
    const outcome: OnchainRunOutcome = {
      runId: decoded.runId,
      stopped: decoded.stopped,
      stepsExecuted: decoded.stepsExecuted,
      totalGasUsed: decoded.totalGasUsed,
      txHash: decoded.txHash,
      steps: decoded.steps,
    };
    if (decoded.errorCode) outcome.errorCode = decoded.errorCode;
    if (decoded.errorTitle) outcome.errorDetail = decoded.errorTitle;
    return outcome;
  }
}
