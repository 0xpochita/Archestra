import type { ChainAdapter, RunCall, StepRequest } from "../adapters/chain.js";
import { getExecutionOrder } from "../domain/graph.js";
import { emptyWorkflow, runInProgress, validationFailed } from "../lib/errors.js";
import { generateId } from "../lib/ids.js";
import { logger } from "../lib/logger.js";
import type { RunRepository } from "../repositories/run.js";
import type { WorkflowRepository } from "../repositories/workflow.js";
import type { Run } from "../schemas/run.js";
import type { StepConfig } from "../schemas/step-config.js";

type SseEmitter = (event: string, data: unknown) => void;

const sseListeners = new Map<string, Set<SseEmitter>>();

export function subscribeRun(runId: string, emit: SseEmitter): () => void {
  if (!sseListeners.has(runId)) {
    sseListeners.set(runId, new Set());
  }
  sseListeners.get(runId)!.add(emit);
  return () => {
    sseListeners.get(runId)?.delete(emit);
    if (sseListeners.get(runId)?.size === 0) {
      sseListeners.delete(runId);
    }
  };
}

function emitToListeners(runId: string, event: string, data: unknown): void {
  const listeners = sseListeners.get(runId);
  if (listeners) {
    for (const emit of listeners) {
      emit(event, data);
    }
  }
}

export interface StartLiveRunResult {
  run: Run;
  call: RunCall | null;
  requiresWalletSignature: boolean;
}

export class RunService {
  constructor(
    private readonly runRepo: RunRepository,
    private readonly workflowRepo: WorkflowRepository,
    private readonly chain: ChainAdapter,
  ) {}

  private buildStepRequests(
    nodes: Array<{ kind: string; params?: unknown; config?: unknown }>,
  ): StepRequest[] {
    return nodes.map((n) => {
      const req: StepRequest = {
        kind: n.kind as StepRequest["kind"],
        params: Array.isArray(n.params)
          ? Object.fromEntries(
              (n.params as Array<{ id: string; value: string }>).map((p) => [p.id, p.value]),
            )
          : {},
      };
      if (n.config) req.config = n.config as StepConfig;
      return req;
    });
  }

  async simulate(workflowId: string, ownerId: string): Promise<Run> {
    const workflow = await this.workflowRepo.getOwned(workflowId, ownerId);
    if (workflow.nodes.length === 0) throw emptyWorkflow();

    const ordered = getExecutionOrder(workflow.nodes, workflow.edges);
    const stepRequests = this.buildStepRequests(ordered);
    const estimatedGas = await this.chain.estimateGas(stepRequests);
    const runId = generateId("run");

    await this.runRepo.create({
      id: runId,
      workflowId,
      ownerId,
      mode: "simulation",
      graphSnapshot: { nodes: workflow.nodes, edges: workflow.edges },
      estimatedGas,
    });

    await this.runRepo.updateStatus(runId, "running");

    for (let i = 0; i < ordered.length; i++) {
      const node = ordered[i]!;
      const step = await this.runRepo.createStep({
        id: generateId("step"),
        runId,
        nodeId: node.id,
        kind: node.kind,
        position: i,
        state: "success",
      });
      const gas = stepRequests[i] ? String(await this.chain.estimateGas([stepRequests[i]!])) : "0";
      await this.runRepo.updateStep(step.id, {
        state: "success",
        txHash: null,
        gasUsed: gas,
        finishedAt: new Date(),
      });
    }

    await this.runRepo.updateStatus(runId, "succeeded", {
      finishedAt: new Date(),
      estimatedGas: String(estimatedGas),
    });

    return this.runRepo.getById(runId);
  }

  async startRun(
    workflowId: string,
    ownerId: string,
    callerAddress?: string,
  ): Promise<StartLiveRunResult> {
    const workflow = await this.workflowRepo.getOwned(workflowId, ownerId);
    if (workflow.nodes.length === 0) throw emptyWorkflow();

    if (this.chain.mode === "arc") {
      if (!workflow.onchainId) {
        throw validationFailed(
          "Workflow is not linked to an on-chain workflowId. Create it on-chain first and PATCH onchainId.",
        );
      }
      const runId = generateId("run");

      try {
        await this.runRepo.create({
          id: runId,
          workflowId,
          ownerId,
          mode: "live",
          graphSnapshot: { nodes: workflow.nodes, edges: workflow.edges },
        });
      } catch (err) {
        if (String(err).includes("runs_one_active_per_workflow")) throw runInProgress();
        throw err;
      }

      await this.runRepo.updateStatus(runId, "queued", {
        callerAddress: callerAddress ?? null,
      });

      const call = await this.chain.buildRunCall!(BigInt(workflow.onchainId));
      const run = await this.runRepo.getById(runId);
      return { run, call, requiresWalletSignature: true };
    }

    const runId = generateId("run");
    try {
      await this.runRepo.create({
        id: runId,
        workflowId,
        ownerId,
        mode: "live",
        graphSnapshot: { nodes: workflow.nodes, edges: workflow.edges },
      });
    } catch (err) {
      if (String(err).includes("runs_one_active_per_workflow")) throw runInProgress();
      throw err;
    }

    setImmediate(() => {
      void this.executeMockRun(runId, workflow.nodes, workflow.edges);
    });

    const run = await this.runRepo.getById(runId);
    return { run, call: null, requiresWalletSignature: false };
  }

