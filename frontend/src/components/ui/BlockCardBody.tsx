import type { ReactNode } from "react";

export const BLOCK_CARD_TILE_SIZE = 72;

interface BlockCardBodyProps {
  tile: ReactNode;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}

export function BlockCardBody({
  tile,
  title,
  subtitle,
  trailing,
}: BlockCardBodyProps) {
  return (
    <>
      <span
        style={{ width: BLOCK_CARD_TILE_SIZE }}
        className="grid shrink-0 place-items-center border-r border-line bg-surface"
      >
        {tile}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4">
        <span className="truncate text-xs text-ink-subtle">{subtitle}</span>
        <span className="truncate text-sm font-semibold text-ink">{title}</span>
      </span>

      {trailing}
    </>
  );
}
