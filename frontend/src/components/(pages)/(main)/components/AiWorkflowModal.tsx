"use client";

import { motion } from "framer-motion";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { AI_GREETING, AI_SUGGESTIONS, BLOCK_CATALOG } from "../constants";
import type { ChatMessage, WorkflowDraft } from "../types";
import { backdropVariants, itemVariants, panelVariants } from "./motion";

interface AiWorkflowModalProps {
  messages: ChatMessage[];
  isThinking: boolean;
  draft: WorkflowDraft | null;
  onSubmit: (prompt: string) => void;
  onAccept: () => void;
  onClear: () => void;
  onClose: () => void;
}

function DraftPreview({ draft }: { draft: WorkflowDraft }) {
  return (
    <ol className="flex flex-col items-center py-10">
      {draft.kinds.map((kind, index) => {
        const definition = BLOCK_CATALOG[kind];

        return (
          <motion.li
            key={`${draft.version}-${kind}-${index === 0 ? "first" : index}`}
            variants={itemVariants}
            className="flex flex-col items-center"
          >
            {index > 0 ? (
              <>
                <span className="h-5 w-px bg-line-strong" />
                <span className="grid size-5 place-items-center border border-line bg-surface text-ink-subtle">
                  <Icon name="plus" className="size-3" strokeWidth={2.4} />
                </span>
                <span className="h-5 w-px bg-line-strong" />
              </>
            ) : null}

            <div className="flex w-[300px] items-center border border-line bg-surface shadow-sm">
              <span className="grid size-14 shrink-0 place-items-center border-r border-line">
                {definition.logo ? (
                  <Logo name={definition.logo} className="size-7" />
                ) : (
                  <Icon name={definition.icon} className="size-6 text-ink" />
                )}
              </span>
              <span className="min-w-0 flex-1 px-3">
                <span className="block truncate text-sm font-semibold text-ink">
                  {definition.label}
                </span>
                <span className="block truncate text-xs text-ink-subtle">
                  {definition.subtitle}
                </span>
              </span>
              <Icon
                name="dots"
                className="mr-3 size-4 shrink-0 rotate-90 text-ink-subtle"
                strokeWidth={2.6}
              />
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function AiWorkflowModal({
  messages,
  isThinking,
  draft,
  onSubmit,
  onAccept,
  onClear,
  onClose,
}: AiWorkflowModalProps) {
  const [prompt, setPrompt] = useState("");
  const titleId = useId();
  const promptId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(prompt);
    setPrompt("");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <motion.button
        type="button"
        aria-label="Close assistant"
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
        className="relative flex h-[80vh] w-[1080px] max-w-full flex-col overflow-hidden border border-line bg-surface shadow-xl"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <button
            type="button"
            aria-label="Back to canvas"
            onClick={onClose}
            className="grid size-8 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="chevronDown" className="size-4 rotate-90" />
          </button>
          <h2 id={titleId} className="text-base font-semibold">
            Generate Workflows with AI
          </h2>
          <span className="ml-auto hidden text-xs text-ink-subtle lg:inline">
            Draft only. Nothing runs until you accept.
          </span>
          {messages.length > 0 || draft ? (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1.5 border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink"
            >
              <Icon name="trash" className="size-3.5" />
              Clear chat
            </button>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1">
          <section className="flex w-[360px] shrink-0 flex-col border-r border-line">
            <div className="scroll-slim flex-1 space-y-4 overflow-y-auto p-4">
              {messages.length === 0 && !isThinking ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-muted">{AI_GREETING}</p>
                  {AI_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setPrompt(suggestion)}
                      className="block w-full border border-line px-3 py-2 text-left text-xs text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}

              {messages.map((message) =>
                message.role === "user" ? (
                  <p
                    key={message.id}
                    className="bg-surface-raised p-3 text-sm leading-relaxed text-ink"
                  >
                    {message.text}
                  </p>
                ) : (
                  <p
                    key={message.id}
                    className="text-sm leading-relaxed text-ink-muted"
                  >
                    {message.text}
                  </p>
                ),
              )}

              {isThinking ? (
                <p className="flex items-center gap-2 text-xs text-ink-muted">
                  <Icon name="loader" className="size-3.5 animate-spin" />
                  Drafting the strategy
                </p>
              ) : null}

              {draft && !isThinking ? (
                <span className="inline-block border border-line px-2.5 py-1 text-xs text-ink">
                  Version V{draft.version}
                </span>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="shrink-0 space-y-3 p-4">
              <div className="relative border border-line bg-surface">
                <label className="sr-only" htmlFor={promptId}>
                  Describe the workflow
                </label>
                <textarea
                  id={promptId}
                  ref={inputRef}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={3}
                  placeholder="Add or make changes..."
                  className="w-full resize-none bg-transparent p-3 pr-12 text-sm text-ink outline-none placeholder:text-ink-subtle focus-visible:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send prompt"
                  disabled={isThinking || prompt.trim().length === 0}
                  className="absolute right-2 bottom-2 grid size-8 place-items-center bg-brand text-on-brand transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Icon name="arrowUp" className="size-4" strokeWidth={2} />
                </button>
              </div>

              <button
                type="button"
                onClick={onAccept}
                disabled={!draft || isThinking}
                className="w-full bg-brand py-3 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Accept Workflow
              </button>
            </form>
          </section>

          <section className="workflow-grid scroll-slim relative min-w-0 flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center gap-2 p-4">
              <span className="grid size-8 place-items-center border border-line bg-surface text-ink-subtle">
                <Icon name="panel" className="size-4" />
              </span>
              <span className="border border-line bg-surface px-3 py-1.5 text-sm text-ink">
                {draft ? draft.name : "No draft yet"}
              </span>
            </div>

            {draft ? (
              <DraftPreview draft={draft} />
            ) : (
              <p className="px-6 pt-24 text-center text-sm text-ink-subtle">
                Describe a strategy on the left and the proposed blocks appear
                here before anything touches your canvas.
              </p>
            )}
          </section>
        </div>
      </motion.div>
    </div>
  );
}
