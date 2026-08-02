"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { backdropVariants, panelVariants } from "@/components/ui/motion";
import { useSessions } from "@/hooks/useSession";
import { useVault } from "@/hooks/useVault";
import { useVaultActions } from "@/hooks/useVaultActions";
import { useWorkflowRun } from "@/hooks/useWorkflowRun";
import type { RunOutcome } from "@/lib/chain/decode-run";
import { toChainError } from "@/lib/chain/errors";
import { TOKENS, type TokenId } from "@/lib/chain/tokens";
import { parseTokenAmount } from "@/lib/format";
import { getRequiredAmounts } from "@/lib/step-config";
import {
  GUIDED_BODY,
  GUIDED_DEMO_AMOUNT,
  GUIDED_SESSION_DAYS,
  GUIDED_SESSION_PER_DAY,
  GUIDED_SESSION_PER_RUN,
  GUIDED_TITLE,
} from "../constants";
import type { WorkflowNode } from "../types";

interface GuidedSetupModalProps {
  orderedNodes: WorkflowNode[];
  canEncode: boolean;
  tokenIds: TokenId[];
  onRunOutcome: (outcome: RunOutcome, nodeIds: string[]) => void;
  onClose: () => void;
}

type StepId = "faucet" | "create" | "session" | "fund" | "run";

interface GuidedStep {
  id: StepId;
  title: string;
  body: string;
  actionLabel: string;
  isDone: boolean;
  isReady: boolean;
  run: () => Promise<unknown>;
}

const demoAmountOf = (tokenId: TokenId) =>
  parseTokenAmount(GUIDED_DEMO_AMOUNT, TOKENS[tokenId].decimals) ?? 0n;

const shortfall = (held: bigint, required: bigint) =>
  held >= required ? 0n : required - held;

