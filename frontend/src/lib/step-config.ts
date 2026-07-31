import { zeroAddress } from "viem";
import { TOKENS, type TokenId } from "@/lib/chain/tokens";
import {
  type AmountInput,
  COMPARATOR_BELOW,
  type StepConfig,
} from "@/lib/schemas/step-config";
import type { BlockKind, BlockParam } from "@/types/block";
import { formatDuration, truncateAddress } from "./format";

const DAY_IN_SECONDS = 86_400;
const DEFAULT_DEADLINE_DAYS = 30;
const DEFAULT_STALE_SECONDS = 3_600;
const CCIP_SEPOLIA_SELECTOR = "16015286601757825753";

const DEFAULT_CONFIGS: Record<BlockKind, StepConfig> = {
  trigger: { kind: "trigger", intervalSeconds: DAY_IN_SECONDS, startAt: 0 },
  approve: {
    kind: "approve",
    token: "usdc",
    spender: "deposit",
    amount: { mode: "max" },
  },
  deposit: {
    kind: "deposit",
    asset: "usdc",
    amount: { mode: "exact", value: "100" },
  },
  swap: {
    kind: "swap",
    tokenIn: "usdc",
    tokenOut: "weth",
    amountIn: { mode: "exact", value: "100" },
    minAmountOut: "0.02",
    feeTier: 3000,
    deadlineDays: DEFAULT_DEADLINE_DAYS,
  },
  yield: { kind: "yield", amount: { mode: "max" }, minLpOut: "1" },
  harvest: { kind: "harvest", minValueOut: "1" },
  bridge: {
    kind: "bridge",
    destinationChainSelector: CCIP_SEPOLIA_SELECTOR,
    receiver: zeroAddress,
    token: "usdc",
    amount: { mode: "exact", value: "100" },
  },
  withdraw: {
    kind: "withdraw",
    asset: "aUsdc",
    amount: { mode: "max" },
  },
  condition: {
    kind: "condition",
    feed: zeroAddress,
    bound: "2000",
    comparator: COMPARATOR_BELOW,
    maxStaleSeconds: DEFAULT_STALE_SECONDS,
  },
  alert: { kind: "alert", channel: "defi-ops", messageId: "run-report" },
};

export const createDefaultStepConfig = (kind: BlockKind): StepConfig => ({
  ...DEFAULT_CONFIGS[kind],
});

const describeAmount = (amount: AmountInput, tokenId: TokenId) =>
  amount.mode === "max"
    ? `Whole ${TOKENS[tokenId].symbol} balance`
    : `${amount.value} ${TOKENS[tokenId].symbol}`;

const row = (id: string, label: string, value: string): BlockParam => ({
  id,
  label,
  value,
});

export function describeStepConfig(config: StepConfig): BlockParam[] {
  switch (config.kind) {
    case "trigger":
      return [
        row("interval", "Every", formatDuration(config.intervalSeconds)),
        row(
          "start",
          "Starts",
          config.startAt === 0 ? "On the first run" : `At ${config.startAt}`,
        ),
      ];
    case "approve":
      return [
        row("token", "Token", TOKENS[config.token].symbol),
        row("spender", "Spender", config.spender),
        row("amount", "Amount", describeAmount(config.amount, config.token)),
      ];
    case "deposit":
      return [
        row("asset", "Asset", TOKENS[config.asset].symbol),
        row("amount", "Amount", describeAmount(config.amount, config.asset)),
      ];
    case "swap":
      return [
        row("from", "From", TOKENS[config.tokenIn].symbol),
        row("to", "To", TOKENS[config.tokenOut].symbol),
        row(
          "amount",
          "Amount",
          describeAmount(config.amountIn, config.tokenIn),
        ),
        row(
          "min-out",
          "Minimum out",
          `${config.minAmountOut} ${TOKENS[config.tokenOut].symbol}`,
        ),
        row("fee", "Fee tier", `${config.feeTier / 10_000}%`),
        row("deadline", "Deadline", `${config.deadlineDays} days after create`),
      ];
    case "yield":
      return [
        row("amount", "Amount", describeAmount(config.amount, "usdc")),
        row("min-lp", "Minimum LP out", config.minLpOut),
      ];
    case "harvest":
      return [
        row(
          "min-value",
          "Minimum claim",
          `${config.minValueOut} ${TOKENS.rewardToken.symbol}`,
        ),
      ];
    case "bridge":
      return [
        row("token", "Token", TOKENS[config.token].symbol),
        row("amount", "Amount", describeAmount(config.amount, config.token)),
        row("destination", "Destination", config.destinationChainSelector),
        row("receiver", "Receiver", truncateAddress(config.receiver)),
      ];
    case "withdraw":
      return [
        row("asset", "Asset", TOKENS[config.asset].symbol),
        row("amount", "Amount", describeAmount(config.amount, config.asset)),
      ];
    case "condition":
      return [
        row(
          "feed",
          "Price feed",
          config.feed === zeroAddress
            ? "Not set"
            : truncateAddress(config.feed),
        ),
        row(
          "rule",
          "Stops the run",
          `${config.comparator === COMPARATOR_BELOW ? "below" : "above"} ${config.bound}`,
        ),
        row("stale", "Max feed age", formatDuration(config.maxStaleSeconds)),
      ];
    case "alert":
      return [
        row("channel", "Channel", config.channel),
        row("message", "Message id", config.messageId),
      ];
  }
}

export function getStrategyTokens(configs: StepConfig[]): TokenId[] {
  const spent = new Set<TokenId>();

  for (const config of configs) {
    switch (config.kind) {
      case "approve":
      case "bridge":
        spent.add(config.token);
        break;
      case "deposit":
      case "withdraw":
        spent.add(config.asset);
        break;
      case "swap":
        spent.add(config.tokenIn);
        break;
      case "yield":
        spent.add("usdc");
        break;
      default:
        break;
    }
  }

  return [...spent];
}
