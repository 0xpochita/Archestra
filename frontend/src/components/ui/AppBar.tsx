import Image from "next/image";
import Link from "next/link";
import {
  ARC_LOGO_SRC,
  ARCHESTRA_LOGO_SRC,
  BRAND_NAME,
  WORKFLOWS_PATH,
} from "@/constants/assets";
import { Icon } from "./Icon";

interface AppBarProps {
  trail: string[];
  brandHref: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function AppBar({
  trail,
  brandHref,
  isSidebarOpen,
  onToggleSidebar,
}: AppBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-shell px-3">
      <button
        type="button"
        aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
        aria-pressed={isSidebarOpen}
        title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
        onClick={onToggleSidebar}
        className="hidden size-9 shrink-0 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink lg:grid"
      >
        <Icon name="panel" className="size-4" />
      </button>

      <Link href={brandHref} className="flex shrink-0 items-center gap-2.5">
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
          {trail.map((crumb, index) => {
            const isLast = index === trail.length - 1;
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
