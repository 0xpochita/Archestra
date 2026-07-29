import { asc, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { blocks, templates } from "../db/schema.js";
import type { BlockDefinition, StrategyTemplate } from "../schemas/common.js";

export class CatalogRepository {
  constructor(private readonly db: Database) {}

  async listBlocks(): Promise<BlockDefinition[]> {
    const rows = await this.db.select().from(blocks).orderBy(asc(blocks.sortOrder));
    return rows.map((r) => ({
      kind: r.kind as BlockDefinition["kind"],
      label: r.label,
      group: r.groupName,
      description: r.description,
      subtitle: r.subtitle,
      params: r.params as BlockDefinition["params"],
    }));
  }

  async listTemplates(): Promise<StrategyTemplate[]> {
    const rows = await this.db.select().from(templates).orderBy(asc(templates.sortOrder));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      tokens: r.tokens as string[],
      kinds: r.kinds as StrategyTemplate["kinds"],
    }));
  }

  async getTemplate(id: string): Promise<StrategyTemplate | null> {
    const rows = await this.db.select().from(templates).where(eq(templates.id, id));
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      tokens: row.tokens as string[],
      kinds: row.kinds as StrategyTemplate["kinds"],
    };
  }
}
