# XRise Mini Helpdesk

A minimal helpdesk. Customers submit and track support tickets without an
account; agents and admins triage, reply, and close them behind JWT auth.

**Live URL:** **https://project-xrise-nine.vercel.app**

Sign in as `agent1@xriseai.com`, `agent2@xriseai.com` or `admin@xriseai.com` —
all with the password `Password123!`. The two agents see different tickets; the
admin sees every ticket and can reassign.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) — React frontend and Route Handlers in one deployment |
| Language | TypeScript |
| Database | MongoDB Atlas via Mongoose |
| Auth | JWT in an httpOnly cookie, signed with `jose` |
| Validation | Zod, shared between server handlers and client forms |
| UI | shadcn/ui on Radix, Tailwind CSS v4, `next-themes`, Motion |
| Logging | pino (structured JSON, with redaction) |
| Tests | Vitest + `mongodb-memory-server` |
| AI | Groq (OpenAI-compatible); OpenRouter and Ollama also supported |
| Real-time | Server-Sent Events (`EventSource`) |
| File storage | GridFS (MongoDB) |

## Running locally

**Prerequisites:** Node.js 20.9+ and a MongoDB Atlas cluster (free M0 tier).

### Setting up MongoDB Atlas

1. Create a free **M0** cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → add an IP. Vercel has no static egress range, so a
   deployed app needs `0.0.0.0/0`; the cluster is protected by SCRAM
   credentials rather than by IP.
4. **Connect → Drivers** → copy the Node.js connection string and append the
   database name: `...mongodb.net/xrise-helpdesk?retryWrites=true&w=majority`.

Atlas deployments are replica sets, which this app depends on: ticket creation
and replies write across two collections in a transaction, and transactions do
not work against a standalone `mongod`.

**Percent-encode the password** if it contains `@ : / ? # [ ] %` **or `$`**.
The `$` matters for a non-obvious reason: Next.js runs `dotenv-expand` over
`.env`, so an unescaped `$` in a value is read as a variable reference and
silently mangled. The symptom is confusing — `npm run db:check` and
`npm run db:seed` succeed (they use plain `dotenv`, which does not expand) while
the dev server fails with `bad auth`. Encode `$` as `%24`.

### Start

```bash
npm install
```

```bash
cp .env.example .env
```

Generate a signing secret and paste it into `JWT_SECRET`:

```bash
openssl rand -base64 48
```

Set `MONGODB_URI`, then confirm the connection:

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

### Or with Docker

```bash
docker compose up --build
```

Compose starts MongoDB as a single-node **replica set** (required for
transactions) and waits for it to be healthy before starting the app. Set
`JWT_SECRET` in your environment or `.env` first.

The app image is a Next.js standalone build, so it deliberately contains no
seed script. Seed the container's database from the host instead — port 27017
is published for exactly this:

```bash
MONGODB_URI='mongodb://127.0.0.1:27017/xrise-helpdesk?replicaSet=rs0&directConnection=true' npm run db:seed
```

Stop the stack with `docker compose down`, or `docker compose down -v` to also
discard the database volume.

## Seeded accounts

All use the password `Password123!`.

| Email | Role | Sees |
|---|---|---|
| `agent1@xriseai.com` | agent | only tickets assigned to them (4) |
| `agent2@xriseai.com` | agent | only tickets assigned to them (4) |
| `admin@xriseai.com` | admin | every ticket (12), and can reassign |

Two agents are seeded rather than one so cross-agent isolation is actually
demonstrable — with a single agent a scoping bug is invisible.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Signing secret, minimum 32 characters |
| `APP_ORIGIN` | no | Canonical origin. Declared for CORS and absolute-URL use; defaults to `http://localhost:3000` and is not read at runtime yet |
| `NODE_ENV` | no | `development` \| `test` \| `production` |
| `LOG_LEVEL` | no | pino level, defaults to `info` |
| `SEED_AGENT_PASSWORD` | no | Password for seeded agents (dev only) |
| `SEED_ADMIN_PASSWORD` | no | Password for the seeded admin (dev only) |
| `LLM_PROVIDER` | no | `groq` \| `openrouter` \| `ollama`. Defaults to `groq` |
| `LLM_API_KEY` | no | Enables the AI drafting feature. Omit to disable it |
| `LLM_MODEL` | no | Overrides the provider's default model |
| `LLM_BASE_URL` | no | Overrides the provider's base URL |

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
| `npm run db:seed` | Reset and seed the database (destructive) |
| `npm run db:indexes` | Apply declared indexes (run after a production deploy) |
| `npm run db:inspect` | Browse tickets and timelines from the terminal |

