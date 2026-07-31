import { describe, expect, it } from "vitest";
import { getRunStage, getRunStageLabel, type RunStageInput } from "./run-stage";

const ready: RunStageInput = {
  isConnected: true,
  isWrongNetwork: false,
  canEncode: true,
  isCreated: true,
  hasMissingSession: false,
  isUnfunded: false,
};

describe("getRunStage", () => {
  it("asks for a wallet before anything else", () => {
    expect(getRunStage({ ...ready, isConnected: false })).toBe("connect");
  });

  it("asks for the right network before reading the vault", () => {
    expect(
      getRunStage({ ...ready, isWrongNetwork: true, isCreated: false }),
    ).toBe("switch_network");
  });

  it("blocks creation while a block cannot be encoded", () => {
    expect(getRunStage({ ...ready, isCreated: false, canEncode: false })).toBe(
      "fix_graph",
    );
  });

  it("creates the workflow before asking for a session", () => {
    expect(
      getRunStage({ ...ready, isCreated: false, hasMissingSession: true }),
    ).toBe("create");
  });

  it("opens a session before asking for funds", () => {
    expect(
      getRunStage({ ...ready, hasMissingSession: true, isUnfunded: true }),
    ).toBe("open_session");
  });

  it("funds the vault before running", () => {
    expect(getRunStage({ ...ready, isUnfunded: true })).toBe("fund");
  });

  it("runs once every precondition is met", () => {
    expect(getRunStage(ready)).toBe("run");
  });
});

describe("getRunStageLabel", () => {
  it("names every stage", () => {
    expect(getRunStageLabel("open_session")).toBe("Open a session");
    expect(getRunStageLabel("run")).toBe("Run strategy");
  });
});
