"use client";

import { motion } from "framer-motion";
import { useEffect, useId } from "react";
import { Icon } from "@/components/ui/Icon";
import type { BlockKind } from "../types";
import { BlockLibrary } from "./BlockLibrary";
import { backdropVariants, panelVariants } from "./motion";

interface BlockLibraryModalProps {
  isLocked: boolean;
  anchorTitle?: string;
  onAdd: (kind: BlockKind) => void;
  onClose: () => void;
}

export function BlockLibraryModal({
  isLocked,
  anchorTitle,
  onAdd,
  onClose,
}: BlockLibraryModalProps) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleAdd = (kind: BlockKind) => {
    onAdd(kind);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <motion.button
        type="button"
        aria-label="Close block library"
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
        className="relative flex max-h-[82vh] w-[520px] max-w-full flex-col overflow-hidden border border-line bg-surface shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-line p-4">
          <span className="grid size-10 shrink-0 place-items-center border border-line bg-surface-raised text-ink">
            <Icon name="addBlocks" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold">
              Add a block
            </h2>
            <p className="truncate text-xs text-ink-subtle">
              {anchorTitle
                ? `Connects after ${anchorTitle}`
                : "Drops onto the middle of the canvas"}
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

        <BlockLibrary isLocked={isLocked} onAdd={handleAdd} />
      </motion.div>
    </div>
  );
}
