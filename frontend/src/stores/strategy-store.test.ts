import { describe, expect, it } from "vitest";
import { strategyStateSchema } from "@/lib/schemas/strategy";
import { createDefaultStepConfig } from "@/lib/step-config";

const strategy = {
  id: "strategy-1",
  name: "Weekly USDC compounding",
  tokens: ["usdc"],
  graph: {
    nodes: [
      {
        id: "node-1",
        kind: "deposit" as const,
        title: "Deposit",
        subtitle: "Aave V3 Pool",
        config: createDefaultStepConfig("deposit"),
        x: 10,
        y: 20,
      },
    ],
    edges: [],
  },
  onchainId: "4",
  createdAt: 1,
  updatedAt: 2,
};

describe("strategyStateSchema", () => {
  it("accepts a state written by this version", () => {
    const parsed = strategyStateSchema.safeParse({
      strategies: [strategy],
      runs: [],
      activeStrategyId: "strategy-1",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a stored graph whose block config no longer parses", () => {
    const parsed = strategyStateSchema.safeParse({
      strategies: [
        {
          ...strategy,
          graph: {
            nodes: [
              { ...strategy.graph.nodes[0], config: { kind: "deposit" } },
            ],
            edges: [],
          },
        },
      ],
      runs: [],
      activeStrategyId: null,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a run record that lost its transaction hash", () => {
    const parsed = strategyStateSchema.safeParse({
      strategies: [],
      runs: [
        {
          runId: "0x01",
          strategyId: "strategy-1",
          strategyName: "Weekly USDC compounding",
          onchainId: "4",
          status: "succeeded",
          stepsExecuted: 2,
          gasUsed: "402651",
          finishedAt: 1,
          steps: [],
        },
      ],
      activeStrategyId: null,
    });

    expect(parsed.success).toBe(false);
  });

  it("keeps run amounts as strings so bigint survives json", () => {
    const parsed = strategyStateSchema.safeParse({
      strategies: [],
      runs: [
        {
          runId: "0x01",
          strategyId: "strategy-1",
          strategyName: "Weekly USDC compounding",
          onchainId: null,
          status: "stopped",
          stepsExecuted: 0,
          gasUsed: "402651",
          txHash: "0x02",
          finishedAt: 1,
          steps: [
            {
              position: 0,
              kind: "swap",
              tokenOut: "0x03",
              amountOut: "50000000000000000",
            },
          ],
        },
      ],
      activeStrategyId: null,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.runs[0].steps[0].amountOut).toBe("50000000000000000");
    }
  });
});
