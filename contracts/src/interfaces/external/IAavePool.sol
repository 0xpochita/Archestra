// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal surface of the Aave V3 pool used by the AaveAdapter.
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    function withdraw(address asset, uint256 amount, address to) external returns (uint256 withdrawn);
}
