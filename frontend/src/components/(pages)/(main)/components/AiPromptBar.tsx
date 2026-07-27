"use client";

import { motion } from "framer-motion";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { AI_GREETING, AI_SUGGESTIONS } from "../constants";
import type { ChatMessage } from "../types";
import { Icon } from "./Icon";
import { popoverVariants } from "./motion";

interface AiPromptBarProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-ink-muted">
      <Icon name="loader" className="size-3.5 animate-spin text-ink" />
      Drafting the strategy
    </div>
  );
}

export function AiPromptBar({
  messages,
  isThinking,
  onSubmit,
  onClose,
}: AiPromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const promptId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(prompt);
    setPrompt("");
  };

  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      variants={popoverVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-[680px] max-w-[92vw]"
    >
      {messages.length > 0 || isThinking ? (
        <div className="scroll-slim mb-2 max-h-44 space-y-2 overflow-y-auto border border-line bg-surface/85 p-3 shadow-lg backdrop-blur-xl">
          {messages.map((message) => (
            <p
              key={message.id}
              className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed ${
                message.role === "user"
                  ? "ml-auto bg-brand/10 text-ink"
                  : "bg-surface-raised text-ink-muted"
              }`}
            >
              {message.text}
            </p>
          ))}
          {isThinking ? <ThinkingIndicator /> : null}
        </div>
      ) : null}

      <div className="overflow-hidden border border-line bg-surface/90 shadow-xl backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="flex items-center gap-3 p-3">
          <Icon name="sparkle" className="size-6 shrink-0 text-ink" />
          <label className="sr-only" htmlFor={promptId}>
            Ask the strategy assistant
          </label>
          <input
            id={promptId}
            ref={inputRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="What can I help you with today?"
            className="h-10 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted focus-visible:outline-none"
          />
          <button
            type="button"
            aria-label="Hide assistant"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="close" className="size-4" />
          </button>
          <button
            type="submit"
            aria-label="Send prompt"
            disabled={isThinking || prompt.trim().length === 0}
            className="grid size-10 shrink-0 place-items-center bg-brand text-on-brand transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Icon name="arrowUp" className="size-5" strokeWidth={2} />
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Build with prompts</p>
            <p className="truncate text-xs text-ink-subtle">{AI_GREETING}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {AI_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setPrompt(suggestion)}
                className="border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
