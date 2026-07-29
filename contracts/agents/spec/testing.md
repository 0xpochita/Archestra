# Testing and Security Spec

Foundry only. Three layers: unit, fuzz, invariant, plus fork tests for adapters.

## 1. Mocks

Live in `test/mocks/`, never imported from `src/`.

| Mock | Stands in for | Behaviour |
| --- | --- | --- |
| `MockERC20` | USDC, WETH | mintable, 6 and 18 decimals variants |
| `MockAavePool` | Aave V3 Pool | 1:1 aToken mint on supply, burn on redeem |
| `MockSwapRouter` | Uniswap V3 router | fixed rate from a settable price, honours `minAmountOut` |
| `MockGauge` | Curve gauge | accrues a settable reward per second |
| `MockAggregator` | Chainlink feed | settable answer and `updatedAt`, so staleness is testable |
| `MockCcipRouter` | CCIP router | records the message, burns the token |
| `RevertingAdapter` | failure path | always reverts with a known selector |

Decimals matter. USDC is 6 decimals in every test, and a test that only passes with 18 is a bug in the test.

## 2. Unit tests

One file per contract, `test/unit/<Contract>.t.sol`.

Required cases per contract:

- Happy path for every external function.
- Every custom error in `interfaces.md` section 8 has a test asserting the selector.
- Access control: a non owner, a non executor, and a random address each get the expected revert.
- Paused system: execution reverts, vault withdrawal still works.
- Executor swap: after `setExecutor`, the old executor can neither run workflows nor set allowances, and no allowance survives the swap.

## 3. Fuzz tests

`test/fuzz/`. Minimum runs 10000 in CI.

- `SWAP` with fuzzed `amountIn` and `minAmountOut`: either the output is at least `minAmountOut` or the call reverts with `InsufficientOutput`.
- `SUPPLY` then `REDEEM` with a fuzzed amount returns the same balance to the vault, no rounding leak in the vault's favour or the user's.
- `GUARD` with a fuzzed answer and bound: `shouldContinue` matches the comparator, always.
- Step list length fuzzed from 0 to 32: 0 reverts `EmptyWorkflow`, above 16 reverts `TooManySteps`.

## 4. Invariant tests

`test/invariant/`. Handler based, at least 256 runs and depth 64 in CI.

| Invariant | Statement |
| --- | --- |
| `INV-1` | The executor holds zero balance of every tracked token after any run. |
| `INV-2` | No token allowance from a vault to an adapter is non zero outside a run. |
| `INV-3` | The sum of vault balances plus positions never decreases from an operation the user did not initiate. |
| `INV-4` | A paused system executes zero steps. |
| `INV-5` | Every `StepExecuted` position is unique inside one `runId` and strictly increasing. |
| `INV-6` | A workflow never executes more steps than its stored step count. |
| `INV-7` | `withdraw` by the vault owner succeeds in every reachable state, including paused, sessionless, and after any executor publish, retire or accept. |
| `INV-8` | `approveAdapter` with a non zero amount never succeeds for a caller that is not both owner accepted and registry published, and never without an active session. |
| `INV-9` | The day bucketed session accumulator never exceeds `maxPerDay`, and no single grant exceeds `maxPerRun`, with `type(uint256).max` resolved before the check. |

## 5. Security review checklist

Reviewed by a second person before merge, for every PR that touches `src/core` or `src/adapters`.

- [ ] Checks, effects, interactions order holds in every function that calls out.
- [ ] `nonReentrant` present where value moves then an external call happens.
- [ ] `SafeERC20` used everywhere, no bare `transfer` or `approve`.
- [ ] Allowance reset to zero in the same transaction that set it.
- [ ] Adapter target validated against the registry allow list.
- [ ] No `delegatecall`, no `tx.origin`, no arbitrary `call` to user input.
- [ ] Slippage and deadline are caller supplied and enforced.
- [ ] Feed reads check staleness and a positive answer.
- [ ] Loops bounded by `MAX_STEPS`.
- [ ] Every external function reverts before initialisation completes.
- [ ] No new storage variable inserted above an existing one if any contract is proxied.
- [ ] Events emitted for every state change the backend indexes.
- [ ] The owner withdrawal path still works in every state the change introduces. `INV-7` has a test.

## 6. Fork tests

`test/fork/`, run against Arc testnet with `--fork-url $ARC_TESTNET_RPC`. Skipped when the variable is absent so local runs stay fast.

Covered: `AaveAdapter` supply and redeem, `UniswapAdapter` swap on a real pool, `CcipAdapter` send. Each asserts the vault balance change, not just a successful call.

## 7. Gas

`forge snapshot` committed as `.gas-snapshot`. CI fails on a regression above 5 percent. Reference budget for the studio's demo strategy (trigger, approve, deposit, swap, yield, harvest): under 900k gas for the whole run.

## 8. CI

```
forge fmt --check
forge build --sizes
forge test -vvv
forge coverage --report summary
forge snapshot --check
```

Contract size is checked because an executor with ten step branches drifts toward the 24kB limit. Keep adapters separate for that reason.
