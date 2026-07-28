# Smart Contract Rules

Mandatory for every contributor (human or AI) working in `contracts/`. This code moves user funds. Treat every rule as a hard gate, not a preference.

### Non-Negotiables

1. **Checks, effects, interactions**, in that order, in every function that touches an external address.
2. **No unbounded loops** over user controlled arrays in a state changing function.
3. **Custom errors only**, never `require` with a string.
4. **Every external function has an access control decision**, even if that decision is "anyone".
5. **Never use the em-dash character.** A hyphen, a colon, or a rewritten sentence replaces it anywhere: code, NatSpec, docs, commits.
6. **No private key, mnemonic, or RPC URL with an embedded key is ever committed.** `.env` is gitignored before the first line of code.

---

## 1. Toolchain

- Solidity `0.8.26`, pinned exactly in `foundry.toml`. No floating pragma in source files: `pragma solidity 0.8.26;`.
- **Foundry** for build, test, and scripts. Hardhat is not used.
- `forge fmt` is the formatter. CI fails on a diff.
- Dependencies through `forge install` with a pinned commit. OpenZeppelin contracts are the default for ERC20, access control, pausing, and reentrancy.
- Optimizer on, `runs = 200`, unless a measured reason says otherwise.

## 2. Repository Layout

```
contracts/
├── src/
│   ├── core/          # WorkflowRegistry, Executor, StrategyVault
│   ├── adapters/      # one adapter per protocol
│   ├── modules/       # Guard, Automation trigger
│   ├── interfaces/    # I*.sol, no implementation
│   └── libraries/     # pure helpers
├── test/
│   ├── unit/
│   ├── fuzz/
│   ├── invariant/
│   └── mocks/
├── script/            # Deploy*.s.sol
└── foundry.toml
```

Interfaces live in `interfaces/` and are the only thing another contract imports. Importing a concrete implementation across module boundaries is forbidden.

## 3. Commits and Pushes

Conventional Commits, same table as the backend. Extra rules:

- A commit that changes a deployed contract's storage layout says so in the body.
- Never force push a branch that a deployment references.
- Deployment artifacts (`broadcast/`) are committed only for testnet and mainnet runs, never for local ones.

## 4. Coding Standard

- Order inside a contract: type declarations, state variables, events, errors, modifiers, constructor, external, public, internal, private. View and pure last within each visibility.
- Storage variables are `private` with an explicit getter when external reads are needed.
- Mark everything `immutable` or `constant` that can be.
- Named parameters for structs with more than three fields.
- No comments explaining what the code does. NatSpec on every external and public function describing intent, parameters, returns, and reverts. NatSpec is documentation, not commentary.
- Function and variable names spell the unit: `amountIn`, `minAmountOut`, `deadlineTimestamp`, `bpsFee`.

## 5. Security Rules

- `nonReentrant` on every function that transfers value and then calls out.
- Pull over push for payouts where practical.
- Use `SafeERC20`. Never assume `transfer` returns a bool.
- Approve exactly what is needed, then reset to zero after the call. Infinite approval is only allowed with an explicit written reason in the PR.
- Validate every adapter target against an allow list held in the registry. An arbitrary `call` to a user supplied address is forbidden.
- `delegatecall` is forbidden in any contract we write. The only delegatecall in the system is the EIP-1167 clone runtime, which is not our code.
- No `tx.origin`. No `block.timestamp` as a randomness source.
- Slippage and deadline are always caller supplied for swap and bridge steps. A default of zero slippage protection is a bug.
- Price and APY reads come from a Chainlink feed with staleness and answer bound checks, never from a spot pool reserve.
- Every external function that can be called before initialisation reverts.

## 6. Testing

- Every contract has unit tests. Every money path also has fuzz tests. The vault and the executor also have invariant tests.
- Invariants at minimum: vault accounting never lets a user withdraw more than deposited plus yield, the executor never leaves an approval above zero after a run, a paused system executes nothing.
- Fork tests run against Arc testnet for adapters that talk to a real protocol.
- Revert tests assert the custom error selector, not a substring.
- Coverage gate: 90 percent lines and 85 percent branches on `src/core` and `src/adapters`. `forge coverage` runs in CI.
- Mocks live in `test/mocks/` and are never imported from `src/`.

## 7. Gas

- Report gas with `forge snapshot`, commit `.gas-snapshot`, and CI fails on a regression above 5 percent without a note in the PR.
- Cache storage reads in memory inside loops. Prefer `calldata` over `memory` for external function arrays.

## 8. Upgrades and Deployment

- Decision (2026-07-29): no contract in this system is upgradeable. Iteration happens through redeploy and re-pointing, not proxies:
  - `VaultFactory` is a separate, permanent, immutable contract. Vault addresses are CREATE2 derived from the owner and survive any registry or executor replacement.
  - The registry holds a mutable `executor` address behind `DEFAULT_ADMIN_ROLE`. Replacing the executor is deploy plus `setExecutor`, not an upgrade.
  - A registry defect is handled by redeploying the registry and reseeding it from the backend, which owns the source of truth for graphs. The reseed runbook is written during M5.
- Rejected alternatives, do not re-propose without new facts: UUPS on registry or executor (same admin power as the pointer, more failure modes), BeaconProxy vaults (one key rewrites custody logic for every user at once), UUPS on clones (impossible, the ERC-1967 slot of a clone is empty).
- Revisit trigger: mainnet, an external audit being scoped, or a second consumer hardcoding addresses. The pre-scoped fallback is UUPS on `WorkflowRegistry` only, with ERC-7201 namespaced storage, `_disableInitializers()` in the implementation constructor, and a storage layout diff gate in CI.
- Deployment happens through a `script/Deploy*.s.sol` that is idempotent and reads addresses from environment variables.
- Every deployment records address, commit hash, constructor arguments, and verification status in `deployments/<chain>.json`.
- Contracts are verified on the explorer in the same session they are deployed.

## 9. Definition of Done

- [ ] `forge build` clean, no warnings.
- [ ] `forge fmt --check` clean.
- [ ] `forge test` green, including fuzz and invariant runs.
- [ ] `forge coverage` meets the gate.
- [ ] `.gas-snapshot` updated.
- [ ] NatSpec complete on every external and public function.
- [ ] Custom errors used, no string reverts.
- [ ] Access control on every state changing external function.
- [ ] Security checklist in `agents/spec/testing.md` section 5 reviewed by a second person.
- [ ] No secret or key in the diff.
