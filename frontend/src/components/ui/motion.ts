import type { Transition, Variants } from "framer-motion";

export const SMOOTH: Transition = {
  duration: 0.22,
  ease: [0.16, 1, 0.3, 1],
};

export const QUICK: Transition = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1],
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: QUICK },
  exit: { opacity: 0, transition: QUICK },
};

export const panelVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...SMOOTH, staggerChildren: 0.045, delayChildren: 0.06 },
  },
  exit: { opacity: 0, y: 8, scale: 0.99, transition: QUICK },
};

export const popoverVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...SMOOTH, staggerChildren: 0.03 },
  },
  exit: { opacity: 0, y: 6, scale: 0.99, transition: QUICK },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: SMOOTH },
  exit: { opacity: 0, transition: QUICK },
};
