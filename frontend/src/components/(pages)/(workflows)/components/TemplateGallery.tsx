"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { STRATEGY_TEMPLATES } from "@/components/(pages)/(main)";
import { Icon } from "@/components/ui/Icon";
import { STUDIO_PATH } from "@/constants/assets";
import {
  BLANK_TEMPLATE_BODY,
  BLANK_TEMPLATE_TITLE,
  EMPTY_RESULT,
  PAGE_SUBTITLE,
  PAGE_TITLE,
  SEARCH_PLACEHOLDER,
} from "../constants";
import { TemplateCard } from "./TemplateCard";

export function TemplateGallery() {
  const [query, setQuery] = useState("");
  const searchId = useId();

  const normalized = query.trim().toLowerCase();
  const templates = STRATEGY_TEMPLATES.filter((template) =>
    `${template.name} ${template.description}`
      .toLowerCase()
      .includes(normalized),
  );

  return (
    <div className="scroll-slim flex-1 overflow-y-auto px-6 py-8 lg:px-10">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {PAGE_TITLE}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{PAGE_SUBTITLE}</p>
        </div>

        <div className="flex items-center gap-2 border border-line bg-surface px-3">
          <Icon name="search" className="size-4 text-ink-subtle" />
          <label className="sr-only" htmlFor={searchId}>
            Search templates
          </label>
          <input
            id={searchId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            className="h-10 w-56 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
          />
        </div>

        <Link
          href={STUDIO_PATH}
          className="flex items-center gap-2 bg-brand px-4 py-2.5 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
        >
          <Icon name="plus" className="size-4" />
          New workflow
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}

        {normalized.length === 0 ? (
          <Link
            href={STUDIO_PATH}
            className="flex flex-col items-center justify-center gap-2 border border-dashed border-line-strong bg-surface p-10 text-center transition-colors hover:bg-surface-hover"
          >
            <span className="grid size-10 place-items-center border border-line bg-surface-raised text-ink">
              <Icon name="plus" className="size-5" />
            </span>
            <span className="text-sm font-semibold text-ink">
              {BLANK_TEMPLATE_TITLE}
            </span>
            <span className="text-xs text-ink-subtle">
              {BLANK_TEMPLATE_BODY}
            </span>
          </Link>
        ) : null}

        {templates.length === 0 ? (
          <p className="py-10 text-sm text-ink-subtle md:col-span-2 xl:col-span-3">
            {EMPTY_RESULT}
          </p>
        ) : null}
      </div>
    </div>
  );
}
