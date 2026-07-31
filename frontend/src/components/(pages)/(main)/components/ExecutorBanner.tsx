"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { AddressLink } from "@/components/ui/AddressLink";
import { Icon } from "@/components/ui/Icon";
import { panelVariants } from "@/components/ui/motion";
import { useVault } from "@/hooks/useVault";
import { useVaultActions } from "@/hooks/useVaultActions";

export function ExecutorBanner() {
  const vault = useVault();
  const actions = useVaultActions(vault.vaultAddress, vault.ownerAddress);
  const [failure, setFailure] = useState<string | null>(null);

  const publishedExecutor = vault.publishedExecutor;
  const isVisible = vault.needsExecutorApproval && Boolean(publishedExecutor);

  const handleAccept = async () => {
    if (!publishedExecutor) return;
    setFailure(null);
    try {
      await actions.acceptExecutor(publishedExecutor);
      vault.refetch();
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "The signature was refused.",
      );
    }
  };

  return (
    <AnimatePresence>
      {isVisible && publishedExecutor ? (
        <motion.section
          key="executor-banner"
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-label="Executor approval"
          className="shrink-0 border-b border-ink bg-surface-raised px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Icon name="approve" className="size-4 shrink-0 text-ink" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink">
                A newer executor is published, and your vault still ignores it
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-ink-subtle">
                <span className="flex items-center gap-1.5">
                  now obeying
                  {vault.acceptedExecutor ? (
                    <AddressLink address={vault.acceptedExecutor} />
                  ) : null}
                </span>
                <span className="flex items-center gap-1.5">
                  published <AddressLink address={publishedExecutor} />
                </span>
              </p>
              {failure ? (
                <p className="mt-1 border-l-2 border-ink pl-2 text-[11px] font-medium text-ink">
                  {failure}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              disabled={actions.isWriting}
              onClick={() => {
                void handleAccept();
              }}
              className="flex items-center gap-2 bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {actions.isWriting ? (
                <Icon name="loader" className="size-4 animate-spin" />
              ) : null}
              Accept this version
            </button>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
