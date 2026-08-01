import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RUN_STEP_DURATION_MS } from "../constants";
import { useWorkflowStudio } from "./useWorkflowStudio";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const tick = () => {
  act(() => {
    vi.advanceTimersByTime(RUN_STEP_DURATION_MS);
  });
};

describe("playRun", () => {
  it("marks every step done and stops running at the end", () => {
    const { result } = renderHook(() => useWorkflowStudio());

    act(() => result.current.playRun(["node-1", "node-2"]));

    expect(result.current.runState["node-1"]).toBe("running");
    expect(result.current.isRunning).toBe(true);

    tick();
    expect(result.current.runState["node-1"]).toBe("success");
    expect(result.current.runState["node-2"]).toBe("running");

    tick();
    expect(result.current.runState["node-1"]).toBe("success");
    expect(result.current.runState["node-2"]).toBe("success");
    expect(result.current.isRunning).toBe(false);
  });

  it("leaves no step spinning when a later run replaces a running one", () => {
    const { result } = renderHook(() => useWorkflowStudio());

    act(() => result.current.playRun(["node-1", "node-2"]));
    tick();

    act(() => result.current.playRun(["node-3"]));
    expect(result.current.runState["node-1"]).toBeUndefined();
    expect(result.current.runState["node-3"]).toBe("running");

    tick();
    expect(result.current.runState["node-3"]).toBe("success");
    expect(result.current.isRunning).toBe(false);
  });

  it("ignores a run with no steps", () => {
    const { result } = renderHook(() => useWorkflowStudio());

    act(() => result.current.playRun([]));

    expect(result.current.isRunning).toBe(false);
  });
});
