// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IStepAdapter} from "../../src/interfaces/IStepAdapter.sol";
import {StepType} from "../../src/interfaces/Types.sol";

contract MockStepAdapter is IStepAdapter {
    StepType private immutable _stepType;
    address private _tokenOut;
    uint256 private _amountOut;
    uint256 public executeCount;

    constructor(StepType stepType_) {
        _stepType = stepType_;
    }

    function setResult(address tokenOut_, uint256 amountOut_) external {
        _tokenOut = tokenOut_;
        _amountOut = amountOut_;
    }

    function execute(address, bytes calldata) external returns (address tokenOut, uint256 amountOut) {
        executeCount++;
        return (_tokenOut, _amountOut);
    }

    function supportedType() external view returns (StepType stepType) {
        return _stepType;
    }
}
