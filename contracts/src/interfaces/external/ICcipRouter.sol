// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal surface of the Chainlink CCIP router used by the CcipAdapter.
interface ICcipRouter {
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }

    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }

    function getFee(uint64 destinationChainSelector, EVM2AnyMessage calldata message)
        external
        view
        returns (uint256 fee);

    function ccipSend(uint64 destinationChainSelector, EVM2AnyMessage calldata message)
        external
        payable
        returns (bytes32 messageId);
}
