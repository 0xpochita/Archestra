import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Hex, isHex } from "viem";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildRunOutcome, toBlockKind } from "./decode-run";

const hexSchema = z.custom<Hex>(isHex);

const fixtureSchema = z.object({
  network: z.object({
    txHash: hexSchema,
    gasUsed: z.coerce.bigint(),
  }),
  run: z.object({
    runId: z.string(),
    workflowId: z.coerce.bigint(),
  }),
  events: z.array(
    z.object({
      name: z.string(),
      args: z.record(z.string(), z.unknown()),
    }),
  ),
  expectedRunStepsRows: z.array(
    z.object({ position: z.number(), kind: z.string(), state: z.string() }),
  ),
});

const fixture = fixtureSchema.parse(
  JSON.parse(
    readFileSync(
      resolve(
        import.meta.dirname,
        "../../../../contracts/exports/fixtures/run-fixture.json",
      ),
      "utf8",
    ),
  ),
);

const meta = {
  txHash: fixture.network.txHash,
  gasUsed: fixture.network.gasUsed,
};

describe("buildRunOutcome", () => {
  it("maps the recorded run into ordered steps", () => {
    const outcome = buildRunOutcome(fixture.events, meta);

    expect(outcome).not.toBeNull();
    expect(outcome?.runId).toBe(fixture.run.runId);
    expect(outcome?.workflowId).toBe(fixture.run.workflowId);
    expect(outcome?.stopped).toBe(false);
    expect(outcome?.stepsExecuted).toBe(5);
    expect(outcome?.gasUsed).toBe(685_001n);
  });

  it("matches the run_steps rows the indexer is expected to write", () => {
    const outcome = buildRunOutcome(fixture.events, meta);

    expect(
      outcome?.steps.map((step) => ({
        position: step.position,
        kind: step.kind,
      })),
    ).toEqual(
      fixture.expectedRunStepsRows.map((row) => ({
        position: row.position,
        kind: row.kind,
      })),
    );
  });

  it("reports a guarded stop as a finished run rather than a failure", () => {
    const events = [
      {
        name: "RunStarted",
        args: { runId: "0x01", workflowId: 1n, caller: "0x02" },
      },
      { name: "GuardStopped", args: { position: 1n, answer: -5n } },
      { name: "RunCompleted", args: { stopped: true, stepsExecuted: 1n } },
    ];

    const outcome = buildRunOutcome(events, meta);

    expect(outcome?.stopped).toBe(true);
    expect(outcome?.guardStop).toEqual({ position: 1, answer: -5n });
    expect(outcome?.steps).toHaveLength(0);
  });

  it("returns nothing when the run never started", () => {
    expect(buildRunOutcome([], meta)).toBeNull();
  });
});

describe("toBlockKind", () => {
  it("maps every step type back to its studio block", () => {
    expect(toBlockKind(0)).toBe("trigger");
    expect(toBlockKind(3)).toBe("swap");
    expect(toBlockKind(9)).toBe("alert");
    expect(toBlockKind(42)).toBeNull();
  });
});
