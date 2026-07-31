"use client";

import { AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { type TokenSession, useSessions } from "@/hooks/useSession";
import type { TokenId } from "@/lib/chain/tokens";
import { formatExpiry, formatTokenAmount } from "@/lib/format";
import { ActivateStrategyModal } from "./ActivateStrategyModal";

const SECTION_LABEL =
  "text-[10px] font-semibold tracking-[0.16em] text-ink-subtle uppercase";

interface SessionSectionProps {
  vaultAddress?: `0x${string}`;
  isVaultDeployed: boolean;
  tokenIds: TokenId[];
  isModalOpen: boolean;
  onModalOpenChange: (isOpen: boolean) => void;
}

function SessionRow({
  session,
  nowSeconds,
  onRevoke,
}: {
  session: TokenSession;
  nowSeconds: number;
  onRevoke: () => void;
}) {
  const { token } = session;

  return (
    <li className="flex flex-col gap-1 border-b border-line/60 py-2.5 last:border-b-0">
      <span className="flex items-center justify-between">
        <span className="text-sm text-ink">{token.symbol}</span>
        {session.isActive ? (
          <button
            type="button"
            onClick={onRevoke}
            className="text-xs text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
          >
            Revoke
          </button>
        ) : (
          <span className="text-xs text-ink-subtle">No active session</span>
        )}
      </span>
      {session.isActive ? (
        <span className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-ink-subtle">
          <span>
            per run {formatTokenAmount(session.maxPerRun, token.decimals)}
          </span>
          <span>
            left today{" "}
            {formatTokenAmount(session.remainingToday, token.decimals)}
          </span>
          <span>{formatExpiry(session.expiresAt, nowSeconds)}</span>
        </span>
      ) : null}
    </li>
  );
}

export function SessionSection({
  vaultAddress,
  isVaultDeployed,
  tokenIds,
  isModalOpen,
  onModalOpenChange,
}: SessionSectionProps) {
  const sessions = useSessions(vaultAddress, tokenIds, isVaultDeployed);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (tokenIds.length === 0) return null;

  const handleRevoke = async (tokenId: TokenId) => {
    await sessions.revokeSession(tokenId);
    sessions.refetch();
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className={SECTION_LABEL}>Spending sessions</h2>

      {isVaultDeployed ? (
        <>
          <ul className="flex flex-col">
            {sessions.sessions.map((session) => (
              <SessionRow
                key={session.token.id}
                session={session}
                nowSeconds={nowSeconds}
                onRevoke={() => {
                  void handleRevoke(session.token.id);
                }}
              />
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-ink-subtle">
            Revoking is immediate, and it does not give back the quota already
            spent today.
          </p>
          <button
            type="button"
            onClick={() => onModalOpenChange(true)}
            className="mt-1 flex items-center justify-center gap-2 border border-line py-2 text-sm text-ink transition-colors hover:bg-surface-hover"
          >
            <Icon name="approve" className="size-4" />
            Activate strategy
          </button>
        </>
      ) : (
        <p className="text-xs text-ink-subtle">
          Sessions open once the vault exists. Create the workflow on chain
          first.
        </p>
      )}

      <AnimatePresence>
        {isModalOpen ? (
          <ActivateStrategyModal
            key="activate-strategy"
            tokenIds={tokenIds}
            isWriting={sessions.isWriting}
            onActivate={sessions.setSession}
            onDone={() => {
              sessions.refetch();
              onModalOpenChange(false);
            }}
            onClose={() => onModalOpenChange(false)}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
