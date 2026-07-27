import Image from "next/image";
import {
  ARC_LOGO_SRC,
  ARCHESTRA_LOGO_SRC,
  BREADCRUMB_TRAIL,
} from "../constants";
import { Icon } from "./Icon";

export function AppBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-shell px-4">
      <Image
        src={ARCHESTRA_LOGO_SRC}
        alt="Archestra"
        width={32}
        height={32}
        priority
        className="size-8 shrink-0"
      />

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
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={`truncate ${isLast ? "text-ink" : "text-ink-subtle"}`}
                >
                  {crumb}
                </span>
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
