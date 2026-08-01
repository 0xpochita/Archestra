import { describe, expect, it } from "vitest";
import fixture from "./generated/run-fixture.json" with { type: "json" };
import { stepTypeToBlockKind } from "./step-types.js";

describe("fixture parity with expected run_steps rows", () => {
  it("stepType maps to block kind for every StepExecuted event", () => {
    const stepEvents = (
      fixture.events as Array<{ name: string; args: Record<string, unknown> }>
    ).filter((e) => e.name === "StepExecuted");

    const derived = stepEvents.map((e) => ({
      position: Number(e.args.position as string | number),
      kind: stepTypeToBlockKind(e.args.stepType as number),
    }));

    const expected = (
      fixture.expectedRunStepsRows as Array<{ position: number; kind: string }>
    ).map((r) => ({ position: r.position, kind: r.kind }));

    expect(derived).toEqual(expected);
  });

  it("txHash is shared across all expected run_steps rows", () => {
    const rows = fixture.expectedRunStepsRows as Array<{ txHash: string }>;
    const first = rows[0]!.txHash;
    expect(first).toBe(fixture.network.txHash);
    for (const row of rows) {
      expect(row.txHash).toBe(first);
    }
  });

  it("gasUsed per step is null on chain", () => {
    const rows = fixture.expectedRunStepsRows as Array<{ gasUsed: unknown }>;
    for (const row of rows) {
      expect(row.gasUsed).toBeNull();
    }
  });

  it("total gasUsed matches the fixture", () => {
    expect(fixture.network.gasUsed).toBe("685001");
  });

  it("RunCompleted stopped=false means normal completion", () => {
    const runCompleted = (
      fixture.events as Array<{ name: string; args: Record<string, unknown> }>
    ).find((e) => e.name === "RunCompleted");
    expect(runCompleted?.args.stopped).toBe(false);
  });
});
