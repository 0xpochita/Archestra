// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Step, StepType, Workflow} from "./Types.sol";

/// @notice Stores workflow definitions and the adapter allow list, and holds the set of
///         published executor versions vaults may accept.
interface IWorkflowRegistry {
    event WorkflowCreated(uint256 indexed workflowId, address indexed owner, address vault, uint256 stepCount);
    event WorkflowUpdated(uint256 indexed workflowId, uint256 stepCount);
    event ExecutorPublished(address indexed newExecutor);
    event ExecutorRetired(address indexed oldExecutor);

    /// @notice Stores a new workflow for the caller and deploys their vault on first use.
    /// @param steps The ordered step list, already topologically sorted by the backend.
    /// @return workflowId The id of the stored workflow.
    /// @dev Reverts with EmptyWorkflow, TooManySteps or AdapterNotAllowed.
    function create(Step[] calldata steps) external returns (uint256 workflowId);

    /// @notice Replaces the step list of an existing workflow.
    /// @param workflowId The workflow to update.
    /// @param steps The new ordered step list.
    /// @dev Reverts with NotOwner, EmptyWorkflow, TooManySteps or AdapterNotAllowed.
    ///      Reverts while a run for this workflow is in flight.
    function update(uint256 workflowId, Step[] calldata steps) external;

    /// @notice Activates or deactivates a workflow.
    /// @param workflowId The workflow to toggle.
    /// @param active The new active flag.
    /// @dev Reverts with NotOwner.
    function setActive(uint256 workflowId, bool active) external;

    /// @notice Adds an executor deployment to the published set and records it as the latest.
    /// @param newExecutor The executor contract vault owners may now accept.
    /// @dev DEFAULT_ADMIN_ROLE only. Publishing alone directs no funds: a vault only obeys
    ///      the executor its own owner accepted. Emits ExecutorPublished. Reverts with ZeroAddress.
    function publishExecutor(address newExecutor) external;

    /// @notice Removes an executor deployment from the published set.
    /// @param oldExecutor The executor contract that may no longer run workflows.
    /// @dev DEFAULT_ADMIN_ROLE only. Retiring can only stop runs, never move funds, and never
    ///      blocks a vault withdrawal. Emits ExecutorRetired. Reverts with ZeroAddress.
    function retireExecutor(address oldExecutor) external;

    /// @notice Marks a workflow's run as started or ended, blocking updates while in flight.
    /// @param workflowId The workflow being run.
    /// @param inFlight True at run start, false at run end.
    /// @dev Callable by any published executor, so vaults bound to an older accepted version
    ///      keep running during a migration window. Reverts with NotExecutor.
    function setRunInFlight(uint256 workflowId, bool inFlight) external;

    /// @notice Reads a stored workflow.
    /// @param workflowId The workflow to read.
    /// @return workflow The stored workflow, bytes identical to what was created.
    function get(uint256 workflowId) external view returns (Workflow memory workflow);

    /// @notice Whether an adapter may execute a given step type.
    /// @param adapter The adapter address to check.
    /// @param stepType The step type it would execute.
    /// @return allowed True when the pair is allow listed.
    function isAdapterAllowed(address adapter, StepType stepType) external view returns (bool allowed);

    /// @notice The latest published executor, for discovery and backend configuration.
    /// @return executorAddress The latest published executor, or the zero address when it was retired.
    function executor() external view returns (address executorAddress);

    /// @notice Whether an address is currently in the published executor set.
    /// @param candidate The address to check.
    /// @return published True while the address may run workflows.
    function isExecutor(address candidate) external view returns (bool published);
}
