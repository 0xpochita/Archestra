import {
  decodeAbiParameters,
  hexToString,
  maxUint256,
  parseAbiParameters,
  zeroAddress,
} from "viem";
import { describe, expect, it } from "vitest";
import { STRATEGY_TEMPLATES } from "@/constants/blocks";
import { createDefaultStepConfig } from "@/lib/step-config";
import type { BlockKind } from "@/types/block";
import { STEP_ADAPTER, STEP_TYPE } from "./adapters";
import {
  collectStepProblems,
  type EncodeInput,
  encodeStep,
  encodeWorkflow,
} from "./encode-steps";
import { TOKENS } from "./tokens";

const CONTEXT = { nowSeconds: 1_800_000_000 };

const ALL_KINDS: BlockKind[] = [
  "trigger",
  "approve",
  "deposit",
  "swap",
  "yield",
  "harvest",
  "bridge",
  "withdraw",
  "condition",
  "alert",
];

const runnableConfig = (kind: BlockKind) => {
  const config = createDefaultStepConfig(kind);
  if (config.kind === "condition") {
    return { ...config, feed: TOKENS.usdc.address };
  }
  if (config.kind === "bridge") {
    return { ...config, receiver: TOKENS.usdc.address };
  }
  return config;
};

const toInput = (kind: BlockKind): EncodeInput => ({
  id: `node-${kind}`,
  kind,
  config: runnableConfig(kind),
});

describe("encodeStep", () => {
  it("encodes every block kind with its registered step type and adapter", () => {
    for (const kind of ALL_KINDS) {
      const step = encodeStep(runnableConfig(kind), CONTEXT);

      expect(step.stepType).toBe(STEP_TYPE[kind]);
      expect(step.adapter).toBe(STEP_ADAPTER[kind]);
      expect(step.params.startsWith("0x")).toBe(true);
    }
  });

  it("scales an exact amount by the token decimals", () => {
    const step = encodeStep(
      { kind: "deposit", asset: "usdc", amount: { mode: "exact", value: "1" } },
      CONTEXT,
    );

    const [asset, amount] = decodeAbiParameters(
      parseAbiParameters("address, uint256"),
      step.params,
    );

    expect(asset).toBe(TOKENS.usdc.address);
    expect(amount).toBe(1_000_000n);
  });

  it("resolves a max amount to the uint256 maximum", () => {
    const step = encodeStep(
      { kind: "deposit", asset: "weth", amount: { mode: "max" } },
      CONTEXT,
    );

    const [, amount] = decodeAbiParameters(
      parseAbiParameters("address, uint256"),
      step.params,
    );

    expect(amount).toBe(maxUint256);
  });

  it("turns the swap deadline window into an absolute timestamp", () => {
    const step = encodeStep(
      {
        kind: "swap",
        tokenIn: "usdc",
        tokenOut: "weth",
        amountIn: { mode: "exact", value: "10" },
        minAmountOut: "0.002",
        feeTier: 3000,
        deadlineDays: 2,
      },
      CONTEXT,
    );

    const [, , amountIn, minAmountOut, feeTier, deadline] = decodeAbiParameters(
      parseAbiParameters("address, address, uint256, uint256, uint24, uint64"),
      step.params,
    );

    expect(amountIn).toBe(10_000_000n);
    expect(minAmountOut).toBe(2_000_000_000_000_000n);
    expect(feeTier).toBe(3000);
    expect(deadline).toBe(BigInt(CONTEXT.nowSeconds + 2 * 86_400));
  });

  it("packs alert text into bytes32", () => {
    const step = encodeStep(
      { kind: "alert", channel: "defi-ops", messageId: "run-report" },
      CONTEXT,
    );

    const [channel, messageId] = decodeAbiParameters(
      parseAbiParameters("bytes32, bytes32"),
      step.params,
    );

    expect(hexToString(channel, { size: 32 })).toBe("defi-ops");
    expect(hexToString(messageId, { size: 32 })).toBe("run-report");
  });
});

describe("encodeWorkflow", () => {
  it("encodes every seeded strategy template", () => {
    for (const template of STRATEGY_TEMPLATES) {
      const result = encodeWorkflow(template.kinds.map(toInput), CONTEXT);

      expect(result.ok, `${template.id} failed to encode`).toBe(true);
      if (result.ok) {
        expect(result.steps).toHaveLength(template.kinds.length);
      }
    }
  });

  it("rejects a zero minimum output", () => {
    const result = encodeWorkflow(
      [
        {
          id: "node-1",
          kind: "harvest",
          config: { kind: "harvest", minValueOut: "0" },
        },
      ],
      CONTEXT,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems[0].message).toContain("greater than zero");
    }
  });

  it("rejects a condition without a deployed price feed", () => {
    const problems = collectStepProblems([
      {
        id: "node-1",
        kind: "condition",
        config: {
          kind: "condition",
          feed: zeroAddress,
          bound: "2000",
          comparator: 0,
          maxStaleSeconds: 3600,
        },
      },
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("price feed");
  });

  it("rejects a swap between the same token", () => {
    const problems = collectStepProblems([
      {
        id: "node-1",
        kind: "swap",
        config: {
          kind: "swap",
          tokenIn: "usdc",
          tokenOut: "usdc",
          amountIn: { mode: "max" },
          minAmountOut: "1",
          feeTier: 500,
          deadlineDays: 1,
        },
      },
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("differ");
  });
});
