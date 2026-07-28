// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice The ten step kinds a workflow can contain, mapped one to one from the studio's block kinds.
enum StepType {
    TRIGGER,
    APPROVE,
    SUPPLY,
    SWAP,
    STAKE,
    CLAIM,
    BRIDGE,
    REDEEM,
    GUARD,
    NOTIFY
}

/// @notice One executable step inside a workflow.
/// @dev `params` is ABI encoded per step type. The encodings are fixed and shared with the backend:
///  TRIGGER: abi.encode(uint64 intervalSeconds, uint64 startAt)
///  APPROVE: abi.encode(address token, address spender, uint256 amount)
///  SUPPLY:  abi.encode(address asset, uint256 amount)
///  SWAP:    abi.encode(address tokenIn, address tokenOut, uint256 amountIn,
///           uint256 minAmountOut, uint24 feeTier, uint64 deadline)
///  STAKE:   abi.encode(address pool, address gauge, uint256 amount, uint256 minLpOut)
///  CLAIM:   abi.encode(address gauge, uint256 minValueOut)
///  BRIDGE:  abi.encode(uint64 destinationChainSelector, address receiver, address token, uint256 amount)
///  REDEEM:  abi.encode(address asset, uint256 amount)
///  GUARD:   abi.encode(address feed, int256 bound, uint8 comparator, uint64 maxStaleSeconds)
///  NOTIFY:  abi.encode(bytes32 channel, bytes32 messageId)
/// An amount of type(uint256).max means the vault's whole balance of that token
/// for SUPPLY, SWAP, STAKE and REDEEM. The executor resolves it before the adapter call.
/// GUARD comparator: 0 stops the run when the answer is below bound, 1 stops when it is above.
struct Step {
    StepType stepType;
    address adapter;
    bytes params;
}

/// @notice A stored workflow: owner, vault, creation time, active flag and the ordered step list.
/// @dev Steps are stored in the topological order the backend computed. The executor never sorts.
struct Workflow {
    address owner;
    address vault;
    uint64 createdAt;
    bool active;
    Step[] steps;
}
