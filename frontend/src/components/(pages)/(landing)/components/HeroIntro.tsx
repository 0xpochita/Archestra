"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { HERO_HEADLINE, HERO_SUPPORT, WORKFLOWS_PATH } from "../constants";

const RISE = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export function HeroIntro() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.12, delayChildren: 0.5 }}
      className="max-w-3xl"
    >
      <motion.h1
        variants={RISE}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="font-apple text-5xl leading-[1.05] font-semibold tracking-[-0.03em] text-ink lg:text-7xl"
      >
        {HERO_HEADLINE}
      </motion.h1>

      <motion.p
        variants={RISE}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted"
      >
        {HERO_SUPPORT}
      </motion.p>

      <motion.div
        variants={RISE}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 flex flex-wrap gap-3"
      >
        <button
          type="button"
          className="border border-line px-6 py-3 text-sm text-ink transition-colors hover:bg-surface-hover"
        >
          Talk to us
        </button>
        <Link
          href={WORKFLOWS_PATH}
          className="bg-brand px-6 py-3 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
        >
          Open studio
        </Link>
      </motion.div>
    </motion.div>
  );
}
