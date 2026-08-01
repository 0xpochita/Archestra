import {
  type Address,
  type Hex,
  encodeAbiParameters,
  getAddress,
  maxUint256,
  parseAbiParameters,
  parseUnits,
  stringToHex,
  zeroAddress,
} from "viem";
import type { BlockKind } from "../schemas/common.js";
import {
  type AmountInput,
  type StepConfig,
  type TokenId,
  stepConfigSchema,
} from "../schemas/step-config.js";
import { ARC_TESTNET_DEPLOYMENT } from "./generated/index.js";
import { STEP_TYPE } from "./step-types.js";

export const MAX_STEPS = 16;
export const FEED_DECIMALS = 8;

const { adapters, core, tokens } = ARC_TESTNET_DEPLOYMENT;

function req(map: Record<string, string>, key: string): string {
  const v = map[key];
  if (!v) throw new Error(`missing deployment key: ${key}`);
  return v;
}

export const STEP_ADAPTER: Record<BlockKind, Address> = {
  trigger: getAddress(core.automationTrigger),
  approve: getAddress(core.executor),
  deposit: getAddress(req(adapters, "supply")),
  swap: getAddress(req(adapters, "swap")),
  yield: getAddress(req(adapters, "stake")),
  harvest: getAddress(req(adapters, "claim")),
  bridge: getAddress(req(adapters, "bridge")),
  withdraw: getAddress(req(adapters, "redeem")),
  condition: getAddress(core.guardModule),
  alert: getAddress(core.executor),
};

const CURVE_POOL_ADDRESS = getAddress(req(adapters, "curvePool"));
const CURVE_GAUGE_ADDRESS = getAddress(req(adapters, "gauge"));

interface TokenInfo {
  address: Address;
  decimals: number;
}

export const TOKENS: Record<TokenId, TokenInfo> = {
  usdc: { address: getAddress(req(tokens, "usdc")), decimals: 6 },
  weth: { address: getAddress(req(tokens, "weth")), decimals: 18 },
  aUsdc: { address: getAddress(req(tokens, "aUsdc")), decimals: 6 },
  lpToken: { address: getAddress(req(tokens, "lpToken")), decimals: 18 },
  rewardToken: { address: getAddress(req(tokens, "rewardToken")), decimals: 18 },
};

export interface EncodedStep {
  stepType: number;
  adapter: Address;
  params: Hex;
}

export interface EncodeContext {
  nowSeconds: number;
}

export interface StepProblem {
  nodeId: string;
  message: string;
}

export interface EncodeInput {
  id: string;
  kind: BlockKind;
  config: StepConfig;
}

export type EncodeResult =
  | { ok: true; steps: EncodedStep[] }
  | { ok: false; problems: StepProblem[] };

const resolveAmount = (amount: AmountInput, tokenId: TokenId) =>
  amount.mode === "max" ? maxUint256 : parseUnits(amount.value, TOKENS[tokenId].decimals);

function encodeParams(config: StepConfig, context: EncodeContext): Hex {
  const kind = config.kind;
  switch (kind) {
    case "trigger":
      return encodeAbiParameters(parseAbiParameters("uint64, uint64"), [
        BigInt(config.intervalSeconds),
        BigInt(config.startAt),
      ]);
    case "approve":
      return encodeAbiParameters(parseAbiParameters("address, address, uint256"), [
        TOKENS[config.token].address,
        STEP_ADAPTER[config.spender],
        resolveAmount(config.amount, config.token),
      ]);
    case "deposit":
      return encodeAbiParameters(parseAbiParameters("address, uint256"), [
        TOKENS[config.asset].address,
        resolveAmount(config.amount, config.asset),
      ]);
    case "swap":
      return encodeAbiParameters(
        parseAbiParameters("address, address, uint256, uint256, uint24, uint64"),
        [
          TOKENS[config.tokenIn].address,
          TOKENS[config.tokenOut].address,
          resolveAmount(config.amountIn, config.tokenIn),
          parseUnits(config.minAmountOut, TOKENS[config.tokenOut].decimals),
          config.feeTier,
          BigInt(context.nowSeconds + config.deadlineDays * 86_400),
        ],
      );
    case "yield":
      return encodeAbiParameters(parseAbiParameters("address, address, uint256, uint256"), [
        CURVE_POOL_ADDRESS,
        CURVE_GAUGE_ADDRESS,
        resolveAmount(config.amount, "usdc"),
        parseUnits(config.minLpOut, TOKENS.lpToken.decimals),
      ]);
    case "harvest":
      return encodeAbiParameters(parseAbiParameters("address, uint256"), [
        CURVE_GAUGE_ADDRESS,
        parseUnits(config.minValueOut, TOKENS.rewardToken.decimals),
      ]);
    case "bridge":
      return encodeAbiParameters(parseAbiParameters("uint64, address, address, uint256"), [
        BigInt(config.destinationChainSelector),
        getAddress(config.receiver),
        TOKENS[config.token].address,
        resolveAmount(config.amount, config.token),
      ]);
    case "withdraw":
      return encodeAbiParameters(parseAbiParameters("address, uint256"), [
        TOKENS[config.asset].address,
        resolveAmount(config.amount, config.asset),
      ]);
    case "condition":
      return encodeAbiParameters(parseAbiParameters("address, int256, uint8, uint64"), [
        getAddress(config.feed),
        parseUnits(config.bound, FEED_DECIMALS),
        config.comparator,
        BigInt(config.maxStaleSeconds),
      ]);
    case "alert":
      return encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [
        stringToHex(config.channel, { size: 32 }),
        stringToHex(config.messageId, { size: 32 }),
      ]);
    default: {
      const _exhaustive: never = kind;
      throw new Error(`unknown step kind: ${String(_exhaustive)}`);
    }
  }
}

export function encodeStep(config: StepConfig, context: EncodeContext): EncodedStep {
  return {
    stepType: STEP_TYPE[config.kind],
    adapter: STEP_ADAPTER[config.kind],
    params: encodeParams(config, context),
  };
}

function collectConfigProblems(step: EncodeInput): StepProblem[] {
  const parsed = stepConfigSchema.safeParse(step.config);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      nodeId: step.id,
      message: `${issue.path.join(".") || "config"} ${issue.message}`,
    }));
  }
  if (step.config.kind === "swap" && step.config.tokenIn === step.config.tokenOut) {
    return [{ nodeId: step.id, message: "swap tokenIn and tokenOut must differ" }];
  }
  if (step.config.kind === "condition" && step.config.feed === zeroAddress) {
    return [
      {
        nodeId: step.id,
        message: "needs a price feed address, and Arc testnet has none deployed yet",
      },
    ];
  }
  if (step.config.kind === "bridge" && step.config.receiver === zeroAddress) {
    return [{ nodeId: step.id, message: "needs a receiver address" }];
  }
  return [];
}

export function collectStepProblems(steps: EncodeInput[]): StepProblem[] {
  return steps.flatMap(collectConfigProblems);
}

export function encodeWorkflow(steps: EncodeInput[], context: EncodeContext): EncodeResult {
  const problems = collectStepProblems(steps);
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    steps: steps.map((step) => encodeStep(step.config, context)),
  };
}
