"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import type { LogoName } from "@/types/logo";
import { STRATEGY_TEMPLATES } from "../constants";
import type { StrategyTemplate } from "../types";
import { BlockGlyph } from "./BlockGlyph";
import { itemVariants, popoverVariants } from "./motion";

const MIN_NAME_SIZE = 10;

interface WorkflowTitleProps {
  name: string;
  tokens: LogoName[];
  onNameChange: (name: string) => void;
  onSelectStrategy: (template: StrategyTemplate) => void;
}

export function WorkflowTitle({
  name,
  tokens,
  onNameChange,
  onSelectStrategy,
}: WorkflowTitleProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }
      setIsMenuOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleSelect = (template: StrategyTemplate) => {
    onSelectStrategy(template);
    setIsMenuOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 items-center gap-2"
    >
      <span className="flex shrink-0 -space-x-1.5">
        {tokens.map((token) => (
          <Logo
            key={token}
            name={token}
            className="size-6 rounded-full border-2 border-shell"
          />
        ))}
      </span>

      <label className="sr-only" htmlFor="workflow-name">
        Workflow name
      </label>
      <input
        id="workflow-name"
        value={name}
        size={Math.max(name.length, MIN_NAME_SIZE)}
        onChange={(event) => onNameChange(event.target.value)}
        className="min-w-0 max-w-full bg-transparent text-lg font-semibold text-ink outline-none"
      />
      <button
        type="button"
        aria-label="Switch strategy"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((open) => !open)}
        className="grid size-8 shrink-0 place-items-center border border-line bg-surface text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
      >
        <Icon
          name="chevronDown"
          className={`size-4 transition-transform ${
            isMenuOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isMenuOpen ? (
          <motion.ul
            variants={popoverVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="scroll-slim absolute top-12 left-0 z-40 max-h-[60vh] w-[380px] overflow-y-auto border border-line bg-surface shadow-xl"
          >
            {STRATEGY_TEMPLATES.map((template) => (
              <motion.li
                key={template.id}
                variants={itemVariants}
                className="border-b border-line last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => handleSelect(template)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="flex shrink-0 -space-x-2">
                    {template.tokens.map((token) => (
                      <Logo
                        key={`${template.id}-${token}`}
                        name={token}
                        className="size-7 rounded-full border-2 border-surface"
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {template.name}
                    </span>
                    <span className="block truncate text-xs text-ink-subtle">
                      {template.kinds.length} blocks
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {template.kinds.map((kind) => (
                      <span
                        key={`${template.id}-${kind}`}
                        className="grid size-6 place-items-center border border-line bg-surface text-ink"
                      >
                        <BlockGlyph kind={kind} className="size-4" />
                      </span>
                    ))}
                  </span>
                  {template.name === name ? (
                    <Icon name="check" className="size-4 shrink-0 text-ink" />
                  ) : null}
                </button>
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
