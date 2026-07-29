import { desc, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { runSteps, runs } from "../db/schema.js";
import { notFound } from "../lib/errors.js";
import type { Run, RunMode, RunStatus, RunStep } from "../schemas/run.js";
import type { WorkflowEdge, WorkflowNode } from "../schemas/workflow.js";

function toRunStep(row: typeof runSteps.$inferSelect): RunStep {
  return {
    id: row.id,
    runId: row.runId,
    nodeId: row.nodeId,
    kind: row.kind,
    position: row.position,
    state: row.state as RunStep["state"],
    txHash: row.txHash ?? null,
    gasUsed: row.gasUsed ?? null,
    error: row.error ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

function toRun(row: typeof runs.$inferSelect, steps: RunStep[]): Run {
  return {
    id: row.id,
    workflowId: row.workflowId,
    status: row.status as RunStatus,
    mode: row.mode as RunMode,
    graphSnapshot: row.graphSnapshot as { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
    steps,
    estimatedGas: row.estimatedGas ?? null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export class RunRepository {
  constructor(private readonly db: Database) {}

  async create(data: {
    id: string;
    workflowId: string;
    ownerId: string;
    mode: RunMode;
    graphSnapshot: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
    estimatedGas?: bigint;
  }): Promise<Run> {
    const rows = await this.db
      .insert(runs)
      .values({
        id: data.id,
        workflowId: data.workflowId,
        ownerId: data.ownerId,
        mode: data.mode,
        graphSnapshot: data.graphSnapshot,
        estimatedGas: data.estimatedGas?.toString(),
        status: "queued",
      })
      .returning();
    return toRun(rows[0]!, []);
  }

  async getById(id: string): Promise<Run> {
    const runRows = await this.db.select().from(runs).where(eq(runs.id, id));
    const runRow = runRows[0];
    if (!runRow) throw notFound("Run");

    const stepRows = await this.db
      .select()
      .from(runSteps)
      .where(eq(runSteps.runId, id))
      .orderBy(runSteps.position);

    return toRun(runRow, stepRows.map(toRunStep));
  }

  async listForWorkflow(
    workflowId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ items: Run[]; nextCursor: string | null }> {
    const conditions = [eq(runs.workflowId, workflowId)];
    if (cursor) {
      conditions.push(eq(runs.id, cursor));
    }

    const runRows = await this.db
      .select()
      .from(runs)
      .where(eq(runs.workflowId, workflowId))
      .orderBy(desc(runs.createdAt))
      .limit(limit + 1);

    const hasMore = runRows.length > limit;
    const pageRows = runRows.slice(0, limit);

    const items: Run[] = [];
    for (const runRow of pageRows) {
      const stepRows = await this.db
        .select()
        .from(runSteps)
        .where(eq(runSteps.runId, runRow.id))
        .orderBy(runSteps.position);
      items.push(toRun(runRow, stepRows.map(toRunStep)));
    }

    const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  async createStep(data: {
    id: string;
    runId: string;
    nodeId: string;
    kind: string;
    position: number;
    state: RunStep["state"];
  }): Promise<RunStep> {
    const rows = await this.db
      .insert(runSteps)
      .values({
        id: data.id,
        runId: data.runId,
        nodeId: data.nodeId,
        kind: data.kind,
        position: data.position,
        state: data.state,
        startedAt: new Date(),
      })
      .returning();
    return toRunStep(rows[0]!);
  }

  async updateStep(
    stepId: string,
    patch: Partial<{
      state: RunStep["state"];
      txHash: string | null;
      gasUsed: string | null;
      error: string | null;
      finishedAt: Date;
    }>,
  ): Promise<RunStep> {
    const rows = await this.db
      .update(runSteps)
      .set(patch)
      .where(eq(runSteps.id, stepId))
      .returning();
    return toRunStep(rows[0]!);
  }

  async updateStatus(
    runId: string,
    status: RunStatus,
    patch?: { finishedAt?: Date; estimatedGas?: string },
  ): Promise<void> {
    await this.db
      .update(runs)
      .set({ status, ...patch })
      .where(eq(runs.id, runId));
  }
}
