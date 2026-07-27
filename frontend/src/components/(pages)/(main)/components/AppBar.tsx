import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  ARC_LOGO_SRC,
  ARCHESTRA_LOGO_SRC,
  WORKFLOWS_PATH,
} from "@/constants/assets";
import { BRAND_NAME, BREADCRUMB_TRAIL } from "../constants";

export function AppBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-shell px-4">
      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        <Image
          src={ARCHESTRA_LOGO_SRC}
          alt="Archestra"
          width={32}
          height={32}
          priority
          className="size-8"
        />
        <span className="text-sm font-semibold tracking-tight text-ink">
          {BRAND_NAME}
        </span>
      </Link>

      <span className="h-6 w-px shrink-0 bg-line" />

      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-2 text-sm">
          {BREADCRUMB_TRAIL.map((crumb, index) => {
            const isLast = index === BREADCRUMB_TRAIL.length - 1;
            return (
              <li key={crumb} className="flex min-w-0 items-center gap-2">
                {index > 0 ? (
                  <Icon
                    name="chevronDown"
                    className="size-3.5 -rotate-90 text-ink-subtle"
                  />
                ) : null}
                {isLast ? (
                  <span aria-current="page" className="truncate text-ink">
                    {crumb}
                  </span>
                ) : (
                  <Link
                    href={WORKFLOWS_PATH}
                    className="truncate text-ink-subtle transition-colors hover:text-ink"
                  >
                    {crumb}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-2 border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted">
          <Image
            src={ARC_LOGO_SRC}
            alt="Arc"
            width={16}
            height={16}
            className="size-4"
          />
          Arc Testnet
        </span>
        <span className="grid size-8 place-items-center rounded-full bg-surface-raised text-xs font-semibold text-ink-muted">
          AR
        </span>
      </div>
    </header>
  );
}
