// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {NotExecutor, ZeroAddress} from "../interfaces/Errors.sol";
import {ICcipRouter} from "../interfaces/external/ICcipRouter.sol";
import {IStepAdapter} from "../interfaces/IStepAdapter.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";
import {StepType} from "../interfaces/Types.sol";

/// @notice Sends a vault token to another chain through the Chainlink CCIP router.
/// @dev The CCIP fee is paid in native currency from this contract's own balance,
///      topped up by the operator, so the vault never needs to hold native funds.
///      The bridged amount leaves the vault exactly once and has no local output.
contract CcipAdapter is IStepAdapter {
    using SafeERC20 for IERC20;

    IWorkflowRegistry public immutable registry;
    ICcipRouter public immutable router;

    modifier onlyExecutor() {
        if (!registry.isExecutor(msg.sender)) revert NotExecutor();
        _;
    }

    constructor(address registry_, address router_) {
        if (registry_ == address(0) || router_ == address(0)) revert ZeroAddress();
        registry = IWorkflowRegistry(registry_);
        router = ICcipRouter(router_);
    }

    receive() external payable {}

    /// @inheritdoc IStepAdapter
    function execute(address vault, bytes calldata params)
        external
        onlyExecutor
        returns (address tokenOut, uint256 amountOut)
    {
        (uint64 destinationChainSelector, address receiver, address token,) =
            abi.decode(params, (uint64, address, address, uint256));

        uint256 granted = IERC20(token).allowance(vault, address(this));
        IERC20(token).safeTransferFrom(vault, address(this), granted);
        IERC20(token).forceApprove(address(router), granted);

        ICcipRouter.EVMTokenAmount[] memory tokenAmounts = new ICcipRouter.EVMTokenAmount[](1);
        tokenAmounts[0] = ICcipRouter.EVMTokenAmount({token: token, amount: granted});
        ICcipRouter.EVM2AnyMessage memory message = ICcipRouter.EVM2AnyMessage({
            receiver: abi.encode(receiver), data: "", tokenAmounts: tokenAmounts, feeToken: address(0), extraArgs: ""
        });

        uint256 fee = router.getFee(destinationChainSelector, message);
        router.ccipSend{value: fee}(destinationChainSelector, message);
        IERC20(token).forceApprove(address(router), 0);
        return (token, granted);
    }

    /// @inheritdoc IStepAdapter
    function pullPlan(bytes calldata params) external pure returns (address tokenIn, uint256 amountIn) {
        (,, tokenIn, amountIn) = abi.decode(params, (uint64, address, address, uint256));
    }

    /// @inheritdoc IStepAdapter
    function supportedType() external pure returns (StepType stepType) {
        return StepType.BRIDGE;
    }
}