Run a single test file:

```bash
npx vitest run tests/integration/authorization.test.ts
```

Run tests matching a name:

```bash
npx vitest run -t "never leaks an unexpected error message"
```

## The AI feature

**Provider: Groq Cloud**, using its OpenAI-compatible endpoint with
`openai/gpt-oss-120b`. Chosen for a genuinely free tier with no card required
and latency low enough that an agent will actually wait — drafts return in
under a second.

`gpt-oss` is a reasoning model: it spends tokens thinking before it answers, so
the client sends `reasoning_effort: 'low'` and a token budget large enough to
cover both phases. Without that, the whole budget is consumed by reasoning and
the reply comes back empty. That parameter is only sent to models whose id
contains `gpt-oss`, so OpenRouter and Ollama are unaffected.
`LLM_PROVIDER=openrouter` or `ollama` works without code changes, since all three
speak the same API shape.

On the ticket detail view, **Draft with AI** composes a reply from the ticket and
its full timeline and drops it into the reply box for the agent to edit. The
agent always sends it themselves — nothing reaches a customer unreviewed, so a
bad generation costs a wasted click rather than a wrong answer.

The feature is **optional**. With no `LLM_API_KEY` set the button does not
render and the endpoint returns a clear message rather than failing obscurely.
The endpoint is scoped like every other ticket route: an agent cannot draft
against a ticket they are not assigned, so it cannot be used to read another
agent's ticket through the model. It is separately rate limited at 20 requests
per 10 minutes per agent.

Get a free key at [console.groq.com](https://console.groq.com), then set
`LLM_API_KEY` in `.env`. **Never commit it.**

## Real-time updates

Ticket detail subscribes to `GET /api/tickets/:id/stream`, a Server-Sent Events
endpoint. When another agent replies, changes status, or an admin reassigns, the
open page refreshes its server data within about three seconds.

**SSE rather than WebSockets** because Vercel's serverless runtime cannot hold a
WebSocket. **Polling inside the stream rather than MongoDB change streams**
because change streams need a persistent connection and serverless containers
freeze between invocations; a bounded poll is predictable on any host. Each
stream lives 50 seconds and then closes cleanly, and `EventSource` reconnects on
its own.

The stream is scoped exactly like every other ticket route — the poll calls a
scoped service function, so authorization is re-checked on **every poll**, not
just at connection time. An agent streaming another agent's ticket gets 404.

## File attachments

Customers can attach up to **3 files of 5MB each** to a ticket. Agents see them
on the ticket detail; the customer sees them on the public status page.

Files live in **GridFS inside MongoDB** — no second service, and it works on
Atlas and in Docker unchanged. Serving user-uploaded files is an XSS vector, so
downloads are defended in depth: an allow-list of content types (images, PDF,
plain text, CSV — never HTML, SVG or scripts), filenames stripped to a safe
basename, `Content-Disposition: attachment` so nothing renders inline,
`X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src
'none'; sandbox`.

Downloads are authorized two ways by the same endpoint: an authenticated agent
must have the parent ticket in scope, and an anonymous caller must supply the
matching ticket ID and email. Anything else is a 404.

## Architecture decisions

Full detail is in [ARCHITECTURE.md](./ARCHITECTURE.md). The short version:

**One Next.js app rather than a separate Express API.** The assignment permits
Next.js API routes. Keeping them together means one deploy target, no
cross-origin surface, and Zod schemas that define server validation and infer the
client's form types from a single declaration.

**Authorization is a data-access concern, not a UI one.** A single
`scopeTicketQuery(user)` returns the Mongo filter for the caller — `{}` for an
admin, `{ assigneeId: self }` for an agent — and every ticket read and write
composes it, **including the pagination count**. The filter is spread last, so a
caller-supplied filter can never widen it. Out-of-scope access returns 404, not
403, so ticket IDs cannot be probed for existence.

**`proxy.ts` guards pages, not the API.** Next.js 16 renamed `middleware` to
`proxy` and documents that it may run at the CDN edge, so it is a fast reject and
never the security boundary. It covers `/dashboard` and `/tickets/*` only: the
API mixes public and protected routes on one path (`POST /api/tickets` is the
public form, `GET /api/tickets` is the agent list).

**Rate limiting lives in MongoDB, not in memory.** Serverless instances do not
share memory, so an in-process counter is bypassed by landing on a cold
container. Budgets are consumed *before* validation so malformed floods also
cost the caller. A 429 always carries `Retry-After`.

**The timeline is a separate append-only collection, but the latest agent reply
is denormalised onto the ticket.** Event history is unbounded and would grow a
ticket document toward the 16MB cap. Normalising alone would force a second query
on the public status check — the only unauthenticated endpoint — so that one
derived field is copied back inside the same transaction.

**The URL is the source of truth for dashboard state.** Filters, search and page
live in the query string, so views are shareable and back-button correct, and the
Server Component reads them directly. No client cache library — it would be a
second copy of state the URL already holds.

**Ticket IDs are random, not sequential** (31^10 combinations, no ambiguous
characters). The status endpoint is unauthenticated; a sequential ID plus an
email would let anyone walk the ticket table.

## Testing

```bash
npm test
```

130 tests. The highest-value ones are in
`tests/integration/authorization.test.ts`: cross-agent denial by direct ID,
scoped pagination counts, and the assertion that a caller-supplied filter cannot
widen scope. Two tests run `.explain()` and assert the dashboard query uses
`IXSCAN` rather than `COLLSCAN`.

CI runs lint, typecheck, tests and build on every push and pull request
(`.github/workflows/ci.yml`).

## Deployment

Deployed on **Vercel** (Hobby tier) with **MongoDB Atlas M0**:
**https://project-xrise-nine.vercel.app**

To deploy your own copy:

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new).
2. Add environment variables: `MONGODB_URI`, `JWT_SECRET`, `APP_ORIGIN` (the
   Vercel URL), and optionally `LLM_API_KEY`.
