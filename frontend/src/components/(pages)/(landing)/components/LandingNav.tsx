import Image from "next/image";
import Link from "next/link";
import { BRAND_LOGO_SRC, NAV_LINKS, WORKFLOWS_PATH } from "../constants";

export function LandingNav() {
  return (
    <header className="flex items-center gap-8 px-6 py-5 lg:px-12">
      <Link href="/" className="flex items-center gap-2.5">
        <Image
          src={BRAND_LOGO_SRC}
          alt="Archestra"
          width={32}
          height={32}
          priority
          className="size-8"
        />
        <span className="text-base font-semibold tracking-tight">
          Archestra
        </span>
      </Link>

      <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
        {NAV_LINKS.map((link) => (
          <button
            key={link.label}
            type="button"
            className="flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            {link.label}
            {link.hasMenu ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
                aria-hidden="true"
              >
                <path d="m6 9.5 6 6 6-6" />
              </svg>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-hover"
        >
          Sign in
        </button>
        <Link
          href={WORKFLOWS_PATH}
          className="bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
        >
          Open studio
        </Link>
      </div>
    </header>
  );
}
