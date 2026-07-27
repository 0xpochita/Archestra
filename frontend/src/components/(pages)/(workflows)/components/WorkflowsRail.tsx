import Image from "next/image";
import Link from "next/link";
import { ARCHESTRA_LOGO_SRC, WORKFLOWS_PATH } from "@/constants/assets";
import { RAIL_LINKS } from "../constants";

export function WorkflowsRail() {
  return (
    <nav
      aria-label="Sections"
      className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-line bg-shell py-3"
    >
      <Link
        href="/"
        aria-label="Go to the Archestra home page"
        className="mb-2"
      >
        <Image
          src={ARCHESTRA_LOGO_SRC}
          alt="Archestra"
          width={32}
          height={32}
          priority
          className="size-8"
        />
      </Link>

      {RAIL_LINKS.map((link) => {
        const RailIcon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-label={link.label}
            title={link.label}
            aria-current={link.href === WORKFLOWS_PATH ? "page" : undefined}
            className={`grid size-10 place-items-center border transition-colors ${
              link.href === WORKFLOWS_PATH
                ? "border-ink bg-ink text-on-brand"
                : "border-transparent text-ink-muted hover:border-line hover:bg-surface-raised hover:text-ink"
            }`}
          >
            <RailIcon className="size-5" />
          </Link>
        );
      })}
    </nav>
  );
}
