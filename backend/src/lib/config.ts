import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  CHAIN_ADAPTER: z.enum(["mock", "arc"]).default("mock"),
  AI_PLANNER: z.enum(["rules", "llm"]).default("rules"),
});

function parseConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    process.stderr.write(`Config error - missing or malformed environment variables:\n${issues}\n`);
    process.exit(1);
  }
  return result.data;
}

export const config = parseConfig();

export type Config = typeof config;
