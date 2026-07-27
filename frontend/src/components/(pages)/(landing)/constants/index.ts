import type {
  FlowCard,
  FlowConnector,
  FooterGroup,
  HeroWord,
  NavLink,
} from "../types";

export const BRAND_LOGO_SRC =
  "/assets/images/logo/logo-brands/logo-archestra.png";
export const STUDIO_PATH = "/studio";

export const HERO_HEADLINE = "Automating complex DeFi strategies";
export const HERO_SUPPORT =
  "Compose deposits, swaps and yield farming as blocks, simulate the whole run, then ship it to Arc.";

export const NAV_LINKS: NavLink[] = [
  { label: "Product", hasMenu: true },
  { label: "Protocols", hasMenu: false },
  { label: "Resources", hasMenu: true },
  { label: "Company", hasMenu: true },
];

export const HERO_WORDS: HeroWord[] = [
  { label: "Deposit", logo: "aave" },
  { label: "Swap", logo: "uniswap" },
  { label: "Yield farm", logo: "curve" },
  { label: "Harvest", logo: "curve" },
  { label: "Bridge", logo: "chainlink" },
  { label: "Rebalance", logo: "uniswap" },
  { label: "Auto-compound", logo: "curve" },
  { label: "Withdraw", logo: "aave" },
  { label: "Alert", logo: "telegram" },
];

export const FOOTER_TAGLINE =
  "A visual builder for DeFi automation: deposit, swap, farm and monitor without writing a contract.";

export const FOOTER_GROUPS: FooterGroup[] = [
  {
    title: "Product",
    links: ["Workflow studio", "Block library", "Strategy templates"],
  },
  {
    title: "Protocols",
    links: ["Aave", "Uniswap", "Curve", "Chainlink"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Security", "Contact"],
  },
];

export const FOOTER_COPYRIGHT = "2026 Archestra";
export const FOOTER_NOTE = "Testnet mock. No funds move on Arc yet.";

export const FLOW_WIDTH = 1360;
export const FLOW_HEIGHT = 320;

export const FLOW_CARDS: FlowCard[] = [
  {
    id: "start",
    title: "Start",
    subtitle: "Every 24 hours",
    logo: "usdc",
    x: 0,
    y: 124,
    width: 240,
  },
  {
    id: "deposit",
    title: "Deposit",
    subtitle: "Aave V3 Pool",
    logo: "aave",
    x: 290,
    y: 124,
    width: 240,
  },
  {
    id: "swap",
    title: "Swap Token",
    subtitle: "Uniswap V3",
    logo: "uniswap",
    x: 580,
    y: 124,
    width: 240,
  },
  {
    id: "split",
    title: "Split out",
    subtitle: "Routing",
    logo: "chainlink",
    x: 870,
    y: 124,
    width: 240,
  },
  {
    id: "yield",
    title: "Yield Farm",
    subtitle: "Curve Finance",
    logo: "curve",
    x: 1140,
    y: 24,
    width: 220,
  },
  {
    id: "alert",
    title: "Alert",
    subtitle: "Telegram",
    logo: "telegram",
    x: 1140,
    y: 224,
    width: 220,
  },
];

export const FLOW_CONNECTORS: FlowConnector[] = [
  { id: "start-deposit", path: "M240 160 H290" },
  { id: "deposit-swap", path: "M530 160 H580" },
  { id: "swap-split", path: "M820 160 H870" },
  {
    id: "split-yield",
    path: "M1110 160 H1120 Q1130 160 1130 150 V70 Q1130 60 1140 60",
    label: "APY high",
    labelX: 1130,
    labelY: 112,
  },
  {
    id: "split-alert",
    path: "M1110 160 H1120 Q1130 160 1130 170 V250 Q1130 260 1140 260",
    label: "APY low",
    labelX: 1130,
    labelY: 208,
  },
];

export const FLOW_TRUNK_START = 240;
export const FLOW_TRUNK_END = 1110;
