// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    AdapterNotAllowed,
    EmptyWorkflow,
    ExecutorNotAccepted,
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
/// @dev Replaceable by redeploy plus registry.publishExecutor, and every vault owner accepts
///      the new version for themselves. Holds no funds between steps: a non zero balance here
///      at run end is an invariant violation. Every allowance it grants, per adapter step or
///      through an APPROVE step, is zero again by run end.
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
        if (msg.sender != workflow.owner && !_isWorkflowTrigger(workflow, msg.sender)) revert NotOwner();
        if (paused()) revert SystemPaused();
        if (!workflow.active) revert WorkflowInactive();
        if (workflow.steps.length == 0) revert EmptyWorkflow();

        address accepted = IStrategyVault(workflow.vault).acceptedExecutor();
        if (accepted != address(this)) revert ExecutorNotAccepted(address(this), accepted);

        runId = keccak256(abi.encode(workflowId, block.number, msg.sender, _runNonce++));
        registry.setRunInFlight(workflowId, true);
        emit RunStarted(runId, workflowId, msg.sender);

        (bool stopped, uint256 stepsExecuted) = _walk(runId, workflow);

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

    function _walk(bytes32 runId, Workflow memory workflow) private returns (bool stopped, uint256 stepsExecuted) {
        address[] memory grantedTokens = new address[](workflow.steps.length);
        address[] memory grantedSpenders = new address[](workflow.steps.length);
        uint256 grantedCount = 0;

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
                if (amount > 0) {
                    grantedTokens[grantedCount] = token;
                    grantedSpenders[grantedCount] = spender;
                    grantedCount++;
                }
                emit StepExecuted(runId, i, step.stepType, step.adapter, token, amount);
            } else {
                (address tokenOut, uint256 amountOut) = _executeAdapterStep(workflow.vault, step);
                emit StepExecuted(runId, i, step.stepType, step.adapter, tokenOut, amountOut);
            }
            stepsExecuted++;
        }

        for (uint256 j = 0; j < grantedCount; j++) {
            IStrategyVault(workflow.vault).approveAdapter(grantedTokens[j], grantedSpenders[j], 0);
        }
    }

    function _executeAdapterStep(address vault, Step memory step)
        private
        returns (address tokenOut, uint256 amountOut)
    {
        IStepAdapter adapter = IStepAdapter(step.adapter);
        StepType supported = adapter.supportedType();
        if (supported != step.stepType) revert UnexpectedStepType(step.stepType, supported);

        (address tokenIn, uint256 amountIn) = adapter.pullPlan(step.params);
        bool granted = tokenIn != address(0) && amountIn > 0;
        if (granted) {
            uint256 resolved = amountIn == type(uint256).max ? IERC20(tokenIn).balanceOf(vault) : amountIn;
            IStrategyVault(vault).approveAdapter(tokenIn, step.adapter, resolved);
        }
        (tokenOut, amountOut) = adapter.execute(vault, step.params);
        if (granted) {
            IStrategyVault(vault).approveAdapter(tokenIn, step.adapter, 0);
        }
    }

    function _isWorkflowTrigger(Workflow memory workflow, address caller) private pure returns (bool isTrigger) {
        for (uint256 i = 0; i < workflow.steps.length; i++) {
            if (workflow.steps[i].stepType == StepType.TRIGGER && workflow.steps[i].adapter == caller) {
                return true;
            }
        }
        return false;
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
