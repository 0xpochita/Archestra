"use client";

import {
  FieldShell,
  NumberField,
  SelectField,
  type SelectOption,
  TextField,
} from "@/components/ui/Field";
import { BLOCK_CATALOG } from "@/constants/blocks";
import { TOKEN_IDS, TOKENS, type TokenId } from "@/lib/chain/tokens";
import {
  type AmountInput,
  COMPARATOR_ABOVE,
  COMPARATOR_BELOW,
  FEE_TIERS,
  SPENDER_KINDS,
  type StepConfig,
  type StepConfigOf,
  stepConfigSchema,
} from "@/lib/schemas/step-config";

type FieldErrors = Record<string, string>;

type ConfigSetter<Kind extends StepConfig["kind"]> = (
  patch: Partial<StepConfigOf<Kind>>,
) => void;

interface FieldsProps<Kind extends StepConfig["kind"]> {
  idPrefix: string;
  config: StepConfigOf<Kind>;
  errors: FieldErrors;
  onPatch: ConfigSetter<Kind>;
}

const TOKEN_OPTIONS: SelectOption<TokenId>[] = TOKEN_IDS.map((id) => ({
  value: id,
  label: `${TOKENS[id].symbol} (${TOKENS[id].name})`,
}));

const SPENDER_OPTIONS: SelectOption<(typeof SPENDER_KINDS)[number]>[] =
  SPENDER_KINDS.map((kind) => ({
    value: kind,
    label: BLOCK_CATALOG[kind].label,
  }));

const FEE_OPTIONS: SelectOption<string>[] = FEE_TIERS.map((tier) => ({
  value: String(tier),
  label: `${tier / 10_000}%`,
}));

const COMPARATOR_OPTIONS: SelectOption<string>[] = [
  { value: String(COMPARATOR_BELOW), label: "Stop when the price is below" },
  { value: String(COMPARATOR_ABOVE), label: "Stop when the price is above" },
];

export function collectFieldErrors(config: StepConfig): FieldErrors {
  const parsed = stepConfigSchema.safeParse(config);
  if (parsed.success) return {};

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.at(0);
    if (field === undefined) continue;
    const key = String(field);
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function AmountField({
  id,
  label,
  amount,
  tokenId,
  error,
  onChange,
}: {
  id: string;
  label: string;
  amount: AmountInput;
  tokenId: TokenId;
  error?: string;
  onChange: (amount: AmountInput) => void;
}) {
  const isMax = amount.mode === "max";

  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={
        isMax
          ? "Resolved to the vault's whole balance when the step runs."
          : undefined
      }
    >
      <div className="flex gap-2">
        <input
          id={id}
          value={isMax ? "" : amount.value}
          disabled={isMax}
          placeholder={isMax ? "Whole balance" : "0.00"}
          onChange={(event) =>
            onChange({ mode: "exact", value: event.target.value })
          }
          className="h-9 min-w-0 flex-1 border border-line bg-surface-raised px-2.5 text-sm text-ink outline-none transition-colors focus:border-brand disabled:text-ink-subtle"
        />
        <button
          type="button"
          aria-pressed={isMax}
          onClick={() =>
            onChange(isMax ? { mode: "exact", value: "0" } : { mode: "max" })
          }
          className={`h-9 shrink-0 border px-3 text-xs font-medium transition-colors ${
            isMax
              ? "border-ink bg-brand text-on-brand"
              : "border-line text-ink hover:bg-surface-hover"
          }`}
        >
          Max
        </button>
      </div>
      <span className="text-[11px] text-ink-subtle">
        {TOKENS[tokenId].symbol}
      </span>
    </FieldShell>
  );
}

function TriggerFields({
  idPrefix,
  config,
  errors,
  onPatch,
}: FieldsProps<"trigger">) {
  return (
    <>
      <NumberField
        id={`${idPrefix}-interval`}
        label="Interval in seconds"
        min={1}
        value={config.intervalSeconds}
        error={errors.intervalSeconds}
        hint="86400 runs the strategy once a day."
        onChange={(intervalSeconds) => onPatch({ intervalSeconds })}
      />
      <NumberField
        id={`${idPrefix}-start`}
        label="Start at (unix seconds)"
        value={config.startAt}
        error={errors.startAt}
        hint="Zero starts with the first manual run."
        onChange={(startAt) => onPatch({ startAt })}
      />
    </>
  );
}

function ApproveFields({
  idPrefix,
  config,
  errors,
  onPatch,
}: FieldsProps<"approve">) {
  return (
    <>
      <SelectField
        id={`${idPrefix}-token`}
        label="Token"
        value={config.token}
        options={TOKEN_OPTIONS}
        error={errors.token}
        onChange={(token) => onPatch({ token })}
      />
      <SelectField
        id={`${idPrefix}-spender`}
        label="Spender"
        value={config.spender}
        options={SPENDER_OPTIONS}
        error={errors.spender}
        hint="The adapter that pulls the token during this run."
        onChange={(spender) => onPatch({ spender })}
      />
      <AmountField
        id={`${idPrefix}-amount`}
        label="Amount"
        amount={config.amount}
        tokenId={config.token}
        error={errors.amount}
        onChange={(amount) => onPatch({ amount })}
      />
    </>
  );
}

