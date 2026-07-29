// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal surface of a two coin Curve pool used by the CurveAdapter.
interface ICurvePool {
    function add_liquidity(uint256[2] calldata amounts, uint256 minMintAmount) external returns (uint256 minted);

    function coins(uint256 index) external view returns (address coin);
}
