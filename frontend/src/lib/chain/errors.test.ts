import {
  BaseError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  UserRejectedRequestError,
} from "viem";
import { describe, expect, it } from "vitest";
import { isUserRejection, toChainError } from "./errors";
import { demoTokenAbi, executorAbi, strategyVaultAbi } from "./generated";

function revertedWith(errorName: string, args: unknown[]) {
  const cause = new ContractFunctionRevertedError({
    abi: strategyVaultAbi,
    functionName: "approveAdapter",
  });
  Object.assign(cause, { data: { errorName, args } });
  return new BaseError("reverted", { cause });
}

function bubbledThroughExecutor(data: `0x${string}`) {
  return new BaseError("reverted", {
    cause: new ContractFunctionRevertedError({
      abi: executorAbi,
      data,
      functionName: "run",
    }),
  });
}

describe("toChainError with an error the call abi does not declare", () => {
  it("decodes NoActiveSession bubbled from the vault", () => {
    const raw = encodeErrorResult({
      abi: strategyVaultAbi,
      errorName: "NoActiveSession",
      args: ["0x91E5Bb4576F6871Dac3370dE39f5a772610Cc623"],
    });

    expect(raw.slice(0, 10)).toBe("0x30278bcb");

    const mapped = toChainError(bubbledThroughExecutor(raw));

    expect(mapped?.code).toBe("session_required");
    expect(mapped?.action).toBe("open_session");
  });

  it("decodes ERC20InsufficientBalance bubbled from the token", () => {
    const raw = encodeErrorResult({
      abi: demoTokenAbi,
      errorName: "ERC20InsufficientBalance",
      args: ["0x91E5Bb4576F6871Dac3370dE39f5a772610Cc623", 40n, 100n],
    });

    expect(raw.slice(0, 10)).toBe("0xe450d38c");

    const mapped = toChainError(bubbledThroughExecutor(raw));

    expect(mapped?.code).toBe("insufficient_balance");
    expect(mapped?.action).toBe("fund_vault");
    expect(mapped?.detail).toContain("100");
    expect(mapped?.detail).toContain("40");
  });

  it("still degrades on a selector no contract of ours declares", () => {
    const mapped = toChainError(bubbledThroughExecutor("0xdeadbeef"));

    expect(mapped?.code).toBe("unknown_revert");
  });
});

describe("toChainError", () => {
  it("returns nothing when the user rejected the signature", () => {
    const error = new BaseError("rejected", {
      cause: new UserRejectedRequestError(new Error("denied")),
    });

    expect(isUserRejection(error)).toBe(true);
    expect(toChainError(error)).toBeNull();
  });

  it("offers a session when the vault has none", () => {
    const mapped = toChainError(revertedWith("NoActiveSession", ["0x01"]));

    expect(mapped?.code).toBe("session_required");
    expect(mapped?.action).toBe("open_session");
  });

  it("reports the remaining quota when a cap is breached", () => {
    const mapped = toChainError(
      revertedWith("SessionCapExceeded", ["0x01", 500n, 120n]),
    );

    expect(mapped?.code).toBe("session_cap_exceeded");
    expect(mapped?.detail).toContain("120");
    expect(mapped?.action).toBe("raise_cap");
  });

  it("asks the owner to accept a newer executor", () => {
    const mapped = toChainError(
      revertedWith("ExecutorNotAccepted", ["0xnew", "0xold"]),
    );

    expect(mapped?.action).toBe("accept_executor");
    expect(mapped?.detail).toContain("0xold");
  });

  it("blames the encoder when an adapter pair is wrong", () => {
    const mapped = toChainError(
      revertedWith("AdapterNotAllowed", ["0xadapter", 3]),
    );

    expect(mapped?.code).toBe("encoder_bug");
    expect(mapped?.action).toBe("report");
  });

  it("degrades gracefully on an unknown selector", () => {
    const mapped = toChainError(revertedWith("SomethingNew", []));

    expect(mapped?.code).toBe("unknown_revert");
    expect(mapped?.detail).toContain("SomethingNew");
  });

  it("passes a plain error through with a readable message", () => {
    const mapped = toChainError(new Error("network unreachable"));

    expect(mapped?.code).toBe("transaction_failed");
    expect(mapped?.detail).toBe("network unreachable");
  });

  it("returns nothing when there is no error", () => {
    expect(toChainError(null)).toBeNull();
  });
});