interface AssetAmountFieldsProps {
  idPrefix: string;
  errors: FieldErrors;
  config: { asset: TokenId; amount: AmountInput };
  onPatch: (patch: { asset?: TokenId; amount?: AmountInput }) => void;
}

function AssetAmountFields({
  idPrefix,
  config,
  errors,
  onPatch,
}: AssetAmountFieldsProps) {
  return (
    <>
      <SelectField
        id={`${idPrefix}-asset`}
        label="Asset"
        value={config.asset}
        options={TOKEN_OPTIONS}
        error={errors.asset}
        onChange={(asset) => onPatch({ asset })}
      />
      <AmountField
        id={`${idPrefix}-amount`}
        label="Amount"
        amount={config.amount}
        tokenId={config.asset}
        error={errors.amount}
        onChange={(amount) => onPatch({ amount })}
      />
    </>
  );
}

function SwapFields({
  idPrefix,
  config,
  errors,
  onPatch,
}: FieldsProps<"swap">) {
  return (
    <>
      <SelectField
        id={`${idPrefix}-token-in`}
        label="From"
        value={config.tokenIn}
        options={TOKEN_OPTIONS}
        error={errors.tokenIn}
        onChange={(tokenIn) => onPatch({ tokenIn })}
      />
      <SelectField
        id={`${idPrefix}-token-out`}
        label="To"
        value={config.tokenOut}
        options={TOKEN_OPTIONS}
        error={errors.tokenOut}
        onChange={(tokenOut) => onPatch({ tokenOut })}
      />
      <AmountField
        id={`${idPrefix}-amount-in`}
        label="Amount in"
        amount={config.amountIn}
        tokenId={config.tokenIn}
        error={errors.amountIn}
        onChange={(amountIn) => onPatch({ amountIn })}
      />
      <TextField
        id={`${idPrefix}-min-out`}
        label={`Minimum out in ${TOKENS[config.tokenOut].symbol}`}
        value={config.minAmountOut}
        error={errors.minAmountOut}
        hint="Zero is rejected on chain: it means no slippage protection."
        onChange={(minAmountOut) => onPatch({ minAmountOut })}
      />
      <SelectField
        id={`${idPrefix}-fee`}
        label="Fee tier"
        value={String(config.feeTier)}
        options={FEE_OPTIONS}
        error={errors.feeTier}
        onChange={(feeTier) => onPatch({ feeTier: toFeeTier(feeTier) })}
      />
      <NumberField
        id={`${idPrefix}-deadline`}
        label="Deadline in days"
        min={1}
        value={config.deadlineDays}
        error={errors.deadlineDays}
        hint="Stored on chain when the workflow is created. A scheduled run after it fails with DeadlinePassed."
        onChange={(deadlineDays) => onPatch({ deadlineDays })}
      />
    </>
  );
}

function toFeeTier(value: string) {
  const parsed = Number(value);
  return FEE_TIERS.find((tier) => tier === parsed) ?? FEE_TIERS[1];
}

function YieldFields({
  idPrefix,
  config,
  errors,
  onPatch,
}: FieldsProps<"yield">) {
  return (
    <>
      <AmountField
        id={`${idPrefix}-amount`}
        label="Amount"
        amount={config.amount}
        tokenId="usdc"
        error={errors.amount}
        onChange={(amount) => onPatch({ amount })}
      />
      <TextField
        id={`${idPrefix}-min-lp`}
        label="Minimum LP out"
        value={config.minLpOut}
        error={errors.minLpOut}
        hint="The pool and gauge come from the Arc testnet deployment."
        onChange={(minLpOut) => onPatch({ minLpOut })}
      />
    </>
  );
}

function HarvestFields({
  idPrefix,
  config,
  errors,
  onPatch,
}: FieldsProps<"harvest">) {
  return (
    <TextField
      id={`${idPrefix}-min-value`}
      label={`Minimum claim in ${TOKENS.rewardToken.symbol}`}
      value={config.minValueOut}
      error={errors.minValueOut}
      hint="Claiming with nothing accrued reverts, so keep this above zero."
      onChange={(minValueOut) => onPatch({ minValueOut })}
    />
  );
}

