import { describe, expect, it } from "vitest";
import { formatExpiry } from "./format";
import { createDefaultStepConfig, getStrategyTokens } from "./step-config";

describe("getStrategyTokens", () => {
  it("lists every token a run can spend", () => {
    const tokens = getStrategyTokens([
      createDefaultStepConfig("trigger"),
      createDefaultStepConfig("approve"),
      createDefaultStepConfig("swap"),
      createDefaultStepConfig("withdraw"),
      createDefaultStepConfig("alert"),
    ]);

    expect(tokens).toEqual(["usdc", "aUsdc"]);
  });

  it("ignores blocks that move nothing", () => {
    const tokens = getStrategyTokens([
      createDefaultStepConfig("trigger"),
      createDefaultStepConfig("alert"),
      createDefaultStepConfig("harvest"),
    ]);

    expect(tokens).toEqual([]);
  });
});

describe("formatExpiry", () => {
  const now = 1_800_000_000;

  it("reports a missing session", () => {
    expect(formatExpiry(0, now)).toBe("no session");
  });

  it("reports an expired session rather than a negative window", () => {
    expect(formatExpiry(now - 1, now)).toBe("expired");
  });

  it("rounds a partial window down to whole days", () => {
    expect(formatExpiry(now + 86_400 * 3 + 500, now)).toBe("in 3 days");
  });

  it("falls back to hours inside the last day", () => {
    expect(formatExpiry(now + 7_200, now)).toBe("in 2 hours");
  });
});
