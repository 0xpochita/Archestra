"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { SMOOTH } from "./motion";

const OPEN_WIDTH = 224;
const CLOSED_WIDTH = 63;

export const SIDEBAR_ROW_CLASS =
  "flex w-full items-center gap-3 border px-2.5 py-2.5 text-sm";
export const SIDEBAR_IDLE_CLASS =
  "border-transparent text-ink-muted transition-colors hover:border-line hover:bg-surface-raised hover:text-ink";
export const SIDEBAR_ACTIVE_CLASS =
  "border-ink bg-ink font-medium text-on-brand";

interface SidebarShellProps {
  label: string;
  isOpen: boolean;
  children: ReactNode;
}

export function SidebarText({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={SMOOTH}
          className="truncate"
        >
          {children}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

export function SidebarSection({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: string;
}) {
  return (
    <p className="h-6 px-2.5 text-[10px] font-semibold tracking-[0.16em] text-ink-subtle uppercase">
      <SidebarText isOpen={isOpen}>{children}</SidebarText>
    </p>
  );
}

export function SidebarShell({ label, isOpen, children }: SidebarShellProps) {
  return (
    <motion.nav
      aria-label={label}
      initial={false}
      animate={{ width: isOpen ? OPEN_WIDTH : CLOSED_WIDTH }}
      transition={SMOOTH}
      className="hidden shrink-0 flex-col gap-1 overflow-hidden border-r border-line bg-shell p-2.5 lg:flex"
    >
      {children}
    </motion.nav>
  );
}
