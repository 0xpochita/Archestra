import { Hono } from "hono";
import { validationFailed } from "../lib/errors.js";
import type { ContextVariables } from "../lib/hono-types.js";
import type { OnchainService } from "../services/onchain.js";

export function createOnchainRoute(onchainService: OnchainService) {
  const app = new Hono<{ Variables: ContextVariables }>();

  app.get("/onchain/summary", async (c) => {
    const address = c.req.query("address");
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw validationFailed("query parameter 'address' must be a 20 byte hex address");
    }
    const summary = await onchainService.getSummary(address);
    return c.json({ data: summary });
  });

  return app;
}
