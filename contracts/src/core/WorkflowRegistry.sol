// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {
    AdapterNotAllowed,
    EmptyWorkflow,
    NotExecutor,
    NotOwner,
    RunInFlight,
    TooManySteps,
    ZeroAddress
} from "../interfaces/Errors.sol";
import {IVaultFactory} from "../interfaces/IVaultFactory.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";
import {Step, StepType, Workflow} from "../interfaces/Types.sol";

/// @notice Stores workflow definitions, the adapter allow list and the executor pointer.
/// @dev Replaceable by redeploy and reseed: graphs are backend owned, vault addresses
///      live in the immutable VaultFactory, so no state here is precious.
contract WorkflowRegistry is IWorkflowRegistry, AccessControl {
    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");
    uint256 public constant MAX_STEPS = 16;

    IVaultFactory public immutable vaultFactory;

    uint256 private _nextWorkflowId = 1;
    address private _executor;
    mapping(uint256 workflowId => Workflow workflow) private _workflows;
    mapping(address adapter => mapping(StepType stepType => bool allowed)) private _adapterAllowed;
    mapping(uint256 workflowId => bool inFlight) private _runInFlight;

    event AdapterAllowedSet(address indexed adapter, StepType indexed stepType, bool allowed);

    modifier onlyWorkflowOwner(uint256 workflowId) {
        if (msg.sender != _workflows[workflowId].owner) revert NotOwner();
        _;
    }

    constructor(address vaultFactory_, address admin) {
        if (vaultFactory_ == address(0) || admin == address(0)) revert ZeroAddress();
        vaultFactory = IVaultFactory(vaultFactory_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @inheritdoc IWorkflowRegistry
    function create(Step[] calldata steps) external returns (uint256 workflowId) {
        _validateSteps(steps);
        workflowId = _nextWorkflowId++;
        address vault = vaultFactory.predictVault(msg.sender);
        Workflow storage workflow = _workflows[workflowId];
        workflow.owner = msg.sender;
        workflow.vault = vault;
        workflow.createdAt = uint64(block.timestamp);
        workflow.active = true;
        for (uint256 i = 0; i < steps.length; i++) {
            workflow.steps.push(steps[i]);
        }
        vaultFactory.createVault(msg.sender);
        emit WorkflowCreated(workflowId, msg.sender, vault, steps.length);
    }

    /// @inheritdoc IWorkflowRegistry
    function update(uint256 workflowId, Step[] calldata steps) external onlyWorkflowOwner(workflowId) {
        if (_runInFlight[workflowId]) revert RunInFlight();
        _validateSteps(steps);
        Workflow storage workflow = _workflows[workflowId];
        delete workflow.steps;
        for (uint256 i = 0; i < steps.length; i++) {
            workflow.steps.push(steps[i]);
        }
        emit WorkflowUpdated(workflowId, steps.length);
    }

    /// @inheritdoc IWorkflowRegistry
    function setActive(uint256 workflowId, bool active) external onlyWorkflowOwner(workflowId) {
        _workflows[workflowId].active = active;
    }

    /// @inheritdoc IWorkflowRegistry
    function setExecutor(address newExecutor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newExecutor == address(0)) revert ZeroAddress();
        address previous = _executor;
        _executor = newExecutor;
        emit ExecutorChanged(previous, newExecutor);
    }

    /// @notice Adds or removes an adapter for one step type.
    /// @param adapter The adapter address.
    /// @param stepType The step type it may execute.
    /// @param allowed True to allow, false to remove.
    /// @dev CURATOR_ROLE only. Reverts with ZeroAddress.
    function setAdapterAllowed(address adapter, StepType stepType, bool allowed) external onlyRole(CURATOR_ROLE) {
        if (adapter == address(0)) revert ZeroAddress();
        _adapterAllowed[adapter][stepType] = allowed;
        emit AdapterAllowedSet(adapter, stepType, allowed);
    }

    /// @inheritdoc IWorkflowRegistry
    function setRunInFlight(uint256 workflowId, bool inFlight) external {
        if (msg.sender != _executor) revert NotExecutor();
        _runInFlight[workflowId] = inFlight;
    }

    /// @inheritdoc IWorkflowRegistry
    function get(uint256 workflowId) external view returns (Workflow memory workflow) {
        return _workflows[workflowId];
    }

    /// @inheritdoc IWorkflowRegistry
    function isAdapterAllowed(address adapter, StepType stepType) external view returns (bool allowed) {
        return _adapterAllowed[adapter][stepType];
    }

    /// @inheritdoc IWorkflowRegistry
    function executor() external view returns (address executorAddress) {
        return _executor;
    }

    function _validateSteps(Step[] calldata steps) private view {
        if (steps.length == 0) revert EmptyWorkflow();
        if (steps.length > MAX_STEPS) revert TooManySteps(steps.length, MAX_STEPS);
        for (uint256 i = 0; i < steps.length; i++) {
            if (!_adapterAllowed[steps[i].adapter][steps[i].stepType]) {
                revert AdapterNotAllowed(steps[i].adapter, steps[i].stepType);
            }
        }
    }
}
