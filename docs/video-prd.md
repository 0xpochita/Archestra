# PRD — Archestra Hackathon Video (Remotion)

PRD for producing the Archestra demo video using [Remotion](https://www.remotion.dev). Goal: a clear, fast, end-to-end hackathon video that explains the product.

**Last updated:** 2026-08-02
**Owner:** Media/Frontend team
**Companion docs:**
- [`../README.md`](../README.md)
- [`run-and-user-guide.md`](./run-and-user-guide.md)
- [`frontend-onchain-findings.md`](./frontend-onchain-findings.md)
- [`project-integration-next-steps.md`](./project-integration-next-steps.md)

---

## 1. Goal

Produce one primary video that explains Archestra end to end for hackathon judges.

The video must answer 5 things:

1. What problem it solves.
2. What Archestra is.
3. How it works (short architecture).
4. A real product demo running on-chain on Arc Testnet.
5. Why it deserves to win / roadmap.

Non-goals:

- Not a deep technical tutorial.
- Not API documentation.
- Never show private keys or secrets.

---

## 2. Target Output

| Field | Value |
|---|---|
| Tool | Remotion (React video) |
| Target duration | 120–150 seconds |
| Resolution | 1920×1080 (16:9) |
| FPS | 30 |
| Export format | MP4 (H.264) |
| Narration language | English |
| Subtitles | Optional English captions |
| Orientation | Landscape |

Optional alternative export:

- 1080×1920 (9:16) short version, 45–60 seconds, for social media.

---

## 3. Audience

- Hackathon judges (technical + product).
- DeFi developers.
- People with zero prior knowledge of the product.

Assumption: viewers understand basic wallet + testnet concepts, but do not know Archestra.

---

## 4. Key Messages

Core messages that must appear:

1. "Compose DeFi strategies visually, run them on-chain, safely."
2. "User-owned vault. Nothing moves without your session and signature."
3. "Backend indexes on-chain runs. Frontend just shows progress."
4. "Live on Arc Testnet. Real transactions, real receipts."

Tagline candidate:

```text
Archestra — visual DeFi strategy studio on Arc.
```

---

## 5. Brand & Visual Guidelines

Pulled from the product for consistency.

| Token | Value |
|---|---|
| Brand name | Archestra |
| Primary ink | `#0a0a0a` |
| Background / shell | `#ffffff` |
| Surface raised | `#f5f5f5` |
| Line | `#e5e5e5` |
| Accent brand | `#0a0a0a` (monochrome) |
| On-brand text | `#ffffff` |
| Sans font | Geist Sans |
| Mono font | Geist Mono (for addresses, code, tx hashes) |

Logo assets:

```text
frontend/public/assets/images/logo/logo-brands/logo-archestra.png
frontend/public/assets/images/logo/logo-chain/arc-logo.jpg
frontend/public/assets/images/logo/logo-token/usdc-logo.svg
```

Visual style:

- Clean, monochrome, high contrast.
- Mono font for all on-chain data.
- Subtle motion, nothing flashy.
- Consistent with the product UI (sharp boxes, thin borders, minimal gradients).

---

## 6. Storyboard / Scene List

Total target 120–150s. Each scene has a duration, visual, and narration.

### Scene 1 — Hook (0:00–0:10)

- Visual: Archestra logo fade-in on white, thin workflow lines animating.
- On-screen text: `Compose. Simulate. Run DeFi on-chain.`
- Narration:
  > "DeFi strategies are powerful, but building and running them safely is hard."

### Scene 2 — Problem (0:10–0:25)

- Visual: pain points (many tabs, manual approvals, wrong-transfer risk). Simple icons are fine.
- Text: `Manual. Risky. Fragmented.`
- Narration:
  > "Users juggle approvals, unlimited allowances, and blind transactions across many tools."

### Scene 3 — Solution Intro (0:25–0:40)

- Visual: Archestra studio canvas appears with blocks: `Deposit -> Yield Farm`.
- Text: `Archestra: a visual DeFi strategy studio.`
- Narration:
  > "Archestra lets you compose strategies as visual blocks, then run them on-chain through a vault you fully control."

### Scene 4 — How It Works / Architecture (0:40–1:00)

- Visual: animated architecture diagram (a Remotion rebuild of the README mermaid diagram).
- Diagram flow:

```text
Frontend Studio -> Backend (calldata + indexer)
Wallet -> Arc Testnet Contracts
Contracts -> Events -> Backend -> SSE -> Frontend
```

- Highlight text: `User-owned vault`, `Spending session caps`, `On-chain executor`.
- Narration:
  > "The frontend builds the strategy. The backend prepares calldata and indexes results. Your wallet signs. Contracts execute inside your own vault, bounded by spending sessions you approve."

### Scene 5 — Live Demo (1:00–2:00)

Real product screen recording, sped up with zoom highlights. Use the proven happy path.

Demo sequence:

1. Connect wallet to Arc Testnet.
2. Pick the `Stablecoin auto-compound` template.
3. Create workflow on-chain (show `Workflow #N` + registry).
4. Activate the `dUSDC` spending session.
5. Mint + fund the vault with `dUSDC`.
6. Run the strategy.
7. Show the run result:

```text
Run finished with 2 steps
deposit -> 100 aUSDC
yield -> 200 crvLP
Gas used: 402651
```

8. Optional: show the tx on the explorer:

```text
testnet.arcscan.app
Registry: 0x88d8Cd3009cd7905ec0E7f895c772Edd9878b42F
```

- Narration:
  > "Here it runs live on Arc Testnet. Create the workflow, open a session, fund the vault, and execute. Every step is one atomic on-chain run."

### Scene 6 — Safety Model (2:00–2:15)

- Visual: highlight the UI for `Spending sessions`, `Accepted executor`, `Withdraw`.
- Text: `You own the vault. You set the limits.`
- Narration:
  > "No unlimited approvals. Sessions cap per run and per day. Withdrawals always answer to you."

### Scene 7 — Roadmap / Close (2:15–2:30)

- Visual: short roadmap bullets.
- Text:

```text
Next:
Backend-mediated runs
Price-feed conditions
Automation triggers
```

- Narration:
  > "Next, fully backend-mediated runs, price-feed conditions, and automation. Archestra — visual DeFi strategy studio on Arc."
- Ending: Archestra logo + tagline + repo/link.

---

## 7. Remotion Structure

Recommended Remotion project, kept separate from the main app.

Folder:

```text
video/
  package.json
  remotion.config.ts
  src/
    Root.tsx
    Video.tsx
    scenes/
      Scene01Hook.tsx
      Scene02Problem.tsx
      Scene03Solution.tsx
      Scene04Architecture.tsx
      Scene05Demo.tsx
      Scene06Safety.tsx
      Scene07Roadmap.tsx
    components/
      Caption.tsx
      MonoBadge.tsx
      FlowDiagram.tsx
      DeviceFrame.tsx
    theme/
      tokens.ts
    assets/
      logo-archestra.png
      arc-logo.jpg
      demo-recording.mp4
```

`theme/tokens.ts` mirrors the brand:

```ts
export const COLORS = {
  shell: "#ffffff",
  surfaceRaised: "#f5f5f5",
  line: "#e5e5e5",
  ink: "#0a0a0a",
  inkMuted: "#525252",
  onBrand: "#ffffff",
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
```

Main composition:

- A single `<Composition id="ArchestraDemo" />`.
- Compose scenes with `Sequence` using `from` and `durationInFrames`.
- Play the screen capture with `<OffthreadVideo>`.

Example timing (30 fps):

| Scene | Start (frame) | Duration (frame) | Seconds |
|---|---|---|---|
| Hook | 0 | 300 | 0–10 |
| Problem | 300 | 450 | 10–25 |
| Solution | 750 | 450 | 25–40 |
| Architecture | 1200 | 600 | 40–60 |
| Demo | 1800 | 1800 | 60–120 |
| Safety | 3600 | 450 | 120–135 |
| Roadmap | 4050 | 450 | 135–150 |

Total: 4500 frames = 150 seconds.

---

## 8. Assets Needed

Required:

- Archestra logo (transparent PNG).
- Arc logo.
- Full happy-path demo screen recording (a workflow that definitely succeeds).
- Geist Sans + Geist Mono fonts.

Screen recording checklist (record before editing):

1. Use a stable RPC so it does not get rate-limited during capture:

```text
https://rpc.blockdaemon.testnet.arc.network
```

2. Use a fresh workflow (not a broken one).
3. Record the full flow: connect -> create -> session -> fund -> run -> result.
4. Capture a clean take without error popups if possible.
5. Hide sensitive data (personal balances are fine; never show a seed phrase).

Optional:

- Voice-over (AI TTS or recorded manually).
- Low-volume royalty-free background music.

---

## 9. Copy / Script (Full Narration)

Final narration (English):

```text
DeFi strategies are powerful, but running them safely is hard.
Users juggle approvals, unlimited allowances, and blind transactions.

Meet Archestra: a visual DeFi strategy studio.
Compose strategies as blocks, then run them on-chain in a vault you own.

The frontend builds the strategy. The backend prepares calldata and indexes results.
Your wallet signs. Contracts execute inside your own vault, bounded by spending sessions.

Here it runs live on Arc Testnet.
Create the workflow. Open a spending session. Fund the vault. Run.
Every step executes in one atomic on-chain transaction.

You own the vault. You set the limits.
No unlimited approvals. Sessions cap per run and per day. Withdrawals always answer to you.

Next: fully backend-mediated runs, price-feed conditions, and automation.
Archestra — visual DeFi strategy studio on Arc.
```

---

## 10. Production Checklist

Pre-production:

- [ ] Finalize script.
- [ ] Record a clean demo (happy path, no error).
- [ ] Collect logo + font assets.
- [ ] Set up the Remotion project (`npm create video`).

Production:

- [ ] Build scenes 1–7.
- [ ] Sync narration to scene timing.
- [ ] Add captions (optional).
- [ ] Add highlight/zoom in the demo scene.

Post:

- [ ] Render 1080p MP4.
- [ ] QA: audio sync, no clipped text, addresses readable.
- [ ] Optional render 9:16 short version.
- [ ] Upload + fill the hackathon description.

---

## 11. Acceptance Criteria

The video is done when:

1. Duration is 120–150 seconds.
2. It explains problem, solution, architecture, live demo, safety, and roadmap.
3. The demo shows a successful on-chain run with real output:

```text
deposit -> 100 aUSDC
yield -> 200 crvLP
```

4. Brand is consistent (monochrome, Geist, mono font for on-chain data).
5. No secrets/private keys are shown.
6. Renders as a clean 1080p MP4 with no text artifacts.

---

## 12. Risks & Notes

- The Arc Testnet RPC can rate-limit during capture. Re-record if you see `Request is being rate limited`.
- Do not record an old workflow that contains a broken `Approve Token` step. Use the latest template.
- The `condition` block cannot be demoed end to end yet (price feed not deployed). Do not include it in the demo.
- If a live demo is risky, use a proven pre-recorded take instead of running live during the presentation.
