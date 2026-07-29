import { Hono } from "hono";
import { checkDatabase } from "../db/client.js";

export function createHealthRoute() {
  const app = new Hono();
  const startTime = Date.now();

  app.get("/health", async (c) => {
    const dbOk = await checkDatabase();
    const status = dbOk ? "ok" : "degraded";
    const database = dbOk ? "ok" : "unreachable";
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    if (!dbOk) {
      return c.json({ data: { status, database, uptimeSeconds } }, 503);
    }

    return c.json({ data: { status, database, uptimeSeconds } });
  });

  return app;
}
