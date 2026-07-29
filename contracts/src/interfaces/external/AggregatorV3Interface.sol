// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Chainlink price feed surface used by the GuardModule.
interface AggregatorV3Interface {
    function decimals() external view returns (uint8 feedDecimals);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
