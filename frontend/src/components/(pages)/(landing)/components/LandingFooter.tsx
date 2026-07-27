import Image from "next/image";
import Link from "next/link";
import {
  BRAND_LOGO_SRC,
  FOOTER_COPYRIGHT,
  FOOTER_GROUPS,
  FOOTER_NOTE,
  FOOTER_TAGLINE,
  STUDIO_PATH,
} from "../constants";

export function LandingFooter() {
  return (
    <footer className="border-t border-line px-6 py-12 lg:px-12">
      <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <Image
              src={BRAND_LOGO_SRC}
              alt="Archestra"
              width={28}
              height={28}
              className="size-7"
            />
            <span className="text-sm font-semibold tracking-tight">
              Archestra
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            {FOOTER_TAGLINE}
          </p>
          <Link
            href={STUDIO_PATH}
            className="mt-6 inline-block border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-hover"
          >
            Open studio
          </Link>
        </div>

        <div className="grid gap-10 sm:grid-cols-3 lg:gap-16">
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="text-xs font-semibold tracking-[0.14em] text-ink-subtle uppercase">
                {group.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link}>
                    <button
                      type="button"
                      className="text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
        <span>{FOOTER_COPYRIGHT}</span>
        <span>{FOOTER_NOTE}</span>
      </div>
    </footer>
  );
}
