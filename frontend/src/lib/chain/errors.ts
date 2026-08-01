import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
} from "viem";
import {
  demoTokenAbi,
  executorAbi,
  strategyVaultAbi,
  vaultFactoryAbi,
  workflowRegistryAbi,
} from "./generated";

export type ChainErrorAction =
  | "open_session"
  | "fund_vault"
  | "raise_cap"
  | "accept_executor"
  | "check_wallet"
  | "wait"
  | "fix_graph"
  | "report"
  | "loosen_slippage"
  | "refresh_deadline"
  | "none";

export interface ChainError {
  code: string;
  title: string;
  detail: string;
  action: ChainErrorAction;
}

interface ErrorTemplate {
  code: string;
  title: string;
  detail: (args: readonly unknown[]) => string;
  action: ChainErrorAction;
}

const plain = (value: unknown) => String(value ?? "");

const TEMPLATES: Record<string, ErrorTemplate> = {
  NoActiveSession: {
    code: "session_required",
    title: "No spending session",
    detail: () =>
      "This vault has no active session for a token the run spends. Nothing moved.",
    action: "open_session",
  },
  SessionCapExceeded: {
    code: "session_cap_exceeded",
    title: "Session cap reached",
    detail: (args) =>
      `The run asked for more than the session allows. Remaining today: ${plain(args[2])} in the token's smallest unit.`,
    action: "raise_cap",
  },
  ExecutorNotAccepted: {
    code: "executor_approval_required",
    title: "A newer executor is published",
    detail: (args) =>
      `The vault obeys ${plain(args[1])} and the run came from ${plain(args[0])}. Accept the new version to continue.`,
    action: "accept_executor",
  },
  NotOwner: {
    code: "wrong_account",
    title: "Wrong account",
    detail: () =>
      "The connected wallet does not own this workflow or vault. Switch accounts and try again.",
    action: "check_wallet",
  },
  SystemPaused: {
    code: "system_paused",
    title: "Execution is paused",
    detail: () =>
      "Runs are paused while maintenance is under way. Withdrawing your funds still works.",
    action: "wait",
  },
  WorkflowInactive: {
    code: "workflow_inactive",
    title: "Workflow is switched off",
    detail: () => "This workflow is inactive, so the executor refused the run.",
    action: "fix_graph",
  },
  EmptyWorkflow: {
    code: "invalid_graph",
    title: "Nothing to run",
    detail: () => "The workflow has no steps.",
    action: "fix_graph",
  },
  TooManySteps: {
    code: "invalid_graph",
    title: "Too many steps",
    detail: (args) =>
      `The registry stores at most ${plain(args[1])} steps and this workflow has ${plain(args[0])}.`,
    action: "fix_graph",
  },
  AdapterNotAllowed: {
    code: "encoder_bug",
    title: "Adapter is not allowed for this step",
    detail: (args) =>
      `The registry rejected adapter ${plain(args[0])} for step type ${plain(args[1])}. This is our bug, not a wallet problem.`,
    action: "report",
  },
  UnexpectedStepType: {
    code: "encoder_bug",
    title: "Step type does not match its adapter",
    detail: (args) =>
      `The adapter expected step type ${plain(args[1])} and received ${plain(args[0])}.`,
    action: "report",
  },
  InsufficientOutput: {
    code: "slippage",
    title: "Output below your minimum",
    detail: (args) =>
      `The step returned ${plain(args[0])} against a minimum of ${plain(args[1])}. Nothing moved.`,
    action: "loosen_slippage",
  },
  DeadlinePassed: {
    code: "deadline_passed",
    title: "The swap deadline has passed",
    detail: () =>
      "The deadline stored with this workflow is in the past. Update the swap block and create the workflow again.",
    action: "refresh_deadline",
  },
  StaleFeed: {
    code: "oracle_unavailable",
    title: "Price feed is stale",
    detail: (args) =>
      `The feed was last updated at ${plain(args[0])} and the block allows ${plain(args[1])} seconds.`,
    action: "wait",
  },
  InvalidFeedAnswer: {
    code: "oracle_unavailable",
    title: "Price feed returned an unusable value",
    detail: (args) => `The feed answered ${plain(args[0])}.`,
    action: "wait",
  },
  TriggerNotDue: {
    code: "not_due",
    title: "The schedule is not due yet",
    detail: (args) => `The next run is allowed at ${plain(args[0])}.`,
    action: "wait",
  },
  NoTriggerStep: {
    code: "no_trigger",
    title: "No trigger step",
    detail: () => "Scheduling needs a trigger block in the workflow.",
    action: "fix_graph",
  },
  RunInFlight: {
    code: "run_in_flight",
    title: "A run is already in flight",
    detail: () =>
      "Wait for the current run to finish before changing this workflow.",
    action: "wait",
  },
  ResidualBalance: {
    code: "encoder_bug",
    title: "An adapter kept a balance",
    detail: (args) =>
      `Adapter left ${plain(args[1])} of ${plain(args[0])} behind. This is a contract bug and the run was rolled back.`,
    action: "report",
  },
  ERC20InsufficientBalance: {
    code: "insufficient_balance",
    title: "Token balance is too low",
    detail: (args) =>
      `The step needs ${plain(args[2])} and the holder has ${plain(args[1])}, in the token's smallest unit. Nothing moved.`,
    action: "fund_vault",
  },
  ERC20InsufficientAllowance: {
    code: "insufficient_allowance",
    title: "Allowance is too low",
    detail: (args) =>
      `The adapter may spend ${plain(args[1])} and the step needs ${plain(args[2])}.`,
    action: "open_session",
  },
  ZeroAddress: {
    code: "invalid_graph",
    title: "A required address is empty",
    detail: () => "One of the steps points at the zero address.",
    action: "fix_graph",
  },
};

