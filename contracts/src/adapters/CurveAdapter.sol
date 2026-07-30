// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {InsufficientOutput, NotExecutor, UnexpectedStepType, ZeroAddress} from "../interfaces/Errors.sol";
import {ICurveGauge} from "../interfaces/external/ICurveGauge.sol";
import {ICurvePool} from "../interfaces/external/ICurvePool.sol";
import {IStepAdapter} from "../interfaces/IStepAdapter.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";
import {StepType} from "../interfaces/Types.sol";

/// @notice Adds liquidity to a Curve pool and stakes the LP for the vault, or claims
///         gauge rewards straight into the vault.
/// @dev Deployed twice: one instance serves STAKE, one serves CLAIM. The gauge position
///      and the rewards always belong to the vault, never to this contract.
contract CurveAdapter is IStepAdapter {
    using SafeERC20 for IERC20;

    IWorkflowRegistry public immutable registry;

    StepType private immutable _stepType;

    modifier onlyExecutor() {
        if (!registry.isExecutor(msg.sender)) revert NotExecutor();
        _;
    }

    constructor(address registry_, StepType stepType_) {
        if (registry_ == address(0)) revert ZeroAddress();
        if (stepType_ != StepType.STAKE && stepType_ != StepType.CLAIM) {
            revert UnexpectedStepType(stepType_, StepType.STAKE);
        }
        registry = IWorkflowRegistry(registry_);
        _stepType = stepType_;
    }

    /// @inheritdoc IStepAdapter
    function execute(address vault, bytes calldata params)
        external
        onlyExecutor
        returns (address tokenOut, uint256 amountOut)
    {
        if (_stepType == StepType.STAKE) return _stake(vault, params);
        return _claim(vault, params);
    }

    /// @inheritdoc IStepAdapter
    function pullPlan(bytes calldata params) external view returns (address tokenIn, uint256 amountIn) {
        if (_stepType == StepType.CLAIM) return (address(0), 0);
        (address pool,, uint256 amount,) = abi.decode(params, (address, address, uint256, uint256));
        return (ICurvePool(pool).coins(0), amount);
    }

    /// @inheritdoc IStepAdapter
    function supportedType() external view returns (StepType stepType) {
        return _stepType;
    }

    function _stake(address vault, bytes calldata params) private returns (address tokenOut, uint256 amountOut) {
        (address pool, address gauge,, uint256 minLpOut) = abi.decode(params, (address, address, uint256, uint256));
        if (minLpOut == 0) revert InsufficientOutput(0, 0);

        address coin = ICurvePool(pool).coins(0);
        uint256 granted = IERC20(coin).allowance(vault, address(this));
        IERC20(coin).safeTransferFrom(vault, address(this), granted);
        IERC20(coin).forceApprove(pool, granted);
        uint256 minted = ICurvePool(pool).add_liquidity([granted, 0], 0);
        IERC20(coin).forceApprove(pool, 0);
        if (minted < minLpOut) revert InsufficientOutput(minted, minLpOut);

        address lpToken = ICurveGauge(gauge).lp_token();
        IERC20(lpToken).forceApprove(gauge, minted);
        ICurveGauge(gauge).deposit(minted, vault);
        IERC20(lpToken).forceApprove(gauge, 0);
        return (lpToken, minted);
    }

    function _claim(address vault, bytes calldata params) private returns (address tokenOut, uint256 amountOut) {
        (address gauge, uint256 minValueOut) = abi.decode(params, (address, uint256));
        if (minValueOut == 0) revert InsufficientOutput(0, 0);

        address rewardToken = ICurveGauge(gauge).reward_token();
        uint256 before = IERC20(rewardToken).balanceOf(vault);
        ICurveGauge(gauge).claim_rewards(vault);
        uint256 claimed = IERC20(rewardToken).balanceOf(vault) - before;
        if (claimed < minValueOut) revert InsufficientOutput(claimed, minValueOut);
        return (rewardToken, claimed);
    }
}
