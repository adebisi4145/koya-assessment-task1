# Clinic booking API

A clinic booking API plus a small web page that uses it: patients see available slots, book one, get a confirmation, and can cancel or look up their bookings. Built for Task 1 of the Koya Cohort 4 assessment, following the [contract](https://koyaacademy.com/assessment-api) exactly.

|                  |                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **Web page**     | https://koya-assessment-task1.vercel.app                                                         |
| **API base URL** | `https://koya-assessment-task1.vercel.app` (endpoints are at the root: `/slots`, `/bookings`, …) |
| **Auth**         | `X-API-Key: <key>` on every request (shared separately)                                          |

**Stack:** TypeScript, Next.js 16 (route handlers for the API, React Server Components for the page), Postgres (Neon in production), Vercel, zod, Vitest, Playwright.

## Try it

```bash
BASE=https://koya-assessment-task1.vercel.app
KEY=<api key>

curl -s $BASE/slots -H "X-API-Key: $KEY"

curl -s -X POST $BASE/bookings -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"slot_id":"<slot id>","name":"Ada Obi","email":"ada@example.com"}'

curl -s "$BASE/bookings?email=ada@example.com&limit=10" -H "X-API-Key: $KEY"
curl -s $BASE/bookings/<booking id> -H "X-API-Key: $KEY"
curl -s -X DELETE $BASE/bookings/<booking id> -H "X-API-Key: $KEY"
```

## How each level is met

| Level | Requirement                                             | Implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | List slots, book, look up                               | `GET /slots` (earliest first, optional exact `provider` filter), `POST /bookings` → 201, `GET /bookings/{id}`. `POST /reset` replaces all slots and deletes all bookings. Slot `start`/`end` are echoed exactly as sent to `/reset`.                                                                                                                                                                                                                                                                                             |
| 2     | API key; reject bad input                               | Every route checks `X-API-Key` (constant-time compare) → 401. zod validation: missing, blank or non-string fields and invalid emails → 400. Unknown slot → 404. Slot already started → 400 (checked against the database clock). `name`/`email` are trimmed, and `email` is stored in lower case.                                                                                                                                                                                                                                |
| 3     | No double booking, even under concurrency; cancellation | A **partial unique index** `UNIQUE (slot_id) WHERE status = 'confirmed'` makes Postgres the single source of truth. Inserts use `ON CONFLICT … DO NOTHING`, so simultaneous requests for one slot wait on each other and all but one get 409. `DELETE` atomically flips `confirmed → cancelled` (409 if already cancelled), which frees the slot.                                                                                                                                                                                |
| 4     | Idempotent retries; pagination                          | `POST /bookings` runs in a single transaction. An `Idempotency-Key` takes a transaction-scoped **advisory lock**, so concurrent retries take turns: the same key with the same body (compared by a hash of canonical, key-order-independent JSON) replays the stored status and body; the same key with a different body → 422. `GET /bookings` uses **keyset pagination** over a monotonic sequence with an opaque, versioned cursor; `limit` is 1–50 (default 10), anything else → 400; the last page has `next_cursor: null`. |
| 5     | Stop spam                                               | A **sliding window** of 5 attempts per email per 60 s, failed attempts included, stored in Postgres so it holds across serverless instances. Attempts for one email are serialised with an advisory lock, so a burst can't slip through together. The 6th attempt → 429 with `Retry-After` in whole seconds until the oldest attempt expires. Other emails are unaffected.                                                                                                                                                       |

### Decisions worth knowing

- **The database enforces the invariants.** Double-booking, idempotency and rate limiting are all correct under concurrency because they rely on Postgres (a unique index, row writes inside transactions, advisory locks), not on in-memory state. That matters on serverless, where many instances run at once.
- **Ordering inside `POST /bookings`:** auth → JSON parse → idempotency replay check → rate-limit check → validation → slot checks → insert. Replays don't count as new attempts. Failed attempts are returned as values rather than thrown, so the transaction still commits their rate-limit record.
- **Only final outcomes are stored for idempotency** (201, 400, 404, 409). A 429 or 5xx is temporary, so storing it would make a later, legitimate retry fail forever. Keys expire after 24 hours.
- **`/reset` also clears rate-limit and idempotency state,** so each test run starts from a genuinely clean slate.
- **Booking ids are UUIDs.** Ids that aren't valid UUIDs return 404 without a query.
- **Unknown paths return the JSON error shape** (`{"error":"not found"}`), like every other error.

## The web page

- **`/`**: slots grouped by day, shown in clinic time (Africa/Lagos), with a doctor filter. Pick a slot, enter name and email, and book.
- **`/booking/{id}`**: the confirmation, with a two-step cancel.
- **`/my-bookings`**: look up bookings by email, paging with the API's cursor.

The page calls the HTTP API like any other client. Calls are made from server code (Server Components and Server Actions) through a typed client in `src/server/api-client.ts`, so **the API key never reaches the browser**, and an E2E test checks this. Each form submission carries an `Idempotency-Key`, so a double-click can't double-book. If someone takes the slot mid-booking, the list refreshes and the page explains what happened.

## Project layout

```
src/app/                    routes: API route handlers (reset, slots, bookings) + pages
src/server/http.ts          withApi(): auth, error → JSON mapping, 500 fallback, request logs
src/server/services/        business rules (bookings, slots, rate limit), run in transactions
src/server/repos/           SQL only
src/server/schemas.ts       zod request schemas
src/server/lib/             pure helpers: cursor, canonical hash, Retry-After maths
db/migrations/              numbered SQL migrations (scripts/migrate.ts applies them)
tests/unit/                 pure logic
tests/contract/             black-box HTTP tests for every level, incl. race conditions
tests/e2e/                  Playwright: the page, end to end
```

## Run it locally

Requires Node 22+ and Docker.

```bash
npm install
cp .env.example .env.local      # then set API_KEY to a random value
npm run db:up                   # Postgres 17 in Docker on :5433
npm run db:migrate
npm run dev                     # http://localhost:3000
npm run db:seed                 # demo slots for the next week (calls POST /reset!)
```

## Tests

```bash
npm test                # unit tests
npm run test:contract   # HTTP contract tests against API_URL (default http://localhost:3000)
npm run test:e2e        # browser tests (uses the locally installed Chrome)
npm run lint && npm run typecheck && npm run format:check
```

The contract suite covers every status code in the spec, including 25 simultaneous bookings for one slot (exactly one 201), 10 simultaneous retries with one idempotency key (one booking), and a 12-request burst against the rate limit (exactly 5 get through). CI runs all of it against a real Postgres on every push: `.github/workflows/ci.yml`.

> ⚠️ The contract and E2E suites call `POST /reset`, which deletes all data. Don't point them at an environment you care about.

## Deployment

Vercel (production branch `main`) with Neon Postgres, connected through Vercel's Neon integration.

- **Environment variables:** `DATABASE_URL` (Neon's pooled connection string, set by the integration) and `API_KEY`. `API_BASE_URL` is optional on Vercel: it defaults to the project's production domain, which is what the page uses to call the API.
- **Migrations** run automatically on every deploy: Vercel runs the `vercel-build` script (`db:migrate`, then `next build`), and migrations are idempotent.

## Known trade-offs

- An unknown `/booking/{id}` page renders the not-found view with HTTP 200, because the page streams and the status is sent before the lookup finishes. The API itself returns proper 404s.
- Anyone holding a booking's UUID can view or cancel it from the page. There are no patient accounts, which matches the API contract. Ids are unguessable.
- Rate-limit rows are pruned per email when that email is next used. A scheduled clean-up job would bound the table for emails that never return.
