import { describe, expect, it } from "vitest";
import { planFromPrompt } from "./planner.js";

describe("planFromPrompt", () => {
  it("auto-compound USDC yields trigger + approve + deposit + yield + harvest", () => {
    const result = planFromPrompt("Auto-compound my USDC yield", 0);
    expect(result.kinds).toContain("trigger");
    expect(result.kinds).toContain("yield");
    expect(result.kinds).toContain("harvest");
    expect(result.kinds).toContain("approve");
    expect(result.kinds).toContain("deposit");
  });

  it("trigger is always first in canonical order", () => {
    const result = planFromPrompt("swap some tokens", 0);
    expect(result.kinds[0]).toBe("trigger");
  });

  it("no match falls back to deposit + swap + yield", () => {
    const result = planFromPrompt("do something with my portfolio", 0);
    expect(result.kinds).toContain("deposit");
    expect(result.kinds).toContain("swap");
    expect(result.kinds).toContain("yield");
  });

  it("same prompt produces same output", () => {
    const r1 = planFromPrompt("bridge my ETH cross-chain", 0);
    const r2 = planFromPrompt("bridge my ETH cross-chain", 0);
    expect(r1.kinds).toEqual(r2.kinds);
    expect(r1.name).toBe(r2.name);
    expect(r1.reply).toBe(r2.reply);
  });

  it("reply mentions block count", () => {
    const result = planFromPrompt("swap tokens", 0);
    expect(result.reply).toMatch(/Drafted \d+ block/);
  });

  it("draft name format for different first and last", () => {
    const result = planFromPrompt("deposit and yield", 0);
    expect(result.name).toMatch(/to.*flow/);
  });

  it("deposit pulls in approve prerequisite", () => {
    const result = planFromPrompt("deposit usdc", 0);
    expect(result.kinds).toContain("approve");
    const approveIdx = result.kinds.indexOf("approve");
    const depositIdx = result.kinds.indexOf("deposit");
    expect(approveIdx).toBeLessThan(depositIdx);
  });
});
