// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IStepAdapter} from "../../src/interfaces/IStepAdapter.sol";
import {StepType} from "../../src/interfaces/Types.sol";

contract RevertingAdapter is IStepAdapter {
    error AlwaysReverts();

    StepType private immutable _stepType;

    constructor(StepType stepType_) {
        _stepType = stepType_;
    }

    function execute(address, bytes calldata) external pure returns (address, uint256) {
        revert AlwaysReverts();
    }

    function supportedType() external view returns (StepType stepType) {
        return _stepType;
    }
}
