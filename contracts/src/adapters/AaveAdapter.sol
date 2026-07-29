// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {NotExecutor, UnexpectedStepType, ZeroAddress} from "../interfaces/Errors.sol";
import {IAavePool} from "../interfaces/external/IAavePool.sol";
import {IStepAdapter} from "../interfaces/IStepAdapter.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";
import {StepType} from "../interfaces/Types.sol";

/// @notice Supplies to and redeems from the Aave V3 pool on the vault's behalf.
/// @dev Deployed twice: one instance serves SUPPLY, one serves REDEEM. aTokens are
///      minted straight to the vault on supply, and the underlying goes straight to
///      the vault on redeem, so this contract never holds a balance after a call.
contract AaveAdapter is IStepAdapter {
    using SafeERC20 for IERC20;

    IWorkflowRegistry public immutable registry;
    IAavePool public immutable pool;

    StepType private immutable _stepType;

    modifier onlyExecutor() {
        if (msg.sender != registry.executor()) revert NotExecutor();
        _;
    }

    constructor(address registry_, address pool_, StepType stepType_) {
        if (registry_ == address(0) || pool_ == address(0)) revert ZeroAddress();
        if (stepType_ != StepType.SUPPLY && stepType_ != StepType.REDEEM) {
            revert UnexpectedStepType(stepType_, StepType.SUPPLY);
        }
        registry = IWorkflowRegistry(registry_);
        pool = IAavePool(pool_);
        _stepType = stepType_;
    }

    /// @inheritdoc IStepAdapter
    function execute(address vault, bytes calldata params)
        external
        onlyExecutor
        returns (address tokenOut, uint256 amountOut)
    {
        (address asset,) = abi.decode(params, (address, uint256));
        address aToken = pool.getReserveData(asset).aTokenAddress;

        if (_stepType == StepType.SUPPLY) {
            uint256 granted = IERC20(asset).allowance(vault, address(this));
            IERC20(asset).safeTransferFrom(vault, address(this), granted);
            IERC20(asset).forceApprove(address(pool), granted);
            pool.supply(asset, granted, vault, 0);
            IERC20(asset).forceApprove(address(pool), 0);
            return (aToken, granted);
        }

        uint256 grantedATokens = IERC20(aToken).allowance(vault, address(this));
        IERC20(aToken).safeTransferFrom(vault, address(this), grantedATokens);
        uint256 withdrawn = pool.withdraw(asset, grantedATokens, vault);
        return (asset, withdrawn);
    }

    /// @inheritdoc IStepAdapter
    function pullPlan(bytes calldata params) external view returns (address tokenIn, uint256 amountIn) {
        (address asset, uint256 amount) = abi.decode(params, (address, uint256));
        if (_stepType == StepType.SUPPLY) return (asset, amount);
        return (pool.getReserveData(asset).aTokenAddress, amount);
    }

    /// @inheritdoc IStepAdapter
    function supportedType() external view returns (StepType stepType) {
        return _stepType;
    }
}
