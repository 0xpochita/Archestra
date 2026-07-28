// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StepType} from "./Types.sol";

/// @notice Caller is not the workflow or vault owner.
error NotOwner();
/// @notice Caller is not the current executor.
error NotExecutor();
/// @notice Execution is paused system wide.
error SystemPaused();
/// @notice The workflow is deactivated.
error WorkflowInactive();
/// @notice A workflow needs at least one step.
error EmptyWorkflow();
/// @notice The step list exceeds MAX_STEPS.
error TooManySteps(uint256 given, uint256 max);
/// @notice The adapter is not allow listed for this step type.
error AdapterNotAllowed(address adapter, StepType stepType);
/// @notice The adapter received a step type it does not support.
error UnexpectedStepType(StepType given, StepType expected);
/// @notice Output fell below the caller supplied minimum.
error InsufficientOutput(uint256 got, uint256 min);
/// @notice The price feed has not updated within the allowed window.
error StaleFeed(uint256 updatedAt, uint256 maxStale);
/// @notice The price feed returned a non positive answer.
error InvalidFeedAnswer(int256 answer);
/// @notice The step deadline is in the past.
error DeadlinePassed(uint64 deadline);
/// @notice A contract that must end a run empty still holds tokens.
error ResidualBalance(address token, uint256 amount);
/// @notice A zero address was supplied where a real one is required.
error ZeroAddress();
