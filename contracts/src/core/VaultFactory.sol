// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ZeroAddress} from "../interfaces/Errors.sol";
import {IVaultFactory} from "../interfaces/IVaultFactory.sol";
import {StrategyVault} from "./StrategyVault.sol";

/// @notice Deploys one StrategyVault clone per owner at a CREATE2 derived address.
/// @dev Permanent and immutable. Vault addresses depend only on this factory and its
///      implementation, never on the registry, so they survive a registry redeploy.
contract VaultFactory is IVaultFactory {
    using Clones for address;

    address public immutable implementation;
    address public immutable registry;

    mapping(address owner => address vault) private _vaultOf;

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroAddress();
        implementation = address(new StrategyVault());
        registry = registry_;
    }

    /// @inheritdoc IVaultFactory
    function createVault(address owner) external returns (address vault) {
        if (owner == address(0)) revert ZeroAddress();
        vault = _vaultOf[owner];
        if (vault != address(0)) return vault;
        vault = implementation.cloneDeterministic(_salt(owner));
        StrategyVault(vault).initialize(owner, registry);
        _vaultOf[owner] = vault;
        emit VaultCreated(owner, vault);
    }

    /// @inheritdoc IVaultFactory
    function vaultOf(address owner) external view returns (address vault) {
        return _vaultOf[owner];
    }

    /// @inheritdoc IVaultFactory
    function predictVault(address owner) external view returns (address vault) {
        return implementation.predictDeterministicAddress(_salt(owner), address(this));
    }

    function _salt(address owner) private pure returns (bytes32) {
        return bytes32(uint256(uint160(owner)));
    }
}