const KNOWN_ERROR_ABI = [
  ...executorAbi,
  ...strategyVaultAbi,
  ...workflowRegistryAbi,
  ...vaultFactoryAbi,
  ...demoTokenAbi,
].filter((item) => item.type === "error");

interface DecodedRevert {
  name: string;
  args: readonly unknown[];
}

function decodeRevert(
  reverted: ContractFunctionRevertedError,
): DecodedRevert | null {
  if (reverted.data?.errorName) {
    return { name: reverted.data.errorName, args: reverted.data.args ?? [] };
  }

  if (!reverted.raw) return null;

  try {
    const decoded = decodeErrorResult({
      abi: KNOWN_ERROR_ABI,
      data: reverted.raw,
    });
    return { name: decoded.errorName, args: decoded.args ?? [] };
  } catch {
    return null;
  }
}

const hasName = (value: unknown): value is { name: string } =>
  typeof value === "object" && value !== null && "name" in value;

export function isUserRejection(error: unknown) {
  return (
    error instanceof BaseError &&
    error.walk(
      (cause) => hasName(cause) && cause.name === "UserRejectedRequestError",
    ) !== null
  );
}

export function toChainError(error: unknown): ChainError | null {
  if (!error || isUserRejection(error)) return null;

  if (error instanceof BaseError) {
    const reverted = error.walk(
      (cause) => cause instanceof ContractFunctionRevertedError,
    );

    if (reverted instanceof ContractFunctionRevertedError) {
      const decoded = decodeRevert(reverted);
      const template = decoded ? TEMPLATES[decoded.name] : undefined;

      if (template && decoded) {
        return {
          code: template.code,
          title: template.title,
          detail: template.detail(decoded.args),
          action: template.action,
        };
      }

      return {
        code: "unknown_revert",
        title: "The contract refused the transaction",
        detail: `Unrecognised error ${decoded?.name ?? reverted.signature ?? "without a selector"}.`,
        action: "report",
      };
    }

    return {
      code: "transaction_failed",
      title: "The transaction could not be sent",
      detail: error.shortMessage,
      action: "none",
    };
  }

  return {
    code: "transaction_failed",
    title: "The transaction could not be sent",
    detail: error instanceof Error ? error.message : "Unknown failure.",
    action: "none",
  };
}
