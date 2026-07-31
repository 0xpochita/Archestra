"use client";

import Image from "next/image";
import { AddressLink } from "@/components/ui/AddressLink";
import { Icon } from "@/components/ui/Icon";
import { ARC_CHAIN_NAME } from "@/config/chain";
import type { TokenBalance } from "@/hooks/useVault";
import { useVault } from "@/hooks/useVault";
import type { TokenId } from "@/lib/chain/tokens";
import { formatTokenAmount } from "@/lib/format";
import { FundingSection } from "./FundingSection";
import { SessionSection } from "./SessionSection";

const SECTION_LABEL =
  "text-[10px] font-semibold tracking-[0.16em] text-ink-subtle uppercase";

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <aside className="scroll-slim flex w-[360px] shrink-0 flex-col gap-6 overflow-y-auto border-l border-line bg-surface p-5">
      {children}
    </aside>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <PanelShell>
      <div className="flex flex-col items-start gap-2">
        <Icon name="vault" className="size-6 text-ink-subtle" />
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-subtle">{detail}</p>
      </div>
    </PanelShell>
  );
}

function BalanceRow({ balance }: { balance: TokenBalance }) {
  const { token, ownerAmount, vaultAmount } = balance;

  return (
    <li className="flex items-center justify-between gap-3 border-b border-line/60 py-2.5 last:border-b-0">
      <span className="flex min-w-0 items-center gap-2">
        {token.logoSrc ? (
          <Image
            src={token.logoSrc}
            alt=""
            width={20}
            height={20}
            className="size-5 shrink-0"
          />
        ) : (
          <span className="grid size-5 shrink-0 place-items-center bg-surface-raised text-[9px] font-semibold text-ink-muted">
            {token.symbol.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="truncate text-sm text-ink">{token.symbol}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm text-ink">
          {formatTokenAmount(vaultAmount, token.decimals)}
        </span>
        <span className="block font-mono text-[11px] text-ink-subtle">
          wallet {formatTokenAmount(ownerAmount, token.decimals)}
        </span>
      </span>
    </li>
  );
}

interface VaultPanelProps {
  tokenIds: TokenId[];
  isActivateOpen: boolean;
  onActivateOpenChange: (isOpen: boolean) => void;
}

export function VaultPanel({
  tokenIds,
  isActivateOpen,
  onActivateOpenChange,
}: VaultPanelProps) {
  const vault = useVault();

  if (!vault.isConnected) {
    return (
      <EmptyState
        title="Wallet not connected"
        detail={`Connect a wallet on ${ARC_CHAIN_NAME} to see the vault that holds this strategy's funds.`}
      />
    );
  }

  if (vault.isWrongNetwork) {
    return (
      <EmptyState
        title="Wrong network"
        detail={`Switch the wallet to ${ARC_CHAIN_NAME} to read the vault.`}
      />
    );
  }

  if (vault.error) {
    return (
      <EmptyState
        title="Could not read the vault"
        detail="The RPC endpoint did not answer. Check the connection and try again."
      />
    );
  }

  return (
    <PanelShell>
      <section className="flex flex-col gap-2">
        <h2 className={SECTION_LABEL}>Strategy vault</h2>
        {vault.vaultAddress ? (
          <>
            <AddressLink address={vault.vaultAddress} className="text-sm" />
            <p className="text-xs text-ink-subtle">
              {vault.isVaultDeployed
                ? "Only this wallet can withdraw from it."
                : "Not deployed yet. This address is reserved and is created with the first workflow."}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-subtle">Reading the vault address.</p>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className={SECTION_LABEL}>Balances</h2>
        <ul className="flex flex-col">
          {vault.balances.map((balance) => (
            <BalanceRow key={balance.token.id} balance={balance} />
          ))}
        </ul>
      </section>

      <SessionSection
        vaultAddress={vault.vaultAddress}
        isVaultDeployed={vault.isVaultDeployed}
        tokenIds={tokenIds}
        isModalOpen={isActivateOpen}
        onModalOpenChange={onActivateOpenChange}
      />

      <FundingSection
        vaultAddress={vault.vaultAddress}
        ownerAddress={vault.ownerAddress}
        isVaultDeployed={vault.isVaultDeployed}
        balances={vault.balances}
        onSettled={vault.refetch}
      />

      {vault.acceptedExecutor ? (
        <section className="flex flex-col gap-2">
          <h2 className={SECTION_LABEL}>Accepted executor</h2>
          <AddressLink address={vault.acceptedExecutor} />
          <p className="text-xs text-ink-subtle">
            The vault obeys this version only. A newer published version moves
            nothing until this wallet accepts it.
          </p>
        </section>
      ) : null}
    </PanelShell>
  );
}