3. Atlas → **Network Access** → allow `0.0.0.0/0`, since Vercel has no static
   egress range.
4. Do **not** set `NODE_ENV` — Vercel manages it. A blank or wrong value would
   disable the `Secure` cookie flag and HSTS. The app now fails closed on an
   unrecognised value, but the variable should simply be absent.
5. After the first deploy, apply indexes and seed:

```bash
npm run db:indexes && npm run db:seed
```

Both read `MONGODB_URI` from your local `.env`, so point it at the production
cluster when you run them.

## Known bugs and limitations

- Search uses a MongoDB `$text` index, so it matches whole stemmed words only:
  searching `data` will not match `database`. Atlas Search would fix this
  without changing the query surface.
- Pagination uses `skip`/`limit`, which degrades on deep pages. Fine at this
  scale; cursor pagination is the documented upgrade.
- Fixed-window rate limiting can admit up to 2x the limit across a window
  boundary. A sliding window in Redis is the upgrade.
- Rate limiting identifies callers by `x-forwarded-for`, which is only
  trustworthy behind a proxy that overwrites it — true on Vercel, not true of a
  naked origin. Local development has no such header, so all callers share one
  bucket.
- No CSRF token. `SameSite=Lax` plus JSON-only mutating endpoints covers the
  realistic cases at this scale; a double-submit token is the documented upgrade.
- The public status check identifies a customer by ticket ID plus email, which is
  a bearer-style claim rather than authentication. IDs are therefore random and
  the endpoint is rate limited.
- `npm run db:seed` is destructive: it wipes users, tickets and events.
- Real-time updates use a 3-second poll inside an SSE stream rather than
  MongoDB change streams, and the stream is capped at 50 seconds with automatic
  client reconnect. See ARCHITECTURE.md for why.
- Attachments are stored in GridFS inside MongoDB rather than object storage.
  That avoids a second service but consumes cluster storage, which matters on
  Atlas M0's 512MB. S3-compatible storage with presigned uploads is the upgrade.
