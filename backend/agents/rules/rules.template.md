# Backend Rules

Mandatory for every contributor (human or AI) working in `backend/`. The API exists to serve the Archestra studio at `frontend/`, so the shapes it returns are a contract, not a suggestion.

### Non-Negotiables

1. **Layered architecture**: route, service, repository. No database access inside a route handler.
2. **No-comment policy**: code is self documenting. Exceptions listed in section 5.
3. **Validate every boundary with Zod**: request body, params, query, env, and any third party response.
4. **Never use the em-dash character.** A hyphen, a colon, or a rewritten sentence replaces it anywhere: code, strings, docs, commits.
5. **Mock first, real later**: every external dependency sits behind an interface with a deterministic mock implementation.

---

## 1. Commits and Pushes

Follow [Conventional Commits](https://www.conventionalcommits.org/).

| Prefix | Purpose |
| --- | --- |
| `feat:` | new endpoint or behaviour |
| `fix:` | bug fix |
| `refactor:` | restructure without behaviour change |
| `perf:` | performance work |
| `test:` | tests only |
| `build:` | dependencies, tsconfig, Docker |
| `ci:` | pipeline changes |
| `docs:` | documentation |
| `chore:` | maintenance |

Rules:

- Subject in English, lowercase, imperative, max 72 characters, no trailing period.
- Body explains **why**, never **what**.
- Stage files explicitly by name. `git add .` and `git add -A` are forbidden.
- Never commit `.env*`, private keys, database dumps, or credentials. Run `git diff --cached` before pushing.
- Branch naming: `feat/<name>`, `fix/<name>`, `chore/<name>`. Squash merge into `main`.

---

## 2. Language and Runtime

- TypeScript in `strict` mode. `any`, `as unknown as`, `@ts-ignore`, and `@ts-expect-error` are forbidden.
- Prefer `satisfies` over `as` when checking a literal against a type.
- Node 22 LTS. No CommonJS in new code.
- HTTP framework: **Hono**. Handlers stay thin: parse, delegate, respond.
- Database: **PostgreSQL 16** through a typed query layer (Drizzle ORM). Raw SQL is allowed in migrations and in read models that need it, never string concatenated with user input.

---

## 3. Architecture

```
backend/src/
├── app.ts                 # Hono app assembly, middleware order
├── routes/                # one file per resource, HTTP only
├── services/              # business rules, transaction boundaries
├── repositories/          # SQL and row mapping
├── domain/                # entities, value objects, pure functions
├── schemas/               # Zod schemas, single source of truth for types
├── adapters/              # chain, ai, notifier: interface + mock + real
├── db/                    # drizzle schema, migrations, seed
├── lib/                   # logger, errors, ids, config
└── index.ts               # server bootstrap
```

Dependency rule: `routes -> services -> repositories -> db`. Domain code imports nothing from routes or db. Circular imports are forbidden.

Every module exports through its own `index.ts`. Reaching into another module's internal file is forbidden.

---

## 4. Types and Validation

- Derive TypeScript types from Zod with `z.infer`. Do not hand write a type that duplicates a schema.
- Shared request and response schemas live in `schemas/` and are the reference for `frontend/`. When a shape changes, the change is a breaking API change and needs a version bump or an additive field.
- Parse with `safeParse` at trust boundaries and return a typed error, never a thrown ZodError.
- Enums that the frontend also knows (`BlockKind`, `NodeRunState`, `ChatRole`) are defined once in `schemas/` and mirrored in the spec documents.

---

## 5. No Comment Rule

Code must read without commentary. Allowed exceptions:

- TSDoc on exported functions consumed by another module.
- A short note explaining **why** a non obvious workaround exists, with a link to the issue.
- `// TODO(@owner): [TICKET-123] ...` with an owner and a tracker link.
- License headers required by law.

Forbidden: comments restating the code, commented out code, decorative separators, sprint notes.

---

## 6. Error Model

One error shape for the whole API:

```json
{ "error": { "code": "workflow_not_found", "message": "Workflow does not exist", "details": {} } }
```

- `code` is a stable snake_case string. Clients branch on `code`, never on `message`.
- HTTP status maps to class of failure: 400 validation, 401 auth, 403 permission, 404 missing, 409 conflict, 422 domain rule violation, 429 rate limit, 500 unexpected.
- Never leak stack traces, SQL, or provider payloads to the client. Log them with a request id instead.
- A swallowed error (`catch {}`) is forbidden.

---

## 7. Persistence

- Every schema change ships as a migration. Editing an applied migration is forbidden.
- Migrations are forward only and safe to run on a live database: add column nullable, backfill, then constrain.
- Money and token amounts are stored as `numeric(78, 0)` in base units, never as float.
- Timestamps are `timestamptz`, always UTC.
- Every table has `id`, `created_at`, `updated_at`. Soft delete only where a spec asks for it.
- Multi step writes run inside one transaction opened at the service layer.

---

## 8. Testing

- Runner: `vitest`. HTTP tests use Hono's `app.request()` so no port is bound.
- Unit tests for domain functions, integration tests for routes against a real PostgreSQL in Docker, never against a shared remote database.
- Mocks are deterministic: no `Math.random`, no `Date.now` inside domain code. Inject a clock and an id generator.
- A bug fix ships with a test that fails before the fix.
- Coverage is not a target, but every route and every domain rule in `spec/` needs at least one test.

---

## 9. Security

- Secrets come from the environment, parsed with Zod at boot. The process exits if a required variable is missing.
- No secret is ever logged, echoed, or written to a tracked file.
- Rate limit public endpoints. Simulation and assistant endpoints are the expensive ones.
- CORS allow list comes from config, never `*` in production.
- All input that reaches SQL goes through the query builder or a parameterised statement.
- The API never holds a private key in this phase. Signing stays client side or in the contracts team's relayer. See `contracts/agents/spec/architecture.md`.

---

## 10. Observability

- Structured JSON logs with a request id, route, status, and duration. No PII, no secrets.
- `/v1/health` reports process liveness and database reachability separately.
- Every run and simulation writes a row so behaviour is auditable without reading logs.

---

## 11. Definition of Done

- [ ] `pnpm lint` and `pnpm type-check` pass.
- [ ] `pnpm test` passes, including new tests for the change.
- [ ] Migration written, applied, and reversible in practice.
- [ ] Zod schema updated and exported for the frontend.
- [ ] Endpoint documented in `agents/spec/api.md`.
- [ ] No secret, dump, or `.env*` in the diff.
- [ ] Error codes added to the table in `agents/spec/api.md`.
