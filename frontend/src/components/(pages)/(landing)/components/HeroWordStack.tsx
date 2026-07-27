"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { HERO_WORDS } from "../constants";

const ITEM_HEIGHT = 76;
const CURVE_DEPTH = 52;
const TILT_DEGREES = 4;
const MAX_BLUR = 9;
const STEP_MS = 1800;
const WINDOW = [-3, -2, -1, 0, 1, 2, 3];

function slotStyle(offset: number) {
  const distance = Math.abs(offset);

  return {
    y: offset * ITEM_HEIGHT - ITEM_HEIGHT / 2,
    x: CURVE_DEPTH * (1 - Math.cos(offset * 0.42)),
    rotate: offset * TILT_DEGREES,
    opacity: Math.max(1 - distance * 0.26, 0),
    filter: `blur(${Math.min(distance * 2.6, MAX_BLUR)}px)`,
    scale: 1 - Math.min(distance * 0.05, 0.2),
  };
}

export function HeroWordStack() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setStep((current) => current + 1),
      STEP_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="relative h-[380px] w-full overflow-hidden bg-surface lg:max-w-[420px] lg:justify-self-end"
    >
      <AnimatePresence initial={false}>
        {WINDOW.map((offset) => {
          const index = step + offset;
          const word =
            HERO_WORDS[
              ((index % HERO_WORDS.length) + HERO_WORDS.length) %
                HERO_WORDS.length
            ];

          return (
            <motion.span
              key={index}
              className="font-apple absolute top-1/2 left-6 flex origin-left items-center gap-3 text-4xl font-medium tracking-tight text-ink lg:text-5xl"
              initial={slotStyle(offset + 1)}
              animate={slotStyle(offset)}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <Logo name={word.logo} className="size-8 shrink-0 lg:size-9" />
              {word.label}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
