# XRise Mini Helpdesk

A minimal helpdesk. Customers submit and track support tickets without an
account; agents and admins triage, reply, and close them behind JWT auth.

> **Status: Phase 4 of 6 complete** — foundation, agent authentication with
> role-scoped authorization, the public ticket flow with rate limiting, and the
> agent dashboard with filters, server-side search and pagination. The ticket
> detail view is not built yet. See "Roadmap".

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) — React frontend and Route Handlers in one deployment |
| Language | TypeScript |
| Database | MongoDB via Mongoose |
| Auth | JWT in an httpOnly cookie, signed with `jose` |
| Validation | Zod, shared between server handlers and client forms |
| Logging | pino (structured JSON, with redaction) |
| Tests | Vitest + `mongodb-memory-server` |

## Running locally

**Prerequisites:** Node.js 20.9+ and a MongoDB Atlas cluster (the free M0 tier
is sufficient).

### Setting up MongoDB Atlas

1. Create a free **M0** cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Database Access** → add a database user with *Read and write to any
   database*. Note the password.
3. **Network Access** → add an IP address. Vercel has no static egress range,
   so a deployed app needs `0.0.0.0/0`; access is protected by SCRAM
   credentials rather than by IP.
4. **Connect → Drivers** → copy the Node.js connection string, then append the
   database name: `...mongodb.net/xrise-helpdesk?retryWrites=true&w=majority`.

**Percent-encode the password** if it contains `@ : / ? # [ ] %` **or `$`**.
The `$` matters for a non-obvious reason: Next.js runs `dotenv-expand` over
`.env`, so an unescaped `$` in a value is treated as a variable reference and
expanded away. The symptom is confusing — `npm run db:check` and
`npm run db:seed` succeed (they use plain `dotenv`, which does not expand)
while the dev server fails with `bad auth : authentication failed`. Encoding
`$` as `%24` fixes it for every loader.

Atlas deployments are replica sets, which the ticket-reply flow depends on:
multi-document transactions do not work against a standalone `mongod`.

#### If the dev server reports `bad auth` but `npm run db:check` succeeds

Almost always the `$` expansion problem described above. Percent-encode the
password.

#### If the connection fails with `querySrv EBADRESP`

The `mongodb+srv://` scheme performs a DNS **SRV** lookup, and some networks —
phone hotspots and captive/filtering resolvers in particular — return SRV
responses that Node's bundled resolver rejects, even though `dig` resolves the
same record fine. The error is a DNS fault, not bad credentials or a missing IP
allowlist entry.

Confirm it with:

```bash
node -e "require('dns').resolveSrv('_mongodb._tcp.<cluster>.mongodb.net',(e,r)=>console.log(e?e.code:r.length+' records'))"
```

The fix is to use Atlas's **standard connection string**, which lists the shard
hosts directly and performs no SRV lookup:

```
mongodb://<user>:<password>@host-00:27017,host-01:27017,host-02:27017/xrise-helpdesk?ssl=true&replicaSet=<rs>&authSource=admin&retryWrites=true&w=majority
```

Atlas provides it under **Connect → Drivers**, by selecting an older Node.js
driver version (2.2.12 or later). It behaves identically and is immune to the
resolver problem.

```bash
npm install
```

Copy the environment template and fill it in:

```bash
cp .env.example .env
```

Generate a signing secret and paste it into `JWT_SECRET`:

```bash
openssl rand -base64 48
```

Set `MONGODB_URI` to your Atlas connection string, then confirm it works:

```bash
npm run db:check
```

Seed the database:

```bash
npm run db:seed
```

Start the dev server:

```bash
npm run dev
```

The app runs at http://localhost:3000.

### Seeded accounts

| Email | Role | Password | Sees |
|---|---|---|---|
| `agent1@xriseai.com` | agent | `Password123!` | only tickets assigned to them |
| `agent2@xriseai.com` | agent | `Password123!` | only tickets assigned to them |
| `admin@xriseai.com` | admin | `Password123!` | every ticket, and can reassign |

Passwords come from `SEED_AGENT_PASSWORD` / `SEED_ADMIN_PASSWORD`. Two agents
are seeded rather than one so that cross-agent isolation is actually
demonstrable — with a single agent, a scoping bug is invisible.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Signing secret, minimum 32 characters |
| `APP_ORIGIN` | yes | Canonical origin; used for cookie scope and absolute URLs |
| `NODE_ENV` | no | `development` \| `test` \| `production` |
| `LOG_LEVEL` | no | pino level, defaults to `info` |
| `SEED_AGENT_PASSWORD` | no | Password for seeded agents (dev only) |
| `SEED_ADMIN_PASSWORD` | no | Password for the seeded admin (dev only) |
| `LLM_PROVIDER` / `LLM_API_KEY` | no | AI bonus feature; unused so far |