export function GuidedSetupModal({
  orderedNodes,
  canEncode,
  tokenIds,
  onRunOutcome,
  onClose,
}: GuidedSetupModalProps) {
  const titleId = useId();
  const vault = useVault();
  const actions = useVaultActions(vault.vaultAddress, vault.ownerAddress);
  const run = useWorkflowRun(vault.acceptedExecutor);
  const sessions = useSessions(
    vault.vaultAddress,
    tokenIds,
    vault.isVaultDeployed,
  );

  const [failure, setFailure] = useState<string | null>(null);
  const [recoveryStep, setRecoveryStep] = useState<StepId | null>(null);
  const [busyStep, setBusyStep] = useState<StepId | null>(null);
  const { outcome } = run;
  const blocked = run.blockedReason ?? run.runError ?? run.createError;

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!outcome) return;
    onRunOutcome(
      outcome,
      outcome.steps.flatMap((step) => {
        const node = orderedNodes.at(step.position);
        return node ? [node.id] : [];
      }),
    );
    onClose();
  }, [outcome, orderedNodes, onRunOutcome, onClose]);

  const balanceOf = (tokenId: TokenId) =>
    vault.balances.find((balance) => balance.token.id === tokenId);

  const requirements = getRequiredAmounts(
    orderedNodes.map((node) => node.config),
  );

  const requiredOf = (tokenId: TokenId) => {
    const requirement = requirements.get(tokenId);
    const demo = demoAmountOf(tokenId);
    if (!requirement) return demo;
    return requirement.exact > demo ? requirement.exact : demo;
  };

  const missingInWallet = tokenIds.filter(
    (id) => (balanceOf(id)?.ownerAmount ?? 0n) < requiredOf(id),
  );
  const missingInVault = tokenIds.filter(
    (id) => (balanceOf(id)?.vaultAmount ?? 0n) < requiredOf(id),
  );
  const withoutSession = sessions.sessions
    .filter((session) => !session.isActive)
    .map((session) => session.token.id);

  const steps: GuidedStep[] = [
    {
      id: "faucet",
      title: "Mint demo tokens",
      body: `Arc testnet tokens are free. This mints ${GUIDED_DEMO_AMOUNT} of every token the strategy spends.`,
      actionLabel: "Mint tokens",
      isDone: missingInWallet.length === 0,
      isReady: true,
      run: async () => {
        for (const tokenId of missingInWallet) {
          const held = balanceOf(tokenId)?.ownerAmount ?? 0n;
          await actions.mint(tokenId, shortfall(held, requiredOf(tokenId)));
        }
      },
    },
    {
      id: "create",
      title: "Store the workflow on chain",
      body: "The steps are encoded and written to the registry. This also creates your vault.",
      actionLabel: "Create on chain",
      isDone: run.isCreated,
      isReady: canEncode,
      run: async () => {
        const problems = run.createWorkflow(orderedNodes);
        if (problems.length > 0) {
          throw new Error(problems[0].message);
        }
      },
    },
    {
      id: "session",
      title: "Open a spending session",
      body: `Nothing moves without your permission. Caps default to ${GUIDED_SESSION_PER_RUN} per run and ${GUIDED_SESSION_PER_DAY} per day, for ${GUIDED_SESSION_DAYS} days.`,
      actionLabel: "Open sessions",
      isDone: withoutSession.length === 0 && vault.isVaultDeployed,
      isReady: vault.isVaultDeployed,
      run: async () => {
        const expiresAt =
          Math.floor(Date.now() / 1000) + GUIDED_SESSION_DAYS * 86_400;
        for (const tokenId of withoutSession) {
          const decimals = TOKENS[tokenId].decimals;
          await sessions.setSession(
            tokenId,
            parseTokenAmount(GUIDED_SESSION_PER_RUN, decimals) ?? 0n,
            parseTokenAmount(GUIDED_SESSION_PER_DAY, decimals) ?? 0n,
            expiresAt,
          );
        }
      },
    },
    {
      id: "fund",
      title: "Send funds to the vault",
      body: `The strategy spends from the vault, not from your wallet. This transfers ${GUIDED_DEMO_AMOUNT} of each token.`,
      actionLabel: "Fund the vault",
      isDone: missingInVault.length === 0 && vault.isVaultDeployed,
      isReady: vault.isVaultDeployed && missingInWallet.length === 0,
      run: async () => {
        for (const tokenId of missingInVault) {
          const held = balanceOf(tokenId)?.vaultAmount ?? 0n;
          await actions.fundVault(
            tokenId,
            shortfall(held, requiredOf(tokenId)),
          );
        }
      },
    },
    {
      id: "run",
      title: "Run the strategy",
      body: "Every step executes in one transaction. Nothing is partial: it either all runs or none of it does.",
      actionLabel: "Run strategy",
      isDone: outcome !== null,
      isReady: run.isCreated && !blocked,
      run: async () => {
        await run.runWorkflow();
      },
    },
  ];

  const firstUnfinished = steps.find((step) => !step.isDone);
  const recovery = recoveryStep
    ? steps.find((step) => step.id === recoveryStep && !step.isDone)
    : undefined;
  const activeStep = recovery ?? firstUnfinished;
  const isBusy = busyStep !== null || run.isRunning || run.isCreating;

  const handleRun = async (step: GuidedStep) => {
    setFailure(null);
    setRecoveryStep(null);
    setBusyStep(step.id);

    try {
      await step.run();
    } catch (error) {
      const mapped = toChainError(error);
      if (!mapped) return;

      if (mapped.action === "fund_vault") {
        setRecoveryStep("faucet");
        setFailure(
          `${mapped.detail} Mint the missing tokens first, then come back to this step.`,
        );
        return;
      }

      setFailure(`${mapped.title}. ${mapped.detail}`);
    } finally {
      setBusyStep(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <motion.button
        type="button"
        aria-label="Close the guided setup"
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
        className="scroll-slim relative flex max-h-[85vh] w-125 max-w-full flex-col gap-4 overflow-y-auto border border-line bg-surface p-5 shadow-xl"
      >
        <header className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center border border-line bg-surface-raised">
            <Icon name="play" className="size-4 text-ink" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {GUIDED_TITLE}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
              {GUIDED_BODY}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="close" className="size-4" />
          </button>
        </header>

        <ol className="flex flex-col">
          {steps.map((step, index) => {
            const isActive = activeStep?.id === step.id;
            return (
              <li
                key={step.id}
                className={`flex gap-3 border-b border-line/60 py-3 last:border-b-0 ${
                  isActive ? "" : "opacity-60"
                }`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center border text-[11px] font-semibold ${
                    step.isDone
                      ? "border-ink bg-brand text-on-brand"
                      : "border-line text-ink-muted"
                  }`}
                >
                  {step.isDone ? (
                    <Icon name="check" className="size-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-subtle">
                    {step.body}
                  </p>

                  {isActive ? (
                    <button
                      type="button"
                      disabled={isBusy || !step.isReady}
                      onClick={() => {
                        void handleRun(step);
                      }}
                      className="mt-2 flex items-center gap-2 bg-brand px-3.5 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {busyStep === step.id ? (
                        <Icon name="loader" className="size-4 animate-spin" />
                      ) : null}
                      {step.actionLabel}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {failure ? (
          <p className="border-l-2 border-ink pl-2 text-xs font-medium text-ink">
            {failure}
          </p>
        ) : null}

        {!failure && blocked ? (
          <p className="border-l-2 border-ink pl-2 text-xs text-ink-muted">
            {blocked.title}. {blocked.detail}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}
