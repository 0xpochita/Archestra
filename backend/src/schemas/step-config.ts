import { z } from "zod";

export const TOKEN_IDS = ["usdc", "weth", "aUsdc", "lpToken", "rewardToken"] as const;
export type TokenId = (typeof TOKEN_IDS)[number];

export const SPENDER_KINDS = ["deposit", "swap", "yield", "harvest", "bridge", "withdraw"] as const;

export const FEE_TIERS = [500, 3000, 10000] as const;
export const COMPARATOR_BELOW = 0;
export const COMPARATOR_ABOVE = 1;
export const MAX_BYTES32_TEXT_LENGTH = 31;

const tokenIdSchema = z.enum(TOKEN_IDS);

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 20 byte hex address");

const decimalSchema = z.string().regex(/^\d+(\.\d+)?$/, "must be a positive number");

const positiveDecimalSchema = decimalSchema.refine(
  (value) => Number(value) > 0,
  "must be greater than zero",
);

const positiveIntegerSchema = z.number().int().positive();
const nonNegativeIntegerSchema = z.number().int().nonnegative();

const bytes32TextSchema = z
  .string()
  .min(1, "is required")
  .max(MAX_BYTES32_TEXT_LENGTH, "must be 31 characters or fewer");

export const amountInputSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("max") }),
  z.object({ mode: z.literal("exact"), value: positiveDecimalSchema }),
]);

export type AmountInput = z.infer<typeof amountInputSchema>;

const triggerConfigSchema = z.object({
  kind: z.literal("trigger"),
  intervalSeconds: positiveIntegerSchema,
  startAt: nonNegativeIntegerSchema,
});

const approveConfigSchema = z.object({
  kind: z.literal("approve"),
  token: tokenIdSchema,
  spender: z.enum(SPENDER_KINDS),
  amount: amountInputSchema,
});

const depositConfigSchema = z.object({
  kind: z.literal("deposit"),
  asset: tokenIdSchema,
  amount: amountInputSchema,
});

const swapConfigSchema = z.object({
  kind: z.literal("swap"),
  tokenIn: tokenIdSchema,
  tokenOut: tokenIdSchema,
  amountIn: amountInputSchema,
  minAmountOut: positiveDecimalSchema,
  feeTier: z.union([z.literal(500), z.literal(3000), z.literal(10000)]),
  deadlineDays: positiveIntegerSchema,
});

const yieldConfigSchema = z.object({
  kind: z.literal("yield"),
  amount: amountInputSchema,
  minLpOut: positiveDecimalSchema,
});

const harvestConfigSchema = z.object({
  kind: z.literal("harvest"),
  minValueOut: positiveDecimalSchema,
});

const bridgeConfigSchema = z.object({
  kind: z.literal("bridge"),
  destinationChainSelector: z.string().regex(/^\d+$/, "must be a number"),
  receiver: addressSchema,
  token: tokenIdSchema,
  amount: amountInputSchema,
});

const withdrawConfigSchema = z.object({
  kind: z.literal("withdraw"),
  asset: tokenIdSchema,
  amount: amountInputSchema,
});

const conditionConfigSchema = z.object({
  kind: z.literal("condition"),
  feed: addressSchema,
  bound: positiveDecimalSchema,
  comparator: z.union([z.literal(COMPARATOR_BELOW), z.literal(COMPARATOR_ABOVE)]),
  maxStaleSeconds: positiveIntegerSchema,
});

const alertConfigSchema = z.object({
  kind: z.literal("alert"),
  channel: bytes32TextSchema,
  messageId: bytes32TextSchema,
});

export const stepConfigSchema = z.discriminatedUnion("kind", [
  triggerConfigSchema,
  approveConfigSchema,
  depositConfigSchema,
  swapConfigSchema,
  yieldConfigSchema,
  harvestConfigSchema,
  bridgeConfigSchema,
  withdrawConfigSchema,
  conditionConfigSchema,
  alertConfigSchema,
]);

export type StepConfig = z.infer<typeof stepConfigSchema>;
export type StepConfigOf<Kind extends StepConfig["kind"]> = Extract<StepConfig, { kind: Kind }>;
export type SpenderKind = (typeof SPENDER_KINDS)[number];
export type FeeTier = (typeof FEE_TIERS)[number];
