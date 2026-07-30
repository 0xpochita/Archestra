// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract MockRegistry {
    address public executor;

    function setExecutor(address newExecutor) external {
        executor = newExecutor;
    }

    function isExecutor(address candidate) external view returns (bool published) {
        return candidate != address(0) && candidate == executor;
    }
}
