// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StepType} from "./Types.sol";

/// @notice One protocol integration. The executor stays generic by only speaking this interface.
interface IStepAdapter {
    /// @notice Executes one step with funds pulled from the vault.
    /// @param vault The vault to pull from and return every output token to.
    /// @param params The step's ABI encoded parameters, see the encoding table on Step.
    /// @return tokenOut The token sent back to the vault, zero address when none.
    /// @return amountOut The amount sent back to the vault.
    /// @dev Pulls at most the allowance the executor set for this step.
    ///      Holds no balance after returning. Never reads msg.sender for authorisation.
    function execute(address vault, bytes calldata params) external returns (address tokenOut, uint256 amountOut);

    /// @notice The token and amount this adapter will pull from the vault for the given params.
    /// @param params The step's ABI encoded parameters.
    /// @return tokenIn The token to be pulled, the zero address when the step pulls nothing.
    /// @return amountIn The amount to be pulled, type(uint256).max for the vault's whole balance.
    function pullPlan(bytes calldata params) external view returns (address tokenIn, uint256 amountIn);

    /// @notice The single step type this adapter serves.
    /// @return stepType The supported step type.
    function supportedType() external view returns (StepType stepType);
}
