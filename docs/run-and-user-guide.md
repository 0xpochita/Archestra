# Archestra Run & User Guide

Panduan untuk menjalankan project secara lokal dan mencoba flow sebagai user. Bahasa campur sengaja: commands tetap English, penjelasan dibuat praktis.

**Last updated:** 2026-08-01

---

## 1. Prerequisites

Install dulu:

- Node.js 22+
- pnpm
- PostgreSQL 16+ atau Docker
- Foundry (`forge`) untuk contracts
- MetaMask extension
- Git

Recommended ports:

| Service | Port |
|---|---|
| Frontend | `3000` |
| Backend | `8787` |
| PostgreSQL | `5432` |

---

## 2. Run Backend Locally

### 2.1 Setup database

Kalau pakai PostgreSQL lokal:

```bash
psql -U postgres -c "CREATE DATABASE archestra;"
```

Kalau database sudah ada, skip.

### 2.2 Setup backend env

```bash
cd backend
cp .env.example .env
```

Untuk local mock mode:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/archestra
PORT=8787
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000
CHAIN_ADAPTER=mock
AI_PLANNER=rules
```

Untuk Arc mode:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/archestra
PORT=8787
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000
CHAIN_ADAPTER=arc
AI_PLANNER=rules
RPC_URL=https://rpc.testnet.arc.io
CHAIN_ID=5042002
REGISTRY_ADDRESS=0x88d8Cd3009cd7905ec0E7f895c772Edd9878b42F
```

### 2.3 Build, migrate, seed

```bash
cd backend
pnpm install
pnpm build
node --env-file=.env dist/db/migrate.js
node --env-file=.env dist/db/seed.js
```

### 2.4 Start backend

```bash
node --env-file=.env dist/index.js
```

Check:

```bash
curl http://localhost:8787/v1/health
```

Expected:

```json
{"data":{"status":"ok","database":"ok","uptimeSeconds":1}}
```

API docs:

```text
http://localhost:8787/v1/docs
```

---

## 3. Run Frontend Locally

### 3.1 Install dependencies

```bash
cd frontend
pnpm install --config.minimumReleaseAge=0
```

Kenapa pakai `minimumReleaseAge=0`? Karena pnpm supply-chain policy kadang menolak package baru di lockfile.

### 3.2 Optional RPC fallback

Kalau ada error `Request is being rate limited`, buat `frontend/.env.local`:

```env
NEXT_PUBLIC_ARC_RPC_URL=https://arc-testnet.drpc.org
```

Fallback lain:

```env
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.blockdaemon.testnet.arc.network
```

### 3.3 Start frontend

Windows:

```bash
node_modules/.bin/next.cmd dev
```

Unix/macOS:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

---

## 4. Run Contracts Locally

```bash
cd contracts
forge build
forge test
```

Exports used by frontend/backend:

```text
contracts/exports/abi/*.json
contracts/exports/addresses.arc-testnet.json
```

If contracts change, sync generated files in frontend/backend before testing.

---

## 5. Stop Running Processes

Windows PowerShell:

```powershell
netstat -ano | findstr ":3000"
netstat -ano | findstr ":8787"
Stop-Process -Id <PID> -Force
```

PostgreSQL local service (optional):

```powershell
Stop-Service -Name "postgresql-x64-18"
Start-Service -Name "postgresql-x64-18"
```

---

## 6. User Walkthrough — Mock Mode

Use this when no wallet / no Arc RPC is available.

1. Set backend:
   ```env
   CHAIN_ADAPTER=mock
   ```
2. Start backend + frontend.
3. Open `http://localhost:3000/workflows`.
4. Pick a template, e.g. **Stablecoin auto-compound**.
5. Open Studio.
6. Click **Simulate strategy**.
7. Canvas animates locally.

This mode is good for demo backup. No real chain tx.

---

## 7. User Walkthrough — Arc Testnet

Use this for real on-chain demo.

### 7.1 Setup MetaMask

Add Arc Testnet manually:

```text
Network name: Arc Testnet
RPC URL: https://rpc.testnet.arc.io
Chain ID: 5042002
Currency symbol: USDC
Block explorer: empty / optional
```

If RPC rate-limits, change MetaMask RPC URL to:

```text
https://arc-testnet.drpc.org
```

### 7.2 Get gas token

Arc testnet uses USDC native for gas. Use the Arc/Circle testnet faucet or the faucet recommended by hackathon organizers.

Minimum recommended balance:

```text
5 USDC native
```

### 7.3 Connect wallet

1. Open `http://localhost:3000/workflows`.
2. Click **Connect Wallet**.
3. Select MetaMask.
4. Switch to Arc Testnet if prompted.

### 7.4 Pick strategy

Use a simple strategy first:

