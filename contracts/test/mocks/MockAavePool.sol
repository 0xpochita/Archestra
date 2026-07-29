// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IAavePool} from "../../src/interfaces/external/IAavePool.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockAavePool is IAavePool {
    mapping(address asset => MockERC20 aToken) public aTokenOf;

    function registerAsset(address asset) external returns (address aToken) {
        MockERC20 token = new MockERC20("Mock aToken", "maTKN", IERC20Metadata(asset).decimals());
        aTokenOf[asset] = token;
        return address(token);
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        aTokenOf[asset].mint(onBehalfOf, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256 withdrawn) {
        MockERC20 aToken = aTokenOf[asset];
        withdrawn = amount == type(uint256).max ? aToken.balanceOf(msg.sender) : amount;
        aToken.burn(msg.sender, withdrawn);
        IERC20(asset).transfer(to, withdrawn);
    }
}
