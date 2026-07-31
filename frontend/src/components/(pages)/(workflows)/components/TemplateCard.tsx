import Link from "next/link";
import { Fragment } from "react";
import { BlockGlyph } from "@/components/ui/BlockGlyph";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { STUDIO_PATH } from "@/constants/assets";
import { BLOCK_CATALOG } from "@/constants/blocks";
import type { StrategyTemplate } from "@/types/block";

interface TemplateCardProps {
  template: StrategyTemplate;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const lastKind = template.kinds.at(-1);
  const category = lastKind ? BLOCK_CATALOG[lastKind].group : "Strategy";

  return (
    <Link
      href={`${STUDIO_PATH}?template=${template.id}`}
      className="group flex flex-col border border-line bg-surface transition-shadow hover:shadow-md"
    >
      <div className="workflow-grid flex flex-1 flex-wrap items-center justify-center border-b border-line p-6">
        {template.kinds.map((kind, index) => (
          <Fragment key={`${template.id}-${kind}`}>
            {index > 0 ? (
              <span className="h-px w-5 bg-line-strong" aria-hidden="true" />
            ) : null}
            <span className="grid size-10 place-items-center border border-line bg-surface text-ink shadow-sm">
              <BlockGlyph kind={kind} className="size-5" />
            </span>
          </Fragment>
        ))}
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex shrink-0 -space-x-2">
            {template.tokens.map((token) => (
              <Logo
                key={`${template.id}-${token}`}
                name={token}
                className="size-7 rounded-full border-2 border-surface"
              />
            ))}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-ink">
              {template.name}
            </h2>
            <p className="line-clamp-2 text-xs leading-relaxed text-ink-subtle">
              {template.description}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="border border-line px-2.5 py-1 text-xs text-ink-muted">
            {category}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
            {template.kinds.length} blocks
            <Icon
              name="chevronDown"
              className="size-3.5 -rotate-90 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
