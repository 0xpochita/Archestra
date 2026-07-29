import { Pool } from "pg";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

const BLOCK_SEED = [
  {
    kind: "trigger",
    label: "Start",
    group_name: "Trigger",
    description: "Starts the run on a schedule or on demand.",
    subtitle: "schedule on Arc",
    params: [{ id: "schedule", label: "Schedule", value: "Daily" }],
    sort_order: 0,
  },
  {
    kind: "approve",
    label: "Approve Token",
    group_name: "Setup",
    description: "Grant spender allowance for an ERC-20 token.",
    subtitle: "ERC-20 allowance",
    params: [
      { id: "token", label: "Token", value: "USDC" },
      { id: "spender", label: "Spender", value: "Aave V3 Pool" },
      { id: "amount", label: "Amount", value: "Unlimited" },
    ],
    sort_order: 1,
  },
  {
    kind: "deposit",
    label: "Deposit",
    group_name: "Liquidity",
    description: "Supply an asset into a lending pool or vault.",
    subtitle: "Aave V3 Pool",
    params: [
      { id: "asset", label: "Asset", value: "USDC" },
      { id: "amount", label: "Amount", value: "5,000" },
      { id: "chain", label: "Chain", value: "Arc" },
    ],
    sort_order: 2,
  },
  {
    kind: "swap",
    label: "Swap Token",
    group_name: "Trading",
    description: "Route a token trade through a DEX.",
    subtitle: "Uniswap V3",
    params: [
      { id: "from", label: "From", value: "USDC" },
      { id: "to", label: "To", value: "ETH" },
      { id: "slippage", label: "Slippage", value: "0.5%" },
    ],
    sort_order: 3,
  },
  {
    kind: "yield",
    label: "Yield Farm",
    group_name: "Yield",
    description: "Stake an LP position to earn yield.",
    subtitle: "Curve Finance",
    params: [
      { id: "pool", label: "Pool", value: "USDC/USDT" },
      { id: "amount", label: "Amount", value: "All" },
    ],
    sort_order: 4,
  },
  {
    kind: "harvest",
    label: "Harvest Rewards",
    group_name: "Yield",
    description: "Claim earned rewards from a gauge or farm.",
    subtitle: "Curve Gauge",
    params: [{ id: "destination", label: "Destination", value: "Wallet" }],
    sort_order: 5,
  },
  {
    kind: "bridge",
    label: "Bridge Asset",
    group_name: "Routing",
    description: "Move an asset across chains via Chainlink CCIP.",
    subtitle: "Chainlink CCIP",
    params: [
      { id: "asset", label: "Asset", value: "USDC" },
      { id: "fromChain", label: "From Chain", value: "Ethereum" },
      { id: "toChain", label: "To Chain", value: "Arc" },
    ],
    sort_order: 6,
  },
  {
    kind: "withdraw",
    label: "Withdraw",
    group_name: "Liquidity",
    description: "Exit a lending or vault position.",
    subtitle: "Aave V3 Pool",
    params: [
      { id: "asset", label: "Asset", value: "USDC" },
      { id: "amount", label: "Amount", value: "All" },
    ],
    sort_order: 7,
  },
  {
    kind: "condition",
    label: "If Condition",
    group_name: "Logic",
    description: "Branch on a market value from a data feed.",
    subtitle: "Chainlink Data Feed",
    params: [
      { id: "feed", label: "Feed", value: "ETH/USD" },
      { id: "operator", label: "Operator", value: "<" },
      { id: "threshold", label: "Threshold", value: "2000" },
    ],
    sort_order: 8,
  },
  {
    kind: "alert",
    label: "Alert",
    group_name: "Monitoring",
    description: "Notify a channel when triggered.",
    subtitle: "Telegram",
    params: [
      { id: "channel", label: "Channel", value: "@my-channel" },
      { id: "message", label: "Message", value: "Strategy executed" },
    ],
    sort_order: 9,
  },
];

const TEMPLATE_SEED = [
  {
    id: "stable-auto-compound",
    name: "Stablecoin auto-compound",
    description: "Supply USDC, farm the pair and reinvest rewards daily.",
    tokens: ["usdc"],
    kinds: ["trigger", "approve", "deposit", "yield", "harvest"],
    sort_order: 0,
  },
  {
    id: "weekly-dca",
    name: "Weekly DCA",
    description: "Buy ETH with USDC on a weekly schedule.",
    tokens: ["usdc", "eth"],
    kinds: ["trigger", "approve", "swap"],
    sort_order: 1,
  },
  {
    id: "cross-chain-yield",
    name: "Cross-chain yield",
    description: "Bridge USDC to Arc and deposit into the highest-yield pool.",
    tokens: ["usdc"],
    kinds: ["trigger", "approve", "bridge", "deposit", "yield"],
    sort_order: 2,
  },
  {
    id: "guarded-exit",
    name: "Guarded exit",
    description: "Monitor a price feed and exit the position if it drops below a threshold.",
    tokens: ["usdc", "eth"],
    kinds: ["trigger", "condition", "withdraw", "alert"],
    sort_order: 3,
  },
  {
    id: "idle-cash-sweep",
    name: "Idle cash sweep",
    description: "Sweep idle stablecoins into a yield-bearing vault daily.",
    tokens: ["usdc"],
    kinds: ["trigger", "approve", "deposit"],
    sort_order: 4,
  },
  {
    id: "reward-compounding-loop",
    name: "Reward compounding loop",
    description: "Harvest rewards and re-deposit them to compound returns.",
    tokens: ["usdc"],
    kinds: ["trigger", "harvest", "approve", "deposit", "yield"],
    sort_order: 5,
  },
  {
    id: "risk-off-unwind",
    name: "Risk-off unwind",
    description: "Withdraw from yield positions and bridge assets to safety on a signal.",
    tokens: ["usdc", "eth"],
    kinds: ["trigger", "condition", "withdraw", "bridge", "alert"],
    sort_order: 6,
  },
  {
    id: "lp-bootstrap",
    name: "LP bootstrap",
    description: "Swap half a position to the pair token and provide liquidity.",
    tokens: ["usdc", "eth"],
    kinds: ["trigger", "approve", "swap", "deposit", "yield"],
    sort_order: 7,
  },
];

async function seed(): Promise<void> {
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const block of BLOCK_SEED) {
      await client.query(
        `INSERT INTO blocks (kind, label, group_name, description, subtitle, params, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (kind) DO UPDATE SET
           label = EXCLUDED.label,
           group_name = EXCLUDED.group_name,
           description = EXCLUDED.description,
           subtitle = EXCLUDED.subtitle,
           params = EXCLUDED.params,
           sort_order = EXCLUDED.sort_order`,
        [
          block.kind,
          block.label,
          block.group_name,
          block.description,
          block.subtitle,
          JSON.stringify(block.params),
          block.sort_order,
        ],
      );
    }

    for (const template of TEMPLATE_SEED) {
      await client.query(
        `INSERT INTO templates (id, name, description, tokens, kinds, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           tokens = EXCLUDED.tokens,
           kinds = EXCLUDED.kinds,
           sort_order = EXCLUDED.sort_order`,
        [
          template.id,
          template.name,
          template.description,
          JSON.stringify(template.tokens),
          JSON.stringify(template.kinds),
          template.sort_order,
        ],
      );
    }

    await client.query("COMMIT");
    logger.info("seed complete", {
      blocks: BLOCK_SEED.length,
      templates: TEMPLATE_SEED.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error("seed failed", { message: String(err) });
    process.exit(1);
  });
