import { Hono } from "hono";
import type { ContextVariables } from "../lib/hono-types.js";
import type { CatalogService } from "../services/catalog.js";

export function createCatalogRoute(catalogService: CatalogService) {
  const app = new Hono<{ Variables: ContextVariables }>();

  app.get("/blocks", async (c) => {
    const data = await catalogService.listBlocks();
    return c.json({ data }, 200, {
      "Cache-Control": "public, max-age=300",
    });
  });

  app.get("/templates", async (c) => {
    const data = await catalogService.listTemplates();
    return c.json({ data }, 200, {
      "Cache-Control": "public, max-age=300",
    });
  });

  return app;
}