`.env` is git-ignored. `.env.example` is committed and lists every key.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run db:check` | Verify the Atlas connection string |
| `npm run db:seed` | Reset and seed the database |
| `npm run db:indexes` | Apply declared indexes (run after a production deploy) |

Run a single test file:

```bash
npx vitest run tests/integration/foundation.test.ts
```

Run tests matching a name:

```bash
npx vitest run -t "never leaks an unexpected error message"
```

## Architecture decisions

Full detail lands in `ARCHITECTURE.md`. The short version:

**One Next.js app rather than a separate Express API.** The assignment permits
Next.js API routes. Keeping them together means one deploy target, no
cross-origin surface, and Zod schemas that define server validation and infer
the client's form types from a single declaration.

**`proxy.ts` guards pages, not the API.** Next.js 16 renamed the `middleware`
convention to `proxy`, and documents that it may run at the CDN edge — so it is
treated as a fast reject, never the security boundary. It covers `/dashboard`
and `/tickets/*` only: the API mixes public and protected routes on one path
(`POST /api/tickets` is the public submission form, `GET /api/tickets` is the
agent list), so a path-prefix rule there would either block the public form or
wave the agent list through. Route Handlers re-derive the session themselves.

**Authorization is a data-access concern, not a UI one.** A single
`scopeTicketQuery(user)` helper returns the Mongo filter for the caller —
`{}` for an admin, `{ assigneeId: self }` for an agent — and every ticket read
and write composes it, including the pagination count. Requesting a ticket
outside your scope returns 404, not 403, so IDs cannot be probed for existence.

**Rate limiting is stored in MongoDB, not in memory.** Serverless instances do
not share memory, so an in-process counter is bypassed by landing on a cold
container. A TTL-indexed collection keeps the window shared and self-reaping.
Budgets are consumed *before* validation, so malformed floods cost the caller
too, and each entry point has its own budget: ticket submission (10 per 10
min), status lookup (30 per 10 min) and login (10 per 15 min). A 429 always
carries `Retry-After`.

**Caller identity for rate limiting comes from `x-forwarded-for`.** That header
is only trustworthy behind a proxy that overwrites it — true on Vercel, not
true of a naked origin, where a caller could rotate the value to evade the
limit. Local development has no such header, so every caller shares one bucket:
the safe direction to fail.

**The timeline is a separate append-only collection, but the latest agent reply
is denormalised onto the ticket.** Event history is unbounded and would grow a
ticket document toward the 16MB cap. Normalising it would, however, force a
second query on the public status check — the only unauthenticated endpoint. So
that one derived field is copied back, written in the same transaction.

**The URL is the source of truth for dashboard state, and there is no client
cache library.** Filters, search and page number live in the query string, so a
view is shareable, bookmarkable and correct under the back button, and the
Server Component can read them directly. Adding TanStack Query (or Redux, or
Zustand) would introduce a second copy of state that the URL already holds —
the "library because it exists" trap the assignment's wording guards against.
Client state is limited to what is genuinely local: form fields via
`react-hook-form`, and `useTransition` for pending navigation feedback.

**Ticket IDs are random, not sequential.** The status-check endpoint is
unauthenticated; a sequential ID plus a customer email would let anyone walk
the ticket table.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: models, indexes, errors, logging, seed, test harness | **done** |
| 2 | JWT auth, role guards, `scopeTicketQuery` + its tests | **done** |
| 3 | Public ticket submission and status check, rate limiting | **done** |
| 4 | Agent dashboard: pagination, filters, server-side search | **done** |
| 5 | Ticket detail: timeline, reply, status change, admin reassign | not started |
| 6 | Hardening, `ARCHITECTURE.md`, deployment, stretch goals | not started |

## Known bugs and limitations

- Not deployed yet; no live URL.
- No CSRF token. `SameSite=Lax` plus JSON-only mutating endpoints covers the
  realistic cases at this scale; a double-submit token is the documented
  upgrade.
- MongoDB `$text` search has no partial or prefix matching — searching `data`
  will not match `database`. Noted now because it constrains Phase 4.
- `npm run db:seed` is destructive: it wipes users, tickets and events.
- Ticket detail, replies, status changes and admin reassignment are not
  implemented; ticket rows link to a route that does not exist yet.
- Search uses a MongoDB `$text` index, so it matches whole stemmed words only:
  searching `data` will not match `database`. Atlas Search would fix this
  without changing the query surface.
- Pagination uses `skip`/`limit`, which degrades on deep pages. Fine at this
  scale; cursor pagination is the documented upgrade.
- Fixed-window rate limiting can admit up to 2x the limit across a window
  boundary. Acceptable at this scale; a sliding window in Redis is the upgrade.
- The public status check identifies a customer by ticket ID plus email, which
  is a bearer-style claim rather than authentication. Ticket IDs are therefore
  random (31^10 combinations) and the endpoint is rate limited.
