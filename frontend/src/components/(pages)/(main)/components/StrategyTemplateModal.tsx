"use client";

import { motion } from "framer-motion";
import { Fragment, useEffect, useId } from "react";
import { Icon } from "@/components/ui/Icon";
import { STRATEGY_TEMPLATES } from "../constants";
import type { BlockKind } from "../types";
import { BlockGlyph } from "./BlockGlyph";
import { backdropVariants, itemVariants, panelVariants } from "./motion";

interface StrategyTemplateModalProps {
  isLocked: boolean;
  onApply: (kinds: BlockKind[]) => void;
  onClose: () => void;
}

export function StrategyTemplateModal({
  isLocked,
  onApply,
  onClose,
}: StrategyTemplateModalProps) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <motion.button
        type="button"
        aria-label="Close strategy templates"
        onClick={onClose}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative flex max-h-[82vh] w-[560px] max-w-full flex-col overflow-hidden border border-line bg-surface shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-line p-4">
          <span className="grid size-10 shrink-0 place-items-center border border-line bg-surface-raised text-ink">
            <Icon name="grid" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold">
              Strategy templates
            </h2>
            <p className="truncate text-xs text-ink-subtle">
              Drop a ready-made block chain onto the canvas, then tune the
              amounts.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-8 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="close" className="size-4" />
          </button>
        </header>

        <ul className="scroll-slim overflow-y-auto">
          {STRATEGY_TEMPLATES.map((template) => (
            <motion.li
              key={template.id}
              variants={itemVariants}
              className="border-b border-line last:border-b-0"
            >
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onApply(template.kinds)}
                className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-40"
              >
                <span className="text-sm font-medium text-ink">
                  {template.name}
                </span>
                <span className="text-xs text-ink-subtle">
                  {template.description}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 pt-2">
                  {template.kinds.map((kind, index) => (
                    <Fragment key={`${template.id}-${kind}`}>
                      {index > 0 ? (
                        <Icon
                          name="chevronDown"
                          className="size-3 -rotate-90 text-ink-subtle"
                        />
                      ) : null}
                      <span className="grid size-7 place-items-center border border-line bg-surface text-ink">
                        <BlockGlyph kind={kind} className="size-4.5" />
                      </span>
                    </Fragment>
                  ))}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
