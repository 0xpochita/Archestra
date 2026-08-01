import { toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import { decodeRevertData } from "./errors.js";

describe("decodeRevertData", () => {
  it("maps NoActiveSession to session_required", () => {
    const selector = toFunctionSelector("NoActiveSession(address)");
    const data = `${selector}${"0".repeat(64)}`;
    const decoded = decodeRevertData(data);
    expect(decoded.code).toBe("session_required");
  });

  it("maps SessionCapExceeded to session_cap_exceeded", () => {
    const selector = toFunctionSelector("SessionCapExceeded(address,uint256,uint256)");
    const decoded = decodeRevertData(`${selector}${"0".repeat(192)}`);
    expect(decoded.code).toBe("session_cap_exceeded");
  });

  it("maps ExecutorNotAccepted to executor_approval_required", () => {
    const selector = toFunctionSelector("ExecutorNotAccepted(address,address)");
    const decoded = decodeRevertData(`${selector}${"0".repeat(128)}`);
    expect(decoded.code).toBe("executor_approval_required");
  });

  it("maps DeadlinePassed to deadline_passed", () => {
    const selector = toFunctionSelector("DeadlinePassed(uint64)");
    const decoded = decodeRevertData(`${selector}${"0".repeat(64)}`);
    expect(decoded.code).toBe("deadline_passed");
  });

  it("unknown selector returns unknown_revert", () => {
    const decoded = decodeRevertData("0xdeadbeef");
    expect(decoded.code).toBe("unknown_revert");
  });

  it("empty data returns unknown_revert", () => {
    const decoded = decodeRevertData("0x");
    expect(decoded.code).toBe("unknown_revert");
  });

  it("null data returns unknown_revert", () => {
    const decoded = decodeRevertData(null);
    expect(decoded.code).toBe("unknown_revert");
  });
});
