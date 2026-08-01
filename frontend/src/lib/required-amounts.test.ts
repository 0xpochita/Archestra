import { describe, expect, it } from "vitest";
import type { StepConfig } from "./schemas/step-config";
import { createDefaultStepConfig, getRequiredAmounts } from "./step-config";

describe("getRequiredAmounts", () => {
  it("scales each amount by the decimals of its own token", () => {
    const configs: StepConfig[] = [
      {
        kind: "deposit",
        asset: "usdc",
        amount: { mode: "exact", value: "40" },
      },
      {
        kind: "withdraw",
        asset: "weth",
        amount: { mode: "exact", value: "1.5" },
      },
    ];

    const required = getRequiredAmounts(configs);

    expect(required.get("usdc")?.exact).toBe(40_000_000n);
    expect(required.get("weth")?.exact).toBe(1_500_000_000_000_000_000n);
  });

  it("adds up every step that spends the same token", () => {
    const configs: StepConfig[] = [
      {
        kind: "deposit",
        asset: "usdc",
        amount: { mode: "exact", value: "40" },
      },
      {
        kind: "swap",
        tokenIn: "usdc",
        tokenOut: "weth",
        amountIn: { mode: "exact", value: "60" },
        minAmountOut: "0.01",
        feeTier: 3000,
        deadlineDays: 30,
      },
    ];

    expect(getRequiredAmounts(configs).get("usdc")?.exact).toBe(100_000_000n);
  });

  it("flags a step that spends the whole balance", () => {
    const configs: StepConfig[] = [
      { kind: "deposit", asset: "usdc", amount: { mode: "max" } },
    ];

    const requirement = getRequiredAmounts(configs).get("usdc");

    expect(requirement?.usesWholeBalance).toBe(true);
    expect(requirement?.exact).toBe(0n);
  });

  it("ignores blocks that move no tokens", () => {
    const configs = [
      createDefaultStepConfig("trigger"),
      createDefaultStepConfig("alert"),
      createDefaultStepConfig("harvest"),
    ];

    expect(getRequiredAmounts(configs).size).toBe(0);
  });
});

describe("funding shortfall", () => {
  const shortfall = (held: bigint, required: bigint) =>
    held >= required ? 0n : required - held;

  it("tops up a holder that has some but not enough", () => {
    expect(shortfall(30_000_000n, 100_000_000n)).toBe(70_000_000n);
  });

  it("asks for nothing when the holder already has enough", () => {
    expect(shortfall(100_000_000n, 100_000_000n)).toBe(0n);
  });
});
