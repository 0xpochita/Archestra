// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICurvePool} from "../../src/interfaces/external/ICurvePool.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockCurvePool is ICurvePool {
    error PoolTooFewMinted();

    address[2] private _coins;
    MockERC20 public immutable lpToken;
    uint256 public immutable lpPerCoin0;

    constructor(address coin0, address coin1, uint256 lpPerCoin0_) {
        _coins[0] = coin0;
        _coins[1] = coin1;
        lpPerCoin0 = lpPerCoin0_;
        lpToken = new MockERC20("Curve LP", "crvLP", 18);
    }

    function add_liquidity(uint256[2] calldata amounts, uint256 minMintAmount) external returns (uint256 minted) {
        if (amounts[0] > 0) IERC20(_coins[0]).transferFrom(msg.sender, address(this), amounts[0]);
        if (amounts[1] > 0) IERC20(_coins[1]).transferFrom(msg.sender, address(this), amounts[1]);
        minted = amounts[0] * lpPerCoin0 + amounts[1];
        if (minted < minMintAmount) revert PoolTooFewMinted();
        lpToken.mint(msg.sender, minted);
    }

    function coins(uint256 index) external view returns (address coin) {
        return _coins[index];
    }
}
