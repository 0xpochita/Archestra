import { type Address, getAddress } from "viem";
import type { BlockKind } from "@/types/block";
import { ARC_TESTNET_DEPLOYMENT } from "./generated";

export const STEP_TYPE: Record<BlockKind, number> = {
  trigger: 0,
  approve: 1,
  deposit: 2,
  swap: 3,
  yield: 4,
  harvest: 5,
  bridge: 6,
  withdraw: 7,
  condition: 8,
  alert: 9,
};

const { adapters, core } = ARC_TESTNET_DEPLOYMENT;

export const STEP_ADAPTER: Record<BlockKind, Address> = {
  trigger: getAddress(core.automationTrigger),
  approve: getAddress(core.executor),
  deposit: getAddress(adapters.supply),
  swap: getAddress(adapters.swap),
  yield: getAddress(adapters.stake),
  harvest: getAddress(adapters.claim),
  bridge: getAddress(adapters.bridge),
  withdraw: getAddress(adapters.redeem),
  condition: getAddress(core.guardModule),
  alert: getAddress(core.executor),
};

export const CURVE_POOL_ADDRESS = getAddress(adapters.curvePool);
export const CURVE_GAUGE_ADDRESS = getAddress(adapters.gauge);
