import type { ChainAdapter } from "../adapters/chain.js";
import { getExecutionOrder } from "../domain/graph.js";
import { emptyWorkflow, runInProgress } from "../lib/errors.js";
import { generateId } from "../lib/ids.js";
import type { RunRepository } from "../repositories/run.js";
import type { WorkflowRepository } from "../repositories/workflow.js";
import type { Run } from "../schemas/run.js";

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

export class RunService {
  constructor(
    private readonly runRepo: RunRepository,
    private readonly workflowRepo: WorkflowRepository,
    private readonly chain: ChainAdapter,
  ) {}

  async simulate(workflowId: string, ownerId: string): Promise<Run> {
    const workflow = await this.workflowRepo.getOwned(workflowId, ownerId);

    if (workflow.nodes.length === 0) throw emptyWorkflow();

    const ordered = getExecutionOrder(workflow.nodes, workflow.edges);
    const stepRequests = ordered.map((n) => ({
      kind: n.kind,
      params: Object.fromEntries(n.params.map((p) => [p.id, p.value])),
    }));

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

    const steps = [];
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
      await this.runRepo.updateStep(step.id, {
        state: "success",
        txHash: null,
        gasUsed: String(stepRequests[i] ? await this.chain.estimateGas([stepRequests[i]!]) : 0n),
        finishedAt: new Date(),
      });
      steps.push(step);
    }

    await this.runRepo.updateStatus(runId, "succeeded", {
      finishedAt: new Date(),
      estimatedGas: String(estimatedGas),
    });

    return this.runRepo.getById(runId);
  }

  async startRun(workflowId: string, ownerId: string): Promise<Run> {
    const workflow = await this.workflowRepo.getOwned(workflowId, ownerId);

    if (workflow.nodes.length === 0) throw emptyWorkflow();

    const runId = generateId("run");

    try {
      const run = await this.runRepo.create({
        id: runId,
        workflowId,
        ownerId,
        mode: "live",
        graphSnapshot: { nodes: workflow.nodes, edges: workflow.edges },
      });

      setImmediate(() => {
        void this.executeRun(runId, workflow.nodes, workflow.edges, ownerId);
      });

      return run;
    } catch (err: unknown) {
      const errMsg = String(err);
      if (errMsg.includes("runs_one_active_per_workflow")) {
        throw runInProgress();
      }
      throw err;
    }
  }

  private async executeRun(
    runId: string,
    nodes: Run["graphSnapshot"]["nodes"],
    edges: Run["graphSnapshot"]["edges"],
    _ownerId: string,
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

      emitToListeners(runId, "step", {
        nodeId: node.id,
        state: "running",
        position: i,
      });

      const params = Object.fromEntries(node.params.map((p) => [p.id, p.value]));
      const result = await this.chain.execute({ kind: node.kind, params }, runId, i);

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
