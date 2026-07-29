# Archestra Backend

REST API for the Archestra DeFi workflow studio. Built with Hono, PostgreSQL, and Drizzle ORM.

## Stack

| Layer | Technology |
|---|---|
| HTTP Framework | [Hono](https://hono.dev) |
| Runtime | Node.js 22 LTS |
| Database | PostgreSQL 16+ |
| ORM | Drizzle |
| Validation | Zod |
| Language | TypeScript strict |
| Linter | Biome |
| Testing | Vitest |

## Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL 16+

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/archestra
PORT=8787
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000
CHAIN_ADAPTER=mock
AI_PLANNER=rules
```

### 3. Create database

```bash
psql -U postgres -c "CREATE DATABASE archestra;"
```

### 4. Build, migrate, and seed

```bash
pnpm build
pnpm db:migrate
pnpm db:seed
```

### 5. Start server

```bash
# Production
pnpm start

# Development (watch mode)
pnpm dev
```

Server runs at `http://localhost:8787`.

## API Docs

After starting the server:

- **Scalar UI**: `http://localhost:8787/v1/docs`
- **OpenAPI JSON**: `http://localhost:8787/v1/openapi.json`

## Scripts

| Script | Description |
|---|---|
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run server from `dist/` |
| `pnpm dev` | Run with watch mode |
| `pnpm lint` | Check linting with Biome |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm type-check` | Type check without compiling |
| `pnpm test` | Run unit tests |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed blocks and templates |

## Project Structure

```
src/
├── adapters/        # External ports + mock implementations
│   ├── chain.ts     # ChainAdapter (MockChainAdapter)
│   ├── planner.ts   # PlannerAdapter (RulesPlanner)
│   └── notifier.ts  # NotifierAdapter (MemoryNotifier)
├── db/
│   ├── schema.ts    # Drizzle table definitions
│   ├── client.ts    # Database connection
│   ├── migrate.ts   # Migration runner
│   └── seed.ts      # Seed data
├── domain/          # Pure business logic, no DB or HTTP dependencies
│   ├── graph.ts     # validateGraph, getExecutionOrder
│   ├── planner.ts   # Rules-based AI planner
│   └── template.ts  # Template node builder
├── lib/
│   ├── config.ts    # Zod env parsing
│   ├── errors.ts    # AppError + helpers
│   ├── ids.ts       # ULID generator
│   └── logger.ts    # Structured JSON logger
├── middleware/
│   ├── auth.ts      # x-owner-id header guard
│   ├── error.ts     # Global error handler
│   ├── logger.ts    # Request logger
│   ├── rate-limit.ts # Per-owner rate limiting
│   └── request-id.ts # Request ID injection
├── repositories/    # SQL queries and row mapping
├── routes/          # Thin HTTP handlers
├── schemas/         # Zod schemas (single source of truth for types)
├── services/        # Business rules and transaction boundaries
├── app.ts           # Hono app assembly + dependency injection
└── index.ts         # Server bootstrap
```

## Endpoints

All requests except `/health`, `/blocks`, `/templates`, and `/docs` require:

```
x-owner-id: <owner-id>
```

| Method | Path | Description |
|---|---|---|
| GET | `/v1/health` | Health check |
| GET | `/v1/blocks` | Block catalog |
| GET | `/v1/templates` | Strategy templates |
| GET | `/v1/workflows` | List workflows |
| POST | `/v1/workflows` | Create workflow |
| GET | `/v1/workflows/:id` | Get workflow |
| PATCH | `/v1/workflows/:id` | Update workflow |
| DELETE | `/v1/workflows/:id` | Delete workflow |
| POST | `/v1/workflows/:id/simulate` | Simulate workflow |
| POST | `/v1/workflows/:id/runs` | Start a live run |
| GET | `/v1/workflows/:id/runs` | Run history |
| GET | `/v1/runs/:id` | Get run |
| GET | `/v1/runs/:id/events` | SSE stream for run progress |
| POST | `/v1/assistant/sessions` | Create AI session |
| DELETE | `/v1/assistant/sessions/:id` | Delete session |
| POST | `/v1/assistant/sessions/:id/messages` | Send message |
| POST | `/v1/assistant/drafts/:id/accept` | Accept draft as workflow |

## Error Format

```json
{
  "error": {
    "code": "not_found",
    "message": "Workflow not found",
    "details": {}
  }
}
```

| Code | Status |
|---|---|
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `validation_failed` | 400 |
| `invalid_graph` | 422 |
| `empty_workflow` | 422 |
| `run_in_progress` | 409 |
| `draft_already_accepted` | 409 |
| `rate_limited` | 429 |
| `internal_error` | 500 |

## Docker

Run the full stack:

```bash
docker-compose up
```

PostgreSQL only:

```bash
docker-compose up postgres
```

## Testing

```bash
pnpm test
```

Unit tests cover domain logic (graph validation, execution ordering, AI planner) and run without a database.
