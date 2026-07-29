// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICurveGauge} from "../../src/interfaces/external/ICurveGauge.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockGauge is ICurveGauge {
    IERC20 private immutable _lpToken;
    MockERC20 private immutable _rewardToken;

    uint256 public rewardPerSecond;
    mapping(address account => uint256 balance) public balanceOf;
    mapping(address account => uint256 accrued) private _accrued;
    mapping(address account => uint256 lastUpdate) private _lastUpdate;

    constructor(address lpToken_) {
        _lpToken = IERC20(lpToken_);
        _rewardToken = new MockERC20("Mock Reward", "mRWD", 18);
    }

    function setRewardPerSecond(uint256 rewardPerSecond_) external {
        rewardPerSecond = rewardPerSecond_;
    }

    function deposit(uint256 amount, address account) external {
        _update(account);
        _lpToken.transferFrom(msg.sender, address(this), amount);
        balanceOf[account] += amount;
    }

    function claim_rewards(address account) external {
        _update(account);
        uint256 amount = _accrued[account];
        _accrued[account] = 0;
        _rewardToken.mint(account, amount);
    }

    function lp_token() external view returns (address lpToken) {
        return address(_lpToken);
    }

    function reward_token() external view returns (address rewardToken) {
        return address(_rewardToken);
    }

    function claimable_reward(address account) external view returns (uint256 amount) {
        amount = _accrued[account];
        if (balanceOf[account] > 0) {
            amount += rewardPerSecond * (block.timestamp - _lastUpdate[account]);
        }
    }

    function _update(address account) private {
        if (balanceOf[account] > 0) {
            _accrued[account] += rewardPerSecond * (block.timestamp - _lastUpdate[account]);
        }
        _lastUpdate[account] = block.timestamp;
    }
}
