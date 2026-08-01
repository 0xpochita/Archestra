import { and, desc, eq, lt } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { workflows } from "../db/schema.js";
import { forbidden, notFound } from "../lib/errors.js";
import type { Workflow, WorkflowEdge, WorkflowNode } from "../schemas/workflow.js";

function toWorkflow(row: typeof workflows.$inferSelect): Workflow {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    tokens: row.tokens as string[],
    nodes: row.nodes as WorkflowNode[],
    edges: row.edges as WorkflowEdge[],
    onchainId: row.onchainId ?? null,
    vaultAddress: row.vaultAddress ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface WorkflowPatch {
  name?: string;
  tokens?: string[];
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  onchainId?: string;
  vaultAddress?: string;
}

export class WorkflowRepository {
  constructor(private readonly db: Database) {}

  async list(
    ownerId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ items: Omit<Workflow, "nodes" | "edges">[]; nextCursor: string | null }> {
    const conditions = [eq(workflows.ownerId, ownerId)];
    if (cursor) {
      const cursorDate = new Date(cursor);
      conditions.push(lt(workflows.createdAt, cursorDate));
    }

    const rows = await this.db
      .select({
        id: workflows.id,
        ownerId: workflows.ownerId,
        name: workflows.name,
        tokens: workflows.tokens,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
      })
      .from(workflows)
      .where(and(...conditions))
      .orderBy(desc(workflows.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => ({
      id: r.id,
      ownerId: r.ownerId,
      name: r.name,
      tokens: r.tokens as string[],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    const nextCursor = hasMore ? (items[items.length - 1]?.createdAt ?? null) : null;
    return { items, nextCursor };
  }

  async create(data: {
    id: string;
    ownerId: string;
    name: string;
    tokens: string[];
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  }): Promise<Workflow> {
    const now = new Date();
    const rows = await this.db
      .insert(workflows)
      .values({
        id: data.id,
        ownerId: data.ownerId,
        name: data.name,
        tokens: data.tokens,
        nodes: data.nodes,
        edges: data.edges,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toWorkflow(rows[0]!);
  }

  async getOwned(id: string, ownerId: string): Promise<Workflow> {
    const rows = await this.db.select().from(workflows).where(eq(workflows.id, id));
    const row = rows[0];
    if (!row) throw notFound("Workflow");
    if (row.ownerId !== ownerId) throw forbidden();
    return toWorkflow(row);
  }

  async update(id: string, ownerId: string, patch: WorkflowPatch): Promise<Workflow> {
    await this.getOwned(id, ownerId);

    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.tokens !== undefined) values.tokens = patch.tokens;
    if (patch.nodes !== undefined) values.nodes = patch.nodes;
    if (patch.edges !== undefined) values.edges = patch.edges;
    if (patch.onchainId !== undefined) values.onchainId = patch.onchainId;
    if (patch.vaultAddress !== undefined) values.vaultAddress = patch.vaultAddress;

    const rows = await this.db
      .update(workflows)
      .set(values)
      .where(and(eq(workflows.id, id), eq(workflows.ownerId, ownerId)))
      .returning();
    return toWorkflow(rows[0]!);
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const rows = await this.db.select().from(workflows).where(eq(workflows.id, id));
    const row = rows[0];
    if (!row) return;
    if (row.ownerId !== ownerId) throw forbidden();
    await this.db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.ownerId, ownerId)));
  }
}
