// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal surface of a Curve liquidity gauge used by the CurveAdapter.
interface ICurveGauge {
    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function claim_rewards() external;

    function lp_token() external view returns (address lpToken);

    function reward_token() external view returns (address rewardToken);

    function claimable_reward(address account) external view returns (uint256 amount);
}