- **Stablecoin auto-compound**
- **Weekly ETH accumulation**
- **Idle cash sweep**

Avoid these until price feed is deployed:

- **Guarded farm exit**
- **Risk-off unwind**

Reason: `condition` block needs `MockAggregator` / price feed.

### 7.5 Mint demo tokens

In Studio right panel:

1. Under **Move Funds**, input `10` in dUSDC.
2. Click **Mint**.
3. Approve tx in MetaMask.
4. Wait until confirmed.

Optional: mint dWETH too if testing swap.

If error says `Request is being rate limited`, wait 1-2 minutes or switch RPC to `drpc.org`.

### 7.6 Create workflow on chain

Click:

```text
Create on chain
```

Approve tx in MetaMask. This creates the workflow in `WorkflowRegistry`.

### 7.7 Create / verify vault

The UI shows a predicted vault address before first workflow. After creating on-chain workflow, vault should exist.

Panel should show:

- Vault address
- Token balances
- Session section

### 7.8 Open spending session

Open a session for dUSDC.

Recommended test values:

```text
Max per run: 1000
Max per day: 5000
Duration: 7 days
```

Approve tx.

### 7.9 Fund vault

In **Move Funds**:

1. Input dUSDC amount, e.g. `5`.
2. Click **Fund vault**.
3. Approve tx.

### 7.10 Run strategy

Click:

```text
Run strategy
```

Expected backend-mediated target flow:

```text
Frontend calls backend /runs
Backend returns calldata
Wallet signs tx
Frontend reports txHash to backend
Backend indexes receipt
Frontend receives SSE events
Canvas lights up
```

Current frontend may still run contracts directly until INT-01 is implemented.

---

## 8. Backend API Testing With Scalar

Open:

```text
http://localhost:8787/v1/docs
```

For protected endpoints, set auth header:

```text
Name: x-owner-id
Value: user-test-1
```

Do not set `Name: user-test-1`. Header name must be `x-owner-id`.

### Minimal API flow

1. Health:
   ```http
   GET /v1/health
   ```
2. Catalog:
   ```http
   GET /v1/blocks
   GET /v1/templates
   ```
3. Create workflow:
   ```json
   { "name": "My First Workflow" }
   ```
4. Create from template:
   ```json
   { "name": "Auto Compound", "templateId": "stable-auto-compound" }
   ```
5. Simulate:
   ```http
   POST /v1/workflows/:id/simulate
   ```
6. Start live run:
   ```http
   POST /v1/workflows/:id/runs
   ```
7. Attach tx hash:
   ```json
   { "txHash": "0x..." }
   ```

---

## 9. Common Errors

### `EADDRINUSE: address already in use :::8787`

Backend already running. Kill old process:

```powershell
netstat -ano | findstr ":8787"
Stop-Process -Id <PID> -Force
```

### `Cannot find module dist/db/migrate.js`

Build first:

```bash
pnpm build
```

### `Missing or unknown owner`

Add header:

```http
x-owner-id: user-test-1
```

### `validation_failed` on workflow create

Do not send empty name:

```json
{ "name": "My First Workflow" }
```

### `Request is being rate limited`

Switch RPC:

```env
NEXT_PUBLIC_ARC_RPC_URL=https://arc-testnet.drpc.org
```

Also update MetaMask Arc Testnet RPC to the same value.

### `Could not read the vault`

Usually RPC timeout/rate limit. Refresh page, switch RPC, or wait 1-2 minutes.

### `condition` block fails

Expected until contracts team deploys price feed / `MockAggregator`.

---

## 10. Demo Checklist

Before presenting:

- Backend health returns `ok`.
- Frontend opens `/workflows`.
- MetaMask connected to Arc Testnet.
- Wallet has native USDC for gas.
- dUSDC minted.
- Vault created and funded.
- Session active.
- Use non-condition template unless price feed is deployed.
- Record a fallback video after one successful run.

Fallback order:

1. Real chain run.
2. Backend simulation.
3. Frontend mock animation.
4. Recorded video.

---

## 11. Useful Commands

### Backend checks

```bash
cd backend
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

### Frontend checks

```bash
cd frontend
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

### Contracts checks

```bash
cd contracts
forge fmt --check
forge build
forge test
```

### VPS deploy backend

```bash
cd /home/ubuntu/Archestra/backend
docker-compose build
docker-compose up -d
docker-compose exec backend node dist/db/migrate.js
docker-compose logs -f backend
```

---

## 12. Where To Continue

Recommended next docs:

- `docs/project-integration-next-steps.md` — full integration roadmap.
- `docs/backend-next-steps.md` — backend task list.
- `docs/backend-progress.md` — detailed backend progress.

Recommended next implementation task:

```text
INT-01 — Wire frontend to backend chain endpoints
```
