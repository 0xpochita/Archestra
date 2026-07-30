// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {DeadlinePassed, InsufficientOutput, NotExecutor, ZeroAddress} from "../interfaces/Errors.sol";
import {ISwapRouter} from "../interfaces/external/ISwapRouter.sol";
import {IStepAdapter} from "../interfaces/IStepAdapter.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";
import {StepType} from "../interfaces/Types.sol";

/// @notice Exact input swaps through the Uniswap V3 router, output straight to the vault.
/// @dev Slippage is enforced here, not delegated to the router, so the revert is always
///      InsufficientOutput. A zero minAmountOut is rejected as missing slippage protection.
contract UniswapAdapter is IStepAdapter {
    using SafeERC20 for IERC20;

    IWorkflowRegistry public immutable registry;
    ISwapRouter public immutable router;

    modifier onlyExecutor() {
        if (!registry.isExecutor(msg.sender)) revert NotExecutor();
        _;
    }

    constructor(address registry_, address router_) {
        if (registry_ == address(0) || router_ == address(0)) revert ZeroAddress();
        registry = IWorkflowRegistry(registry_);
        router = ISwapRouter(router_);
    }

    /// @inheritdoc IStepAdapter
    function execute(address vault, bytes calldata params)
        external
        onlyExecutor
        returns (address tokenOut, uint256 amountOut)
    {
        (address tokenIn, address tokenOutParam,, uint256 minAmountOut, uint24 feeTier, uint64 deadline) =
            abi.decode(params, (address, address, uint256, uint256, uint24, uint64));
        if (block.timestamp > deadline) revert DeadlinePassed(deadline);
        if (minAmountOut == 0) revert InsufficientOutput(0, 0);

        uint256 granted = IERC20(tokenIn).allowance(vault, address(this));
        IERC20(tokenIn).safeTransferFrom(vault, address(this), granted);
        IERC20(tokenIn).forceApprove(address(router), granted);
        amountOut = router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOutParam,
                fee: feeTier,
                recipient: vault,
                deadline: deadline,
                amountIn: granted,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(tokenIn).forceApprove(address(router), 0);
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);
        return (tokenOutParam, amountOut);
    }

    /// @inheritdoc IStepAdapter
    function pullPlan(bytes calldata params) external pure returns (address tokenIn, uint256 amountIn) {
        (tokenIn,, amountIn,,,) = abi.decode(params, (address, address, uint256, uint256, uint24, uint64));
    }

    /// @inheritdoc IStepAdapter
    function supportedType() external pure returns (StepType stepType) {
        return StepType.SWAP;
    }
}
