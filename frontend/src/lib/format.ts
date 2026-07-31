import { formatUnits, parseUnits } from "viem";

const DEFAULT_FRACTION_DIGITS = 4;

export const truncateAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

export function formatTokenAmount(
  value: bigint,
  decimals: number,
  maximumFractionDigits = DEFAULT_FRACTION_DIGITS,
) {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const groupedWhole = BigInt(whole).toLocaleString("en-US");
  const visibleFraction = fraction
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, "");

  return visibleFraction ? `${groupedWhole}.${visibleFraction}` : groupedWhole;
}

const DURATION_UNITS = [
  { name: "day", seconds: 86_400 },
  { name: "hour", seconds: 3_600 },
  { name: "minute", seconds: 60 },
] as const;

export function formatDuration(totalSeconds: number) {
  const unit = DURATION_UNITS.find(
    ({ seconds }) => totalSeconds >= seconds && totalSeconds % seconds === 0,
  );
  if (!unit) return `${totalSeconds} seconds`;

  const count = totalSeconds / unit.seconds;
  return `${count} ${unit.name}${count === 1 ? "" : "s"}`;
}

export function parseTokenAmount(input: string, decimals: number) {
  const normalized = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const [, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) return null;

  return parseUnits(normalized, decimals);
}

export function formatExpiry(expiresAt: number, nowSeconds: number) {
  if (expiresAt === 0) return "no session";

  const remaining = expiresAt - nowSeconds;
  if (remaining <= 0) return "expired";

  const days = Math.floor(remaining / 86_400);
  if (days >= 1) return `in ${days} day${days === 1 ? "" : "s"}`;

  const hours = Math.max(1, Math.floor(remaining / 3_600));
  return `in ${hours} hour${hours === 1 ? "" : "s"}`;
}