function BridgeFields({
  idPrefix,
  config,
  errors,
  onPatch,
}: FieldsProps<"bridge">) {
  return (
    <>
      <SelectField
        id={`${idPrefix}-token`}
        label="Token"
        value={config.token}
        options={TOKEN_OPTIONS}
        error={errors.token}
        onChange={(token) => onPatch({ token })}
      />
      <AmountField
        id={`${idPrefix}-amount`}
        label="Amount"
        amount={config.amount}
        tokenId={config.token}
        error={errors.amount}
        onChange={(amount) => onPatch({ amount })}
      />
      <TextField
        id={`${idPrefix}-selector`}
        label="Destination chain selector"
        value={config.destinationChainSelector}
        error={errors.destinationChainSelector}
        isMono
        onChange={(destinationChainSelector) =>
          onPatch({ destinationChainSelector })
        }
      />
      <TextField
        id={`${idPrefix}-receiver`}
        label="Receiver"
        value={config.receiver}
        error={errors.receiver}
        isMono
        hint="The address that receives the tokens on the destination chain."
        onChange={(receiver) => onPatch({ receiver })}
      />
    </>
  );
}

function ConditionFields({
  idPrefix,
  config,
  errors,
  onPatch,
}: FieldsProps<"condition">) {
  return (
    <>
      <TextField
        id={`${idPrefix}-feed`}
        label="Price feed"
        value={config.feed}
        error={errors.feed}
        isMono
        hint="Arc testnet has no price feed deployed yet, so this step cannot run there."
        onChange={(feed) => onPatch({ feed })}
      />
      <SelectField
        id={`${idPrefix}-comparator`}
        label="Rule"
        value={String(config.comparator)}
        options={COMPARATOR_OPTIONS}
        error={errors.comparator}
        onChange={(comparator) =>
          onPatch({
            comparator:
              Number(comparator) === COMPARATOR_ABOVE
                ? COMPARATOR_ABOVE
                : COMPARATOR_BELOW,
          })
        }
      />
      <TextField
        id={`${idPrefix}-bound`}
        label="Bound"
        value={config.bound}
        error={errors.bound}
        hint="Read in feed units. A failing bound ends the run early and is not an error."
        onChange={(bound) => onPatch({ bound })}
      />
      <NumberField
        id={`${idPrefix}-stale`}
        label="Max feed age in seconds"
        min={1}
        value={config.maxStaleSeconds}
        error={errors.maxStaleSeconds}
        onChange={(maxStaleSeconds) => onPatch({ maxStaleSeconds })}
      />
    </>
  );
}

function AlertFields({
  idPrefix,
  config,
  errors,
  onPatch,
}: FieldsProps<"alert">) {
  return (
    <>
      <TextField
        id={`${idPrefix}-channel`}
        label="Channel"
        value={config.channel}
        error={errors.channel}
        hint="Emitted on chain as bytes32, so 31 characters at most."
        onChange={(channel) => onPatch({ channel })}
      />
      <TextField
        id={`${idPrefix}-message`}
        label="Message id"
        value={config.messageId}
        error={errors.messageId}
        onChange={(messageId) => onPatch({ messageId })}
      />
    </>
  );
}

interface StepConfigFieldsProps {
  idPrefix: string;
  config: StepConfig;
  onChange: (config: StepConfig) => void;
}

export function StepConfigFields({
  idPrefix,
  config,
  onChange,
}: StepConfigFieldsProps) {
  const errors = collectFieldErrors(config);

  switch (config.kind) {
    case "trigger":
      return (
        <TriggerFields
          idPrefix={idPrefix}
          config={config}
          errors={errors}
          onPatch={(patch) => onChange({ ...config, ...patch })}
        />
      );
    case "approve":
      return (
        <ApproveFields
          idPrefix={idPrefix}
          config={config}
          errors={errors}
          onPatch={(patch) => onChange({ ...config, ...patch })}
        />
      );
    case "deposit":
    case "withdraw":
      return (
        <AssetAmountFields
          idPrefix={idPrefix}
          config={config}
          errors={errors}
          onPatch={(patch) => onChange({ ...config, ...patch })}
        />
      );
    case "swap":
      return (
        <SwapFields
          idPrefix={idPrefix}
          config={config}
          errors={errors}
          onPatch={(patch) => onChange({ ...config, ...patch })}
        />
      );
    case "yield":
      return (
        <YieldFields
          idPrefix={idPrefix}
          config={config}
          errors={errors}
          onPatch={(patch) => onChange({ ...config, ...patch })}
        />
      );
    case "harvest":
      return (
        <HarvestFields
          idPrefix={idPrefix}
          config={config}
          errors={errors}
          onPatch={(patch) => onChange({ ...config, ...patch })}
        />
      );
    case "bridge":
      return (
        <BridgeFields
          idPrefix={idPrefix}
          config={config}
          errors={errors}
          onPatch={(patch) => onChange({ ...config, ...patch })}
        />
      );
    case "condition":
      return (
        <ConditionFields
          idPrefix={idPrefix}
          config={config}
          errors={errors}
          onPatch={(patch) => onChange({ ...config, ...patch })}
        />
      );
    case "alert":
      return (
        <AlertFields
          idPrefix={idPrefix}
          config={config}
          errors={errors}
          onPatch={(patch) => onChange({ ...config, ...patch })}
        />
      );
  }
}
