"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { backdropVariants, panelVariants } from "@/components/ui/motion";
import {
  NAME_STRATEGY_BODY,
  NAME_STRATEGY_SUGGESTIONS,
  NAME_STRATEGY_TITLE,
} from "../constants";

interface NameStrategyModalProps {
  onConfirm: (name: string) => void;
  onSkip: () => void;
}

export function NameStrategyModal({
  onConfirm,
  onSkip,
}: NameStrategyModalProps) {
  const titleId = useId();
  const fieldId = useId();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSkip]);

  const trimmed = name.trim();

  const confirm = () => {
    if (trimmed.length === 0) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <motion.button
        type="button"
        aria-label="Skip naming this strategy"
        onClick={onSkip}
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
        className="relative flex w-110 max-w-full flex-col gap-5 border border-line bg-surface p-5 shadow-xl"
      >
        <header className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center border border-line bg-surface-raised">
            <Icon name="sparkle" className="size-4 text-ink" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {NAME_STRATEGY_TITLE}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
              {NAME_STRATEGY_BODY}
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor={fieldId}>
            Strategy name
          </label>
          <input
            id={fieldId}
            ref={inputRef}
            value={name}
            placeholder="Weekly USDC compounding"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirm();
            }}
            className="h-9 w-full border border-line bg-surface-raised px-2.5 text-sm text-ink outline-none transition-colors focus:border-brand"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {NAME_STRATEGY_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setName(suggestion)}
              className="border border-line px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="border border-line px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-hover"
          >
            Skip for now
          </button>
          <button
            type="button"
            disabled={trimmed.length === 0}
            onClick={confirm}
            className="bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Start building
          </button>
        </div>
      </motion.div>
    </div>
  );
}
