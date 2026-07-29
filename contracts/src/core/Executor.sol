// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    AdapterNotAllowed,
    EmptyWorkflow,
    NotOwner,
    SystemPaused,
    UnexpectedStepType,
    WorkflowInactive,
    ZeroAddress
} from "../interfaces/Errors.sol";
import {IExecutor} from "../interfaces/IExecutor.sol";
import {IGuardModule} from "../interfaces/IGuardModule.sol";
import {IStepAdapter} from "../interfaces/IStepAdapter.sol";
import {IStrategyVault} from "../interfaces/IStrategyVault.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";
import {Step, StepType, Workflow} from "../interfaces/Types.sol";

/// @notice Walks a workflow's steps in stored order, all or nothing, emitting the event
///         stream the backend indexer consumes.
/// @dev Replaceable by redeploy plus registry.setExecutor. Holds no funds between steps:
///      a non zero balance here at run end is an invariant violation.
contract Executor is IExecutor, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IWorkflowRegistry public immutable registry;

    uint256 private _runNonce;

    constructor(address registry_, address admin) {
        if (registry_ == address(0) || admin == address(0)) revert ZeroAddress();
        registry = IWorkflowRegistry(registry_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @inheritdoc IExecutor
    function run(uint256 workflowId) external nonReentrant returns (bytes32 runId) {
        Workflow memory workflow = registry.get(workflowId);
        if (msg.sender != workflow.owner) revert NotOwner();
        if (paused()) revert SystemPaused();
        if (!workflow.active) revert WorkflowInactive();
        if (workflow.steps.length == 0) revert EmptyWorkflow();

        runId = keccak256(abi.encode(workflowId, block.number, msg.sender, _runNonce++));
        registry.setRunInFlight(workflowId, true);
        emit RunStarted(runId, workflowId, msg.sender);

        bool stopped = false;
        uint256 stepsExecuted = 0;
        for (uint256 i = 0; i < workflow.steps.length; i++) {
            Step memory step = workflow.steps[i];
            if (!registry.isAdapterAllowed(step.adapter, step.stepType)) {
                revert AdapterNotAllowed(step.adapter, step.stepType);
            }

            if (step.stepType == StepType.GUARD) {
                (bool shouldContinue, int256 answer) = IGuardModule(step.adapter).check(step.params);
                if (!shouldContinue) {
                    stopped = true;
                    emit GuardStopped(runId, i, answer);
                    break;
                }
                emit StepExecuted(runId, i, step.stepType, step.adapter, address(0), 0);
            } else if (step.stepType == StepType.TRIGGER) {
                emit StepExecuted(runId, i, step.stepType, step.adapter, address(0), 0);
            } else if (step.stepType == StepType.NOTIFY) {
                (bytes32 channel, bytes32 messageId) = abi.decode(step.params, (bytes32, bytes32));
                emit AlertRaised(runId, channel, messageId);
                emit StepExecuted(runId, i, step.stepType, step.adapter, address(0), 0);
            } else if (step.stepType == StepType.APPROVE) {
                (address token, address spender, uint256 amount) = abi.decode(step.params, (address, address, uint256));
                IStrategyVault(workflow.vault).approveAdapter(token, spender, amount);
                emit StepExecuted(runId, i, step.stepType, step.adapter, token, amount);
            } else {
                IStepAdapter adapter = IStepAdapter(step.adapter);
                StepType supported = adapter.supportedType();
                if (supported != step.stepType) revert UnexpectedStepType(step.stepType, supported);
                (address tokenOut, uint256 amountOut) = adapter.execute(workflow.vault, step.params);
                emit StepExecuted(runId, i, step.stepType, step.adapter, tokenOut, amountOut);
            }
            stepsExecuted++;
        }

        registry.setRunInFlight(workflowId, false);
        emit RunCompleted(runId, stopped, stepsExecuted);
    }

    /// @notice Halts all runs. Vault withdrawals are unaffected.
    /// @dev PAUSER_ROLE only.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resumes runs.
    /// @dev PAUSER_ROLE only.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @inheritdoc IExecutor
    /// @dev Sums a fixed per step type table mirroring the backend MockChainAdapter,
    ///      plus a ten percent buffer.
    function estimate(uint256 workflowId) external view returns (uint256 gasEstimate) {
        Workflow memory workflow = registry.get(workflowId);
        for (uint256 i = 0; i < workflow.steps.length; i++) {
            gasEstimate += _stepGas(workflow.steps[i].stepType);
        }
        gasEstimate += gasEstimate / 10;
    }

    function _stepGas(StepType stepType) private pure returns (uint256 gasUnits) {
        if (stepType == StepType.APPROVE) return 46000;
        if (stepType == StepType.SUPPLY) return 180000;
        if (stepType == StepType.SWAP) return 145000;
        if (stepType == StepType.STAKE) return 210000;
        if (stepType == StepType.CLAIM) return 120000;
        if (stepType == StepType.BRIDGE) return 250000;
        if (stepType == StepType.REDEEM) return 160000;
        if (stepType == StepType.GUARD) return 35000;
        return 0;
    }
}
