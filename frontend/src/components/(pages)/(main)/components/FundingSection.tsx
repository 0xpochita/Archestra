"use client";

import { useState } from "react";
import type { Address } from "viem";
import { Icon } from "@/components/ui/Icon";
import type { TokenBalance } from "@/hooks/useVault";
import { useVaultActions } from "@/hooks/useVaultActions";
import { parseTokenAmount } from "@/lib/format";

const SECTION_LABEL =
  "text-[10px] font-semibold tracking-[0.16em] text-ink-subtle uppercase";
const ACTION_CLASS =
  "flex-1 border border-line px-2 py-1.5 text-xs text-ink transition-colors hover:bg-surface-hover disabled:opacity-50";
const MINT_AMOUNT = "1000";

interface FundingSectionProps {
  vaultAddress?: Address;
  ownerAddress?: Address;
  isVaultDeployed: boolean;
  balances: TokenBalance[];
  onSettled: () => void;
}

export function FundingSection({
  vaultAddress,
  ownerAddress,
  isVaultDeployed,
  balances,
  onSettled,
}: FundingSectionProps) {
  const actions = useVaultActions(vaultAddress, ownerAddress);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const fundable = balances.filter((balance) => balance.token.isMintable);

  const run = async (task: Promise<unknown>) => {
    setFailure(null);
    try {
      await task;
      onSettled();
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "The transaction failed.",
      );
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className={SECTION_LABEL}>Move funds</h2>

      {fundable.map(({ token }) => {
        const raw = amounts[token.id] ?? "";
        const parsed = parseTokenAmount(raw, token.decimals);
        const inputId = `funding-${token.id}`;

        return (
          <div key={token.id} className="flex flex-col gap-1.5">
            <label className="text-xs text-ink-muted" htmlFor={inputId}>
              {token.symbol}
            </label>
            <input
              id={inputId}
              value={raw}
              placeholder="0.00"
              onChange={(event) =>
                setAmounts((current) => ({
                  ...current,
                  [token.id]: event.target.value,
                }))
              }
              className="h-9 w-full border border-line bg-surface-raised px-2.5 text-sm text-ink outline-none transition-colors focus:border-brand"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={actions.isWriting || !ownerAddress}
                onClick={() =>
                  void run(
                    actions.mint(
                      token.id,
                      parsed ??
                        parseTokenAmount(MINT_AMOUNT, token.decimals) ??
                        0n,
                    ),
                  )
                }
                className={ACTION_CLASS}
              >
                Mint
              </button>
              <button
                type="button"
                disabled={
                  actions.isWriting || parsed === null || !isVaultDeployed
                }
                onClick={() =>
                  parsed && void run(actions.fundVault(token.id, parsed))
                }
                className={ACTION_CLASS}
              >
                Fund vault
              </button>
              <button
                type="button"
                disabled={actions.isWriting || parsed === null}
                onClick={() =>
                  parsed && void run(actions.withdraw(token.id, parsed))
                }
                title="Withdrawing never needs a session and works while the system is paused"
                className={ACTION_CLASS}
              >
                Withdraw
              </button>
            </div>
          </div>
        );
      })}

      {failure ? (
        <p className="border-l-2 border-ink pl-2 text-xs font-medium text-ink">
          {failure}
        </p>
      ) : null}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-subtle">
        <Icon name="unlock" className="mt-px size-3.5 shrink-0" />
        Withdraw is always open to the vault owner: no session, no executor and
        no pause can block it.
      </p>
    </section>
  );
}
