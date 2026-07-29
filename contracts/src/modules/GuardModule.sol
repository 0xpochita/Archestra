// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {InvalidFeedAnswer, StaleFeed} from "../interfaces/Errors.sol";
import {AggregatorV3Interface} from "../interfaces/external/AggregatorV3Interface.sol";
import {IGuardModule} from "../interfaces/IGuardModule.sol";

/// @notice Reads a Chainlink feed and decides whether a run should continue.
/// @dev Stateless and view only, callable by anyone: a wrong caller can learn a feed
///      value but can never move funds. Returning false is the graceful stop signal,
///      reverting is reserved for a broken feed.
contract GuardModule is IGuardModule {
    /// @inheritdoc IGuardModule
    /// @dev A comparator of zero stops the run when the answer is below the bound,
    ///      any other value stops it when the answer is above.
    function check(bytes calldata params) external view returns (bool shouldContinue, int256 answer) {
        (address feed, int256 bound, uint8 comparator, uint64 maxStaleSeconds) =
            abi.decode(params, (address, int256, uint8, uint64));

        uint256 updatedAt;
        (, answer,, updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        if (block.timestamp - updatedAt > maxStaleSeconds) revert StaleFeed(updatedAt, maxStaleSeconds);
        if (answer <= 0) revert InvalidFeedAnswer(answer);

        if (comparator == 0) return (answer >= bound, answer);
        return (answer <= bound, answer);
    }
}
