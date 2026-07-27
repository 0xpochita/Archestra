import type { IconName } from "../types";

const ICON_PATHS: Record<IconName, string[]> = {
  bolt: ["M13 2 4 14h6l-1 8 9-12h-6l1-8Z"],
  deposit: ["M12 3v10", "m7.5 9.5 4.5 4.5 4.5-4.5", "M4 17v3h16v-3"],
  swap: ["M7 5 3 9l4 4", "M3 9h13", "m17 19 4-4-4-4", "M21 15H8"],
  yield: [
    "M12 21v-8",
    "M12 13c0-3.3-2.7-6-6-6H4c0 3.3 2.7 6 6 6h2Z",
    "M12 13c0-3.9 3.1-7 7-7h1c0 3.9-3.1 7-7 7h-1Z",
  ],
  harvest: [
    "M4 11h16v9H4z",
    "M3 7h18v4H3z",
    "M12 7v13",
    "M12 7S10 3 8 4s0 3 4 3",
    "M12 7s2-4 4-3 0 3-4 3",
  ],
  bridge: [
    "M9.5 14.5 14.5 9.5",
    "M11 6.5 12.6 4.9a4.2 4.2 0 0 1 5.9 5.9L16.9 12.4",
    "M13 17.5l-1.6 1.6a4.2 4.2 0 0 1-5.9-5.9L7.1 11.6",
  ],
  withdraw: ["M12 21V11", "m7.5 14.5 4.5-4.5 4.5 4.5", "M4 7V4h16v3"],
  approve: [
    "M12 3 5 6v6c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6l-7-3Z",
    "m9 12 2 2 4-4",
  ],
  condition: [
    "M7 4v9",
    "M7 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M17 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M17 8v2a4 4 0 0 1-4 4H7",
  ],
  alert: [
    "M18 9a6 6 0 0 0-12 0c0 6-3 8-3 8h18s-3-2-3-8",
    "M13.7 20a2 2 0 0 1-3.4 0",
  ],
  play: ["M8 5.5v13l10.5-6.5Z"],
  dots: ["M5.5 12h.01", "M12 12h.01", "M18.5 12h.01"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  target: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    "M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
    "M12 1.5v3",
    "M12 19.5v3",
    "M1.5 12h3",
    "M19.5 12h3",
  ],
  fit: [
    "M9 3H5a2 2 0 0 0-2 2v4",
    "M15 3h4a2 2 0 0 1 2 2v4",
    "M9 21H5a2 2 0 0 1-2-2v-4",
    "M15 21h4a2 2 0 0 0 2-2v-4",
  ],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  unlock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 7.5-2"],
  undo: ["M4 9h11a5 5 0 0 1 0 10h-5", "m4 9 4-4", "m4 9 4 4"],
  redo: ["M20 9H9a5 5 0 0 0 0 10h5", "m20 9-4-4", "m20 9-4 4"],
  panel: ["M3.5 4.5h17v15h-17z", "M10 4.5v15"],
  chevronDown: ["m6 9.5 6 6 6-6"],
  pencil: ["M4.5 19.5H8L19 8.5 15.5 5 4.5 16z"],
  clock: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", "M12 7.5V12l3 2"],
  sparkle: [
    "M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9 12 3.5Z",
    "M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z",
  ],
  arrowUp: ["M12 20V5", "m6 11 6-6 6 6"],
  trash: [
    "M4 7h16",
    "M9.5 7V4.5h5V7",
    "m6.5 7 1 13h9l1-13",
    "M10.5 11v6",
    "M13.5 11v6",
  ],
  close: ["m6 6 12 12", "m18 6-12 12"],
  grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  addBlocks: [
    "M6 6m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0",
    "M18 6m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0",
    "M6 18m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0",
    "M18 14.5v7",
    "M14.5 18h7",
  ],
  check: ["m5 13 4.5 4.5L19 8"],
  loader: ["M12 3a9 9 0 1 0 9 9"],
  search: ["M18.5 11a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z", "m21 21-4.4-4.4"],
};

interface IconProps {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name].map((definition) => (
        <path key={definition} d={definition} />
      ))}
    </svg>
  );
}
