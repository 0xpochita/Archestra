// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISwapRouter} from "../../src/interfaces/external/ISwapRouter.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockSwapRouter is ISwapRouter {
    error RouterDeadlinePassed();
    error RouterTooLittleReceived();

    uint256 public rate = 1e18;

    function setRate(uint256 rate_) external {
        rate = rate_;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        if (block.timestamp > params.deadline) revert RouterDeadlinePassed();
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * rate) / 1e18;
        if (amountOut < params.amountOutMinimum) revert RouterTooLittleReceived();
        MockERC20(params.tokenOut).mint(params.recipient, amountOut);
    }
}
