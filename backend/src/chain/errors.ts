import { toFunctionSelector } from "viem";

interface CustomErrorInfo {
  code: string;
  title: string;
}

const ERROR_SIGNATURES: Array<{ signature: string; info: CustomErrorInfo }> = [
  { signature: "NotOwner()", info: { code: "not_owner", title: "Not the vault owner" } },
  { signature: "NotExecutor()", info: { code: "not_executor", title: "Not an executor" } },
  { signature: "SystemPaused()", info: { code: "system_paused", title: "System is paused" } },
  {
    signature: "WorkflowInactive()",
    info: { code: "workflow_inactive", title: "Workflow is inactive" },
  },
  { signature: "EmptyWorkflow()", info: { code: "empty_workflow", title: "Workflow is empty" } },
  {
    signature: "TooManySteps(uint256,uint256)",
    info: { code: "too_many_steps", title: "Too many steps in workflow" },
  },
  {
    signature: "AdapterNotAllowed(address,uint8)",
    info: { code: "adapter_not_allowed", title: "Adapter is not registered" },
  },
  {
    signature: "UnexpectedStepType(uint8,uint8)",
    info: { code: "unexpected_step_type", title: "Adapter does not match step type" },
  },
  {
    signature: "InsufficientOutput(uint256,uint256)",
    info: { code: "insufficient_output", title: "Slippage exceeded, output too low" },
  },
  {
    signature: "StaleFeed(uint256,uint256)",
    info: { code: "stale_feed", title: "Price feed is stale" },
  },
  {
    signature: "InvalidFeedAnswer(int256)",
    info: { code: "invalid_feed_answer", title: "Price feed returned invalid answer" },
  },
  {
    signature: "DeadlinePassed(uint64)",
    info: { code: "deadline_passed", title: "Swap deadline passed" },
  },
  {
    signature: "ResidualBalance(address,uint256)",
    info: { code: "residual_balance", title: "Residual balance remains after step" },
  },
  { signature: "ZeroAddress()", info: { code: "zero_address", title: "Zero address rejected" } },
  { signature: "RunInFlight()", info: { code: "run_in_flight", title: "A run is already active" } },
  {
    signature: "TriggerNotDue(uint256)",
    info: { code: "trigger_not_due", title: "Trigger not due yet" },
  },
  { signature: "NoTriggerStep()", info: { code: "no_trigger_step", title: "No trigger step" } },
  {
    signature: "ExecutorNotAccepted(address,address)",
    info: {
      code: "executor_approval_required",
      title: "Vault must accept the current executor version",
    },
  },
  {
    signature: "NoActiveSession(address)",
    info: { code: "session_required", title: "Session required for this token" },
  },
  {
    signature: "SessionCapExceeded(address,uint256,uint256)",
    info: { code: "session_cap_exceeded", title: "Session spending cap exceeded" },
  },
];

const SELECTOR_INDEX = new Map<string, CustomErrorInfo>();
for (const { signature, info } of ERROR_SIGNATURES) {
  const selector = toFunctionSelector(signature).toLowerCase();
  SELECTOR_INDEX.set(selector, info);
}

export interface DecodedRevertError {
  code: string;
  title: string;
  selector: string;
  data: string;
}

export function decodeRevertData(revertData: string | null | undefined): DecodedRevertError {
  if (!revertData || revertData.length < 10) {
    return {
      code: "unknown_revert",
      title: "Transaction reverted without a reason",
      selector: "0x",
      data: revertData ?? "0x",
    };
  }
  const selector = revertData.slice(0, 10).toLowerCase();
  const info = SELECTOR_INDEX.get(selector);
  if (!info) {
    return {
      code: "unknown_revert",
      title: "Unknown revert selector",
      selector,
      data: revertData,
    };
  }
  return { code: info.code, title: info.title, selector, data: revertData };
}
