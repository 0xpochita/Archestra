import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { assistantMessages, assistantSessions, workflowDrafts } from "../db/schema.js";
import { draftAlreadyAccepted, notFound } from "../lib/errors.js";
import type { ChatMessage, WorkflowDraft } from "../schemas/assistant.js";
import type { BlockKind } from "../schemas/common.js";

function toMessage(row: typeof assistantMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as ChatMessage["role"],
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDraft(row: typeof workflowDrafts.$inferSelect): WorkflowDraft {
  return {
    id: row.id,
    sessionId: row.sessionId,
    name: row.name,
    version: row.version,
    kinds: row.kinds as BlockKind[],
    createdAt: row.createdAt.toISOString(),
  };
}

export class AssistantRepository {
  constructor(private readonly db: Database) {}

  async createSession(data: { id: string; ownerId: string }): Promise<{ id: string }> {
    const rows = await this.db
      .insert(assistantSessions)
      .values({ id: data.id, ownerId: data.ownerId })
      .returning({ id: assistantSessions.id });
    return rows[0]!;
  }

  async getSession(
    id: string,
    ownerId: string,
  ): Promise<typeof assistantSessions.$inferSelect | null> {
    if (ownerId === "") {
      const rows = await this.db
        .select()
        .from(assistantSessions)
        .where(eq(assistantSessions.id, id));
      return rows[0] ?? null;
    }
    const rows = await this.db
      .select()
      .from(assistantSessions)
      .where(and(eq(assistantSessions.id, id), eq(assistantSessions.ownerId, ownerId)));
    return rows[0] ?? null;
  }

  async deleteSession(id: string, ownerId: string): Promise<void> {
    await this.db
      .delete(assistantSessions)
      .where(and(eq(assistantSessions.id, id), eq(assistantSessions.ownerId, ownerId)));
  }

  async addMessage(data: {
    id: string;
    sessionId: string;
    role: "user" | "assistant";
    text: string;
  }): Promise<ChatMessage> {
    const rows = await this.db.insert(assistantMessages).values(data).returning();
    return toMessage(rows[0]!);
  }

  async listMessages(sessionId: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.sessionId, sessionId))
      .orderBy(asc(assistantMessages.createdAt));
    return rows.map(toMessage);
  }

  async getLatestVersion(sessionId: string): Promise<number> {
    const rows = await this.db
      .select({ version: workflowDrafts.version })
      .from(workflowDrafts)
      .where(eq(workflowDrafts.sessionId, sessionId))
      .orderBy(desc(workflowDrafts.version))
      .limit(1);
    return rows[0]?.version ?? 0;
  }

  async createDraft(data: {
    id: string;
    sessionId: string;
    name: string;
    version: number;
    kinds: BlockKind[];
  }): Promise<WorkflowDraft> {
    const rows = await this.db
      .insert(workflowDrafts)
      .values({ ...data, kinds: data.kinds as unknown[] })
      .returning();
    return toDraft(rows[0]!);
  }

  async getDraft(id: string): Promise<WorkflowDraft & { acceptedAt: Date | null }> {
    const rows = await this.db.select().from(workflowDrafts).where(eq(workflowDrafts.id, id));
    const row = rows[0];
    if (!row) throw notFound("Draft");
    return { ...toDraft(row), acceptedAt: row.acceptedAt };
  }

  async acceptDraft(id: string): Promise<WorkflowDraft> {
    const draft = await this.getDraft(id);
    if (draft.acceptedAt !== null) {
      throw draftAlreadyAccepted();
    }
    const rows = await this.db
      .update(workflowDrafts)
      .set({ acceptedAt: new Date() })
      .where(and(eq(workflowDrafts.id, id), isNull(workflowDrafts.acceptedAt)))
      .returning();
    if (rows.length === 0) throw draftAlreadyAccepted();
    return toDraft(rows[0]!);
  }
}
