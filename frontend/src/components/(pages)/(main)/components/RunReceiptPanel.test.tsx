import { cleanup, render, screen } from "@testing-library/react";
import { zeroAddress } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunOutcome } from "@/lib/chain/decode-run";
import { TOKENS } from "@/lib/chain/tokens";
import { RunReceiptPanel } from "./RunReceiptPanel";

afterEach(cleanup);

const outcome: RunOutcome = {
  runId: "0x5ad51db93f12a2fc0e21865f5f4c8923ac11c8183dabe716869d8b32f36ab11d",
  workflowId: 4n,
  caller: zeroAddress,
  steps: [
    {
      position: 0,
      stepType: 2,
      kind: "deposit",
      adapter: zeroAddress,
      tokenOut: TOKENS.aUsdc.address,
      amountOut: 100_000_000n,
    },
    {
      position: 1,
      stepType: 4,
      kind: "yield",
      adapter: zeroAddress,
      tokenOut: TOKENS.lpToken.address,
      amountOut: 2_500_000_000_000_000_000n,
    },
  ],
  guardStop: null,
  stopped: false,
  stepsExecuted: 2,
  txHash: "0xff3cf413debcd90f55dfdbf929a2cac63f919b8f0d27d3ae164737348d1e1d5c",
  gasUsed: 402_651n,
};

describe("RunReceiptPanel", () => {
  it("reads each output in the decimals of its own token", () => {
    render(<RunReceiptPanel outcome={outcome} onClose={vi.fn()} />);

    expect(screen.getByText(/100 aUSDC/)).toBeDefined();
    expect(screen.getByText(/2.5 crvLP/)).toBeDefined();
  });

  it("reports the gas at the run level, since the chain has no per step number", () => {
    render(<RunReceiptPanel outcome={outcome} onClose={vi.fn()} />);

    expect(screen.getByText("Gas for the whole run")).toBeDefined();
    expect(screen.getByText("402651")).toBeDefined();
  });

  it("explains a step that moves no tokens instead of calling it empty", () => {
    render(
      <RunReceiptPanel
        outcome={{
          ...outcome,
          steps: [
            {
              position: 0,
              stepType: 0,
              kind: "trigger",
              adapter: zeroAddress,
              tokenOut: zeroAddress,
              amountOut: 0n,
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("schedule checked")).toBeDefined();
    expect(screen.queryByText(/no token output/)).toBeNull();
    expect(screen.getByText("Start")).toBeDefined();
  });

  it("announces a successful run with its step count", () => {
    render(<RunReceiptPanel outcome={outcome} onClose={vi.fn()} />);

    expect(screen.getByText("Strategy ran successfully")).toBeDefined();
    expect(screen.getByText(/All 2 steps executed/)).toBeDefined();
  });

  it("renders a guarded stop as a finished run rather than a failure", () => {
    render(
      <RunReceiptPanel
        outcome={{
          ...outcome,
          steps: [],
          stopped: true,
          stepsExecuted: 0,
          guardStop: { position: 1, answer: -5n },
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("The guard stopped the run")).toBeDefined();
    expect(screen.getByText(/That is a success, not a failure/)).toBeDefined();
  });
});
