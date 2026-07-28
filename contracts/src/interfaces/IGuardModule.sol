// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Reads a Chainlink feed and decides whether a run should continue.
interface IGuardModule {
    /// @notice Checks a feed answer against the encoded bound.
    /// @param params abi.encode(address feed, int256 bound, uint8 comparator, uint64 maxStaleSeconds).
    /// @return shouldContinue False when the bound fails, which stops the run without reverting.
    /// @return answer The feed answer that was evaluated.
    /// @dev Reverts with StaleFeed or InvalidFeedAnswer.
    function check(bytes calldata params) external view returns (bool shouldContinue, int256 answer);
}
