// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {GuardModule} from "../../src/modules/GuardModule.sol";
import {MockAggregator} from "../mocks/MockAggregator.sol";

contract GuardModuleFuzzTest is Test {
    GuardModule internal guard;
    MockAggregator internal feed;

    function setUp() public {
        vm.warp(100_000);
        guard = new GuardModule();
        feed = new MockAggregator(8, 1);
    }

    function testFuzz_ShouldContinueMatchesTheComparator(int256 answer, int256 limit, uint8 comparator) public {
        answer = bound(answer, 1, type(int192).max);
        feed.setAnswer(answer);

        (bool shouldContinue, int256 reported) = guard.check(abi.encode(address(feed), limit, comparator, uint64(3600)));

        assertEq(reported, answer);
        if (comparator == 0) {
            assertEq(shouldContinue, answer >= limit);
        } else {
            assertEq(shouldContinue, answer <= limit);
        }
    }
}
