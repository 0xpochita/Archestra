// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract MockGuardModule {
    bool private _shouldContinue = true;
    int256 private _answer;

    function set(bool shouldContinue_, int256 answer_) external {
        _shouldContinue = shouldContinue_;
        _answer = answer_;
    }

    function check(bytes calldata) external view returns (bool shouldContinue, int256 answer) {
        return (_shouldContinue, _answer);
    }
}
