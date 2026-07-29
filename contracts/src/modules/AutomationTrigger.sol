// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {NoTriggerStep, TriggerNotDue, ZeroAddress} from "../interfaces/Errors.sol";
import {IExecutor} from "../interfaces/IExecutor.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";
import {StepType, Workflow} from "../interfaces/Types.sol";

/// @notice Chainlink Automation compatible scheduler for workflows with a TRIGGER step.
/// @dev No registration: the schedule is read from the workflow's own TRIGGER step
///      params at call time. Both entry points are callable by anyone, correctness is
///      enforced by the schedule, and the executor only accepts this contract as a
///      caller for workflows whose TRIGGER step names it.
contract AutomationTrigger {
    IWorkflowRegistry public immutable registry;

    mapping(uint256 workflowId => uint256 lastRun) public lastRunAt;

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = IWorkflowRegistry(registry_);
    }

    /// @notice Whether a workflow's schedule has elapsed.
    /// @param checkData abi.encode(uint256 workflowId).
    /// @return upkeepNeeded True when the workflow is due to run.
    /// @return performData The checkData passed through for performUpkeep.
    function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData) {
        uint256 workflowId = abi.decode(checkData, (uint256));
        (bool found, uint256 nextRunAt) = _schedule(workflowId);
        return (found && block.timestamp >= nextRunAt, checkData);
    }

    /// @notice Runs a due workflow through the current executor.
    /// @param performData abi.encode(uint256 workflowId).
    /// @dev Reverts with NoTriggerStep or TriggerNotDue. Callable by anyone,
    ///      the schedule is the gate.
    function performUpkeep(bytes calldata performData) external {
        uint256 workflowId = abi.decode(performData, (uint256));
        (bool found, uint256 nextRunAt) = _schedule(workflowId);
        if (!found) revert NoTriggerStep();
        if (block.timestamp < nextRunAt) revert TriggerNotDue(nextRunAt);
        lastRunAt[workflowId] = block.timestamp;
        IExecutor(registry.executor()).run(workflowId);
    }

    function _schedule(uint256 workflowId) private view returns (bool found, uint256 nextRunAt) {
        Workflow memory workflow = registry.get(workflowId);
        for (uint256 i = 0; i < workflow.steps.length; i++) {
            if (workflow.steps[i].stepType == StepType.TRIGGER && workflow.steps[i].adapter == address(this)) {
                (uint64 intervalSeconds, uint64 startAt) = abi.decode(workflow.steps[i].params, (uint64, uint64));
                uint256 last = lastRunAt[workflowId];
                nextRunAt = last == 0 ? startAt : last + intervalSeconds;
                if (nextRunAt < startAt) nextRunAt = startAt;
                return (true, nextRunAt);
            }
        }
        return (false, 0);
    }
}
