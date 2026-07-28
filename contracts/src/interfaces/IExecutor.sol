// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StepType} from "./Types.sol";

/// @notice Walks a workflow's steps, moving funds between the vault and the adapters.
interface IExecutor {
    event RunStarted(bytes32 indexed runId, uint256 indexed workflowId, address indexed caller);
    event StepExecuted(
        bytes32 indexed runId,
        uint256 indexed position,
        StepType stepType,
        address adapter,
        address tokenOut,
        uint256 amountOut
    );
    event GuardStopped(bytes32 indexed runId, uint256 indexed position, int256 answer);
    event AlertRaised(bytes32 indexed runId, bytes32 indexed channel, bytes32 messageId);
    event RunCompleted(bytes32 indexed runId, bool stopped, uint256 stepsExecuted);

    /// @notice Executes every step of a workflow in stored order, all or nothing.
    /// @param workflowId The workflow to run.
    /// @return runId keccak256(abi.encode(workflowId, block.number, caller, nonce)).
    /// @dev Callable by the workflow owner or its AutomationTrigger.
    ///      Reverts with NotOwner, SystemPaused, WorkflowInactive or any step failure.
    ///      A GUARD step that fails its bound ends the run early without reverting.
    function run(uint256 workflowId) external returns (bytes32 runId);

    /// @notice Estimates the gas a run would use.
    /// @param workflowId The workflow to estimate.
    /// @return gasEstimate The estimated gas for a full run.
    function estimate(uint256 workflowId) external view returns (uint256 gasEstimate);
}
