// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {EmptyWorkflow, TooManySteps} from "../../src/interfaces/Errors.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";

contract WorkflowRegistryFuzzTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;

    address internal admin = makeAddr("admin");
    address internal curator = makeAddr("curator");
    address internal user = makeAddr("user");
    address internal aaveAdapter = makeAddr("aaveAdapter");

    function setUp() public {
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), curator);
        vm.stopPrank();
        vm.prank(curator);
        registry.setAdapterAllowed(aaveAdapter, StepType.SUPPLY, true);
    }

    function testFuzz_StepCountBounds(uint256 count) public {
        count = bound(count, 0, 32);
        Step[] memory steps = new Step[](count);
        for (uint256 i = 0; i < count; i++) {
            steps[i] = Step({stepType: StepType.SUPPLY, adapter: aaveAdapter, params: abi.encode(uint256(i))});
        }

        vm.prank(user);
        if (count == 0) {
            vm.expectRevert(EmptyWorkflow.selector);
            registry.create(steps);
        } else if (count > 16) {
            vm.expectRevert(abi.encodeWithSelector(TooManySteps.selector, count, 16));
            registry.create(steps);
        } else {
            uint256 workflowId = registry.create(steps);
            assertEq(registry.get(workflowId).steps.length, count);
        }
    }
}
