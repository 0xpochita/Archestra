// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICcipRouter} from "../../src/interfaces/external/ICcipRouter.sol";
import {MockERC20} from "./MockERC20.sol";

contract MockCcipRouter is ICcipRouter {
    error FeeNotCovered();

    uint256 public fee;
    uint256 public sendCount;
    uint64 public lastDestinationChainSelector;
    bytes public lastReceiver;
    address public lastToken;
    uint256 public lastAmount;

    function setFee(uint256 fee_) external {
        fee = fee_;
    }

    function getFee(uint64, EVM2AnyMessage calldata) external view returns (uint256 currentFee) {
        return fee;
    }

    function ccipSend(uint64 destinationChainSelector, EVM2AnyMessage calldata message)
        external
        payable
        returns (bytes32 messageId)
    {
        if (msg.value < fee) revert FeeNotCovered();
        lastDestinationChainSelector = destinationChainSelector;
        lastReceiver = message.receiver;
        for (uint256 i = 0; i < message.tokenAmounts.length; i++) {
            lastToken = message.tokenAmounts[i].token;
            lastAmount = message.tokenAmounts[i].amount;
            IERC20(lastToken).transferFrom(msg.sender, address(this), lastAmount);
            MockERC20(lastToken).burn(address(this), lastAmount);
        }
        sendCount++;
        return keccak256(abi.encode(destinationChainSelector, message.receiver, sendCount));
    }
}
