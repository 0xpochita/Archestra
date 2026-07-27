"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BLOCK_CATALOG, STRATEGY_TEMPLATES } from "../constants";
import type { StrategyTemplate } from "../types";
import { Icon } from "./Icon";
import { itemVariants, popoverVariants } from "./motion";

interface WorkflowTitleProps {
  name: string;
  onNameChange: (name: string) => void;
  onSelectStrategy: (template: StrategyTemplate) => void;
}

export function WorkflowTitle({
  name,
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
      className="relative flex min-w-0 items-center gap-1"
    >
      <label className="sr-only" htmlFor="workflow-name">
        Workflow name
      </label>
      <input
        id="workflow-name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        className="min-w-0 max-w-md flex-1 bg-transparent text-lg font-semibold text-ink outline-none"
      />
      <button
        type="button"
        aria-label="Switch strategy"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((open) => !open)}
        className="grid size-8 shrink-0 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
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
                        className="grid size-6 place-items-center border border-line bg-surface-raised text-ink"
                      >
                        <Icon
                          name={BLOCK_CATALOG[kind].icon}
                          className="size-3.5"
                        />
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
