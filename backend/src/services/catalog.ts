import type { CatalogRepository } from "../repositories/catalog.js";
import type { BlockDefinition, StrategyTemplate } from "../schemas/common.js";

export class CatalogService {
  constructor(private readonly repo: CatalogRepository) {}

  async listBlocks(): Promise<BlockDefinition[]> {
    return this.repo.listBlocks();
  }

  async listTemplates(): Promise<StrategyTemplate[]> {
    return this.repo.listTemplates();
  }
}
