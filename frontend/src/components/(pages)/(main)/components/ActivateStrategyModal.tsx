"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { backdropVariants, panelVariants } from "@/components/ui/motion";
import { TOKENS, type TokenId } from "@/lib/chain/tokens";
import { parseTokenAmount } from "@/lib/format";

const DEFAULT_PER_RUN = "500";
const DEFAULT_PER_DAY = "2000";
const DEFAULT_DAYS = 30;

interface ActivateStrategyModalProps {
  tokenIds: TokenId[];
  isWriting: boolean;
  onActivate: (
    tokenId: TokenId,
    maxPerRun: bigint,
    maxPerDay: bigint,
    expiresAt: number,
  ) => Promise<unknown>;
  onDone: () => void;
  onClose: () => void;
}

const FIELD_CLASS =
  "h-9 w-full border border-line bg-surface-raised px-2.5 text-sm text-ink outline-none transition-colors focus:border-brand";

export function ActivateStrategyModal({
  tokenIds,
  isWriting,
  onActivate,
  onDone,
  onClose,
}: ActivateStrategyModalProps) {
  const titleId = useId();
  const fieldId = useId();
  const [perRun, setPerRun] = useState(DEFAULT_PER_RUN);
  const [perDay, setPerDay] = useState(DEFAULT_PER_DAY);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [signedTokens, setSignedTokens] = useState<TokenId[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const pending = tokenIds.filter((id) => !signedTokens.includes(id));
  const nextToken = pending.at(0);

  const handleActivate = async () => {
    if (!nextToken) return;
    const token = TOKENS[nextToken];
    const maxPerRun = parseTokenAmount(perRun, token.decimals);
    const maxPerDay = parseTokenAmount(perDay, token.decimals);

    if (maxPerRun === null || maxPerDay === null) {
      setFailure("Both caps must be positive numbers.");
      return;
    }

    setFailure(null);
    const expiresAt = Math.floor(Date.now() / 1000) + days * 86_400;

    try {
      await onActivate(nextToken, maxPerRun, maxPerDay, expiresAt);
      const signed = [...signedTokens, nextToken];
      setSignedTokens(signed);
      if (signed.length === tokenIds.length) onDone();
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "The signature was refused.",
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <motion.button
        type="button"
        aria-label="Close the activation dialog"
        onClick={onClose}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative flex w-[460px] max-w-full flex-col gap-5 border border-line bg-surface p-5 shadow-xl"
      >
        <header className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center border border-line bg-surface-raised">
            <Icon name="vault" className="size-4 text-ink" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              Activate strategy
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
              A run can spend nothing without a session. One signature per
              token, and every cap stays under your control.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs text-ink-muted"
              htmlFor={`${fieldId}-run`}
            >
              Cap per run
            </label>
            <input
              id={`${fieldId}-run`}
              value={perRun}
              onChange={(event) => setPerRun(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs text-ink-muted"
              htmlFor={`${fieldId}-day`}
            >
              Cap per day
            </label>
            <input
              id={`${fieldId}-day`}
              value={perDay}
              onChange={(event) => setPerDay(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor={`${fieldId}-days`}>
            Valid for (days)
          </label>
          <input
            id={`${fieldId}-days`}
            type="number"
            min={1}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className={FIELD_CLASS}
          />
        </div>

        <ul className="flex flex-col gap-1 border-t border-line pt-3">
          {tokenIds.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between text-sm text-ink"
            >
              {TOKENS[id].symbol}
              <span className="text-xs text-ink-subtle">
                {signedTokens.includes(id) ? "Session open" : "Waiting"}
              </span>
            </li>
          ))}
        </ul>

        {failure ? (
          <p className="border-l-2 border-ink pl-2 text-xs font-medium text-ink">
            {failure}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-line px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-hover"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!nextToken || isWriting}
            onClick={handleActivate}
            className="flex items-center gap-2 bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isWriting ? (
              <Icon name="loader" className="size-4 animate-spin" />
            ) : null}
            {nextToken
              ? `Open session for ${TOKENS[nextToken].symbol}`
              : "All sessions open"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