  private async executeMockRun(
    runId: string,
    nodes: Run["graphSnapshot"]["nodes"],
    edges: Run["graphSnapshot"]["edges"],
  ): Promise<void> {
    const workflowNodes = nodes as import("../schemas/workflow.js").WorkflowNode[];
    const workflowEdges = edges as import("../schemas/workflow.js").WorkflowEdge[];
    const ordered = getExecutionOrder(workflowNodes, workflowEdges);

    await this.runRepo.updateStatus(runId, "running");
    emitToListeners(runId, "status", { status: "running" });

    let failed = false;
    for (let i = 0; i < ordered.length; i++) {
      const node = ordered[i]!;
      if (failed) break;

      const step = await this.runRepo.createStep({
        id: generateId("step"),
        runId,
        nodeId: node.id,
        kind: node.kind,
        position: i,
        state: "running",
      });

      emitToListeners(runId, "step", { nodeId: node.id, state: "running", position: i });

      const params = Array.isArray(node.params)
        ? Object.fromEntries(
            (node.params as Array<{ id: string; value: string }>).map((p) => [p.id, p.value]),
          )
        : {};
      const execReq: StepRequest = { kind: node.kind, params };
      if (node.config) execReq.config = node.config as StepConfig;
      const result = await this.chain.execute!(execReq, runId, i);

      if (result.error) {
        await this.runRepo.updateStep(step.id, {
          state: "failed",
          error: result.error,
          finishedAt: new Date(),
        });
        emitToListeners(runId, "step", { nodeId: node.id, state: "failed", error: result.error });
        failed = true;
      } else {
        await this.runRepo.updateStep(step.id, {
          state: "success",
          txHash: result.txHash,
          gasUsed: String(result.gasUsed),
          finishedAt: new Date(),
        });
        emitToListeners(runId, "step", {
          nodeId: node.id,
          state: "success",
          txHash: result.txHash,
          gasUsed: String(result.gasUsed),
          position: i,
        });
      }
    }

    const finalStatus = failed ? "failed" : "succeeded";
    await this.runRepo.updateStatus(runId, finalStatus, { finishedAt: new Date() });
    emitToListeners(runId, "done", { status: finalStatus });
  }

  async attachTxHash(runId: string, txHash: string): Promise<Run> {
    const run = await this.runRepo.getById(runId);
    if (run.mode !== "live") {
      throw validationFailed("Only live runs can attach a txHash");
    }
    if (run.status !== "queued") {
      throw validationFailed(`Run status is ${run.status}, cannot attach a txHash`);
    }
    await this.runRepo.attachTxHash(runId, txHash);
    await this.runRepo.updateStatus(runId, "running");
    emitToListeners(runId, "status", { status: "running", txHash });

    setImmediate(() => {
      void this.watchOnchainRun(runId, txHash);
    });

    return this.runRepo.getById(runId);
  }

  private async watchOnchainRun(runId: string, txHash: string): Promise<void> {
    if (this.chain.mode !== "arc" || !this.chain.readRun) {
      logger.warn("watchOnchainRun called without arc adapter", { runId });
      return;
    }
    try {
      const outcome = await this.chain.readRun(txHash);

      if (outcome.errorCode) {
        await this.runRepo.updateStatus(runId, "failed", {
          finishedAt: new Date(),
          txHash,
          totalGasUsed: String(outcome.totalGasUsed),
          errorCode: outcome.errorCode,
        });
        emitToListeners(runId, "error", { code: outcome.errorCode, detail: outcome.errorDetail });
        return;
      }

      const run = await this.runRepo.getById(runId);
      const graphNodes = run.graphSnapshot.nodes as Array<{ id: string; kind: string }>;
      const ordered = getExecutionOrder(
        graphNodes as import("../schemas/workflow.js").WorkflowNode[],
        run.graphSnapshot.edges as import("../schemas/workflow.js").WorkflowEdge[],
      );

      for (const step of outcome.steps) {
        const node = ordered[step.position];
        if (!node) continue;
        const stepRow = await this.runRepo.createStep({
          id: generateId("step"),
          runId,
          nodeId: node.id,
          kind: node.kind,
          position: step.position,
          state: "success",
        });
        await this.runRepo.updateStep(stepRow.id, {
          state: "success",
          txHash,
          gasUsed: null,
          finishedAt: new Date(),
        });
        emitToListeners(runId, "step", {
          nodeId: node.id,
          state: "success",
          position: step.position,
          txHash,
          tokenOut: step.tokenOut,
          amountOut: String(step.amountOut),
        });
      }

      await this.runRepo.updateStatus(runId, "succeeded", {
        finishedAt: new Date(),
        txHash,
        onchainRunId: outcome.runId,
        totalGasUsed: String(outcome.totalGasUsed),
        stopped: outcome.stopped,
      });
      emitToListeners(runId, "done", {
        status: "succeeded",
        stopped: outcome.stopped,
        stepsExecuted: outcome.stepsExecuted,
        totalGasUsed: String(outcome.totalGasUsed),
      });
    } catch (err) {
      logger.error("onchain run watcher failed", { runId, txHash, message: String(err) });
      await this.runRepo.updateStatus(runId, "failed", {
        finishedAt: new Date(),
        errorCode: "watcher_error",
      });
      emitToListeners(runId, "error", { code: "watcher_error", detail: String(err) });
    }
  }

  async get(runId: string): Promise<Run> {
    return this.runRepo.getById(runId);
  }

  async listForWorkflow(
    workflowId: string,
    ownerId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ items: Run[]; nextCursor: string | null }> {
    await this.workflowRepo.getOwned(workflowId, ownerId);
    return this.runRepo.listForWorkflow(workflowId, limit, cursor);
  }
}
