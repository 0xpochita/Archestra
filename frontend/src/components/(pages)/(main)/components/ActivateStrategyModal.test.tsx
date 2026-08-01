import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TokenId } from "@/lib/chain/tokens";
import { ActivateStrategyModal } from "./ActivateStrategyModal";

afterEach(cleanup);

const renderModal = (
  onActivate: (
    tokenId: TokenId,
    maxPerRun: bigint,
    maxPerDay: bigint,
    expiresAt: number,
  ) => Promise<unknown>,
) => {
  const onDone = vi.fn();
  render(
    <ActivateStrategyModal
      tokenIds={["usdc", "weth"]}
      isWriting={false}
      onActivate={onActivate}
      onDone={onDone}
      onClose={vi.fn()}
    />,
  );
  return { onDone };
};

describe("ActivateStrategyModal", () => {
  it("asks for one signature per token and reports which are open", async () => {
    const onActivate = vi.fn().mockResolvedValue(undefined);
    const { onDone } = renderModal(onActivate);

    const button = screen.getByRole("button", {
      name: /Open session for dUSDC/,
    });
    fireEvent.click(button);
    await vi.waitFor(() => expect(onActivate).toHaveBeenCalledTimes(1));

    expect(onActivate.mock.calls[0][0]).toBe("usdc");
    expect(onActivate.mock.calls[0][1]).toBe(500_000_000n);
    expect(onActivate.mock.calls[0][2]).toBe(2_000_000_000n);

    const next = await screen.findByRole("button", {
      name: /Open session for dWETH/,
    });
    expect(screen.getAllByText("Session open")).toHaveLength(1);
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.click(next);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onActivate.mock.calls[1][0]).toBe("weth");
  });

  it("scales each cap by the decimals of its own token", async () => {
    const onActivate = vi.fn().mockResolvedValue(undefined);
    renderModal(onActivate);

    fireEvent.click(
      screen.getByRole("button", { name: /Open session for dUSDC/ }),
    );
    await vi.waitFor(() => expect(onActivate).toHaveBeenCalledTimes(1));

    fireEvent.click(
      await screen.findByRole("button", { name: /Open session for dWETH/ }),
    );
    await vi.waitFor(() => expect(onActivate).toHaveBeenCalledTimes(2));

    expect(onActivate.mock.calls[0][1]).toBe(500_000_000n);
    expect(onActivate.mock.calls[1][1]).toBe(500_000_000_000_000_000_000n);
  });

  it("keeps the first session when the second signature is refused", async () => {
    const onActivate = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("User rejected the request"));
    const { onDone } = renderModal(onActivate);

    fireEvent.click(
      screen.getByRole("button", { name: /Open session for dUSDC/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Open session for dWETH/ }),
    );

    expect(await screen.findByText(/User rejected the request/)).toBeDefined();
    expect(screen.getAllByText("Session open")).toHaveLength(1);
    expect(screen.getAllByText("Waiting")).toHaveLength(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("refuses a cap that is not a positive number", async () => {
    const onActivate = vi.fn().mockResolvedValue(undefined);
    renderModal(onActivate);

    fireEvent.change(screen.getByLabelText("Cap per run"), {
      target: { value: "not a number" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Open session for dUSDC/ }),
    );

    expect(
      await screen.findByText("Both caps must be positive numbers."),
    ).toBeDefined();
    expect(onActivate).not.toHaveBeenCalled();
  });
});
