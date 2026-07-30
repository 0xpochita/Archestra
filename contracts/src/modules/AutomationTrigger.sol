// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {NoTriggerStep, TriggerNotDue, ZeroAddress} from "../interfaces/Errors.sol";
import {IExecutor} from "../interfaces/IExecutor.sol";
import {IStrategyVault} from "../interfaces/IStrategyVault.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";
import {StepType, Workflow} from "../interfaces/Types.sol";

/// @notice Chainlink Automation compatible scheduler for workflows with a TRIGGER step.
/// @dev No registration: the schedule is read from the workflow's own TRIGGER step
///      params at call time. Both entry points are callable by anyone, correctness is
///      enforced by the schedule, and the executor only accepts this contract as a
///      caller for workflows whose TRIGGER step names it. The run always goes through
///      the executor the vault's owner accepted, never the registry's latest pointer,
///      so publishing a newer executor gains nothing from the trigger path.
contract AutomationTrigger {
    IWorkflowRegistry public immutable registry;

    mapping(uint256 workflowId => uint256 lastRun) public lastRunAt;

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = IWorkflowRegistry(registry_);
    }

    /// @notice Runs a due workflow through the executor the vault's owner accepted.
    /// @param performData abi.encode(uint256 workflowId).
    /// @dev Reverts with NoTriggerStep or TriggerNotDue. Callable by anyone,
    ///      the schedule is the gate.
    function performUpkeep(bytes calldata performData) external {
        uint256 workflowId = abi.decode(performData, (uint256));
        (bool found, uint256 nextRunAt, address vault) = _schedule(workflowId);
        if (!found) revert NoTriggerStep();
        if (block.timestamp < nextRunAt) revert TriggerNotDue(nextRunAt);
        lastRunAt[workflowId] = block.timestamp;
        IExecutor(IStrategyVault(vault).acceptedExecutor()).run(workflowId);
    }

    /// @notice Whether a workflow's schedule has elapsed and its accepted executor can still run it.
    /// @param checkData abi.encode(uint256 workflowId).
    /// @return upkeepNeeded True when the workflow is due and its accepted executor is published.
    /// @return performData The checkData passed through for performUpkeep.
    /// @dev Returns false rather than reverting when the vault's accepted executor has been
    ///      retired or was never set, so a stalled upkeep is visible off chain as not due.
    function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData) {
        uint256 workflowId = abi.decode(checkData, (uint256));
        (bool found, uint256 nextRunAt, address vault) = _schedule(workflowId);
        if (!found || block.timestamp < nextRunAt) return (false, checkData);
        address accepted = IStrategyVault(vault).acceptedExecutor();
        return (registry.isExecutor(accepted), checkData);
    }

    function _schedule(uint256 workflowId) private view returns (bool found, uint256 nextRunAt, address vault) {
        Workflow memory workflow = registry.get(workflowId);
        for (uint256 i = 0; i < workflow.steps.length; i++) {
            if (workflow.steps[i].stepType == StepType.TRIGGER && workflow.steps[i].adapter == address(this)) {
                (uint64 intervalSeconds, uint64 startAt) = abi.decode(workflow.steps[i].params, (uint64, uint64));
                uint256 last = lastRunAt[workflowId];
                nextRunAt = last == 0 ? startAt : last + intervalSeconds;
                if (nextRunAt < startAt) nextRunAt = startAt;
                return (true, nextRunAt, workflow.vault);
            }
        }
        return (false, 0, address(0));
    }
}
