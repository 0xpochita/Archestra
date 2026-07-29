// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStepAdapter} from "../../src/interfaces/IStepAdapter.sol";
import {StepType} from "../../src/interfaces/Types.sol";

contract MockStepAdapter is IStepAdapter {
    StepType private immutable _stepType;
    address private _resultToken;
    uint256 private _resultAmount;
    address private _planToken;
    uint256 private _planAmount;
    address private _pullToken;
    uint256 public executeCount;
    uint256 public lastObservedAllowance;

    constructor(StepType stepType_) {
        _stepType = stepType_;
    }

    function setResult(address token, uint256 amount) external {
        _resultToken = token;
        _resultAmount = amount;
    }

    function setPlan(address token, uint256 amount) external {
        _planToken = token;
        _planAmount = amount;
    }

    function setPull(address token) external {
        _pullToken = token;
    }

    function execute(address vault, bytes calldata) external returns (address tokenOut, uint256 amountOut) {
        executeCount++;
        if (_pullToken != address(0)) {
            uint256 granted = IERC20(_pullToken).allowance(vault, address(this));
            lastObservedAllowance = granted;
            IERC20(_pullToken).transferFrom(vault, address(this), granted);
            IERC20(_pullToken).transfer(vault, granted);
            return (_pullToken, granted);
        }
        return (_resultToken, _resultAmount);
    }

    function pullPlan(bytes calldata) external view returns (address tokenIn, uint256 amountIn) {
        return (_planToken, _planAmount);
    }

    function supportedType() external view returns (StepType stepType) {
        return _stepType;
    }
}
