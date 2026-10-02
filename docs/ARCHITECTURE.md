# Architecture

## Shape of the system

```
Browser (HTML, CSS, ES modules)
   │  fetch /api/*   (httpOnly cookies, polls /api/portfolio every 15s)
   ▼
Express app ── middleware ── routes ── services ── repository ──► Supabase Postgres (RLS)
                                          │
                                          └── providers ──► Yahoo Finance, Google Finance
```

One deployable. The Express app is the only thing that talks to Supabase, Yahoo and Google, so the browser never holds an API key, a token it can read, or a reason to know where market data comes from.

## Layers

| Layer | Folder | Knows about |
| --- | --- | --- |
| Domain | `src/domain` | Nothing outside itself. `Holding`, `Quote`, `Fundamentals`, `Position`, `PositionGroup`, `Sector`, `Portfolio`. All gain, loss and weight arithmetic lives here. |
| Infrastructure | `src/infra` | Generic mechanics: `TtlCache`, `ReadThroughCache`, `ConcurrencyLimiter`, Supabase client factories. |
| Providers | `src/providers` | One class per external source behind `QuoteProvider` and `FundamentalsProvider`. |
| Repository | `src/repositories` | `HoldingRepository` is the contract; `SupabaseHoldingRepository` is the implementation. |
| Services | `src/services` | `PortfolioService` (valuation), `AuthService` (Supabase Auth). |
| HTTP | `src/http` | Routing, validation, cookies, error mapping, presentation. No business rules. |
| Composition | `src/container.js` | The only place concrete classes are chosen and wired. |

Dependencies point inward. The domain has no imports from the others, which is why the whole valuation model is tested without a server, a database or a network.

## Decisions

**Plain frontend, no build.** The UI is one screen with one table. ES modules give structure (one class per file, no globals) without a toolchain, and Vercel serves the files as they are.

**One host.** Vercel runs the Express app as a single function and serves `public/` from its CDN, so there is no second service to deploy, secure or keep in sync. `src/server.js` is a thin `listen()` wrapper for hosts that want a long-running process.

**Supabase anon key plus the user's own token.** Every database call is made with the signed-in user's JWT, so Postgres row level security decides what a user can touch. The repository also filters by `user_id`, so a mistake in one layer doesn't expose data. There is no service role key anywhere in the app, which means a bug in this code cannot read other people's rows even in principle.

**Tokens in cookies, not in JavaScript.** The access and refresh tokens are `httpOnly` and `SameSite=Strict`, scoped to `/api`. Page scripts can't read them, and other sites can't make the browser send them. When the access token has expired, the authenticator swaps the refresh token for a new session before the request continues, so the user is never bounced to sign in mid-session.

**Verifying tokens.** `AuthService.authenticate` uses Supabase's `getClaims`, then requires a `sub` and the `authenticated` role. The public anon key is itself a validly signed JWT, so checking the signature alone would let anyone who has the key through.

**Validation at the edge.** Every body and parameter is parsed by a zod schema before a service sees it. Unknown fields are dropped on create and rejected on edit. The database repeats the important rules as check constraints (positive price and quantity, symbol format per exchange, unique stock per user), so a bad row can't get in by another route.

**Other defences.** Strict CSP (self only, no inline script or style), `Origin` must match `Host` on writes, per-IP rate limits (120 requests a minute for the API, 20 per 15 minutes for sign in and sign up), a 64 KB body limit, `Cache-Control: no-store` on every API response, log redaction for cookies and authorization headers, and generic 500 messages. The policy in `vercel.json` is the same string helmet emits; a test fails if they drift.

## Market data

The brief is a live table that updates every 15 seconds, fed by sources that have no official API and will throttle a busy client. The design answers that in four ways.

1. **Short-lived caches in front of everything.** Prices are reused for 10 seconds, so any number of tabs and users watching the same stocks cost one Yahoo request per 10 seconds, not one each. P/E and earnings move slowly and are reused for 6 hours.
2. **Batching.** Yahoo is asked for every symbol in a single call.
3. **Single flight.** If two requests need the same missing symbols while a fetch is in progress, the second waits for the first instead of starting its own.
4. **Bounded scraping.** Google Finance is one page per stock, so scrapes go through a limiter of four at a time and are cached for hours. A page that has nothing on it is remembered for ten minutes so it isn't retried on every refresh.

When a source fails, the cache serves the last good value (up to 15 minutes for prices, 24 hours for fundamentals) and the response marks it stale. The UI shows "last known" rather than a blank, and `PortfolioService` treats a provider failure as "no data" so the rest of the dashboard still renders.

**Strategy and chain.** Both providers are interfaces. `ChainedFundamentalsProvider` asks Google first and only asks Yahoo about the stocks Google had nothing for. Swapping or adding a source means writing one class and changing one line in `container.js`.

**Parsing Google.** Google's markup uses generated class names that change. The parser ignores them and looks for the visible labels "P/E ratio" and "Earnings per share", then reads the first number beside each. Scripts and styles are skipped so text inside them is never mistaken for a value.

## Totals

- Weight is a position's investment as a share of total investment.
- Present value and gain only count positions that have a price. A group with no priced positions reports `null` rather than zero, and the UI shows a dash.
- `unpricedCount` and `staleCount` travel with every group so the dashboard can say exactly how much of a total to trust.
- Sectors are sorted by invested amount, largest first, so the biggest bets read first.

## Data structures

- A `Map` keyed by sector name groups holdings in one pass.
- `TtlCache` is a `Map` with expiry timestamps; insertion order gives cheap oldest-first eviction at the size cap.
- The in-flight request table is a `Map` from the sorted set of missing keys to a promise.
- `ConcurrencyLimiter` is a FIFO queue plus a running counter.
- The table in the browser keeps rows in a `Map` by holding id, so a refresh updates cells in place and only changed prices flash.

## Prior art

Open source portfolio trackers made the same broad choices. [Ghostfolio](https://github.com/ghostfolio/ghostfolio) puts a TypeScript API in front of PostgreSQL and Redis and pulls quotes from Yahoo Finance among other providers, keeping every call to market data on the server. Folio does the same, at a smaller scale: an in-process cache stands in for Redis, which suits a single stateless function and keeps the dependency count at one external service.

On Vercel, an Express app becomes a single function and static files come from `public/` through the CDN, which is why `express.static` in `src/app.js` only matters outside Vercel ([Express on Vercel](https://vercel.com/docs/frameworks/backend/express)).

## Limits to be aware of

- The caches are per process. On Vercel each warm function instance has its own, so a burst of traffic that spreads across instances makes more upstream requests than one instance would. A shared cache (Redis or Vercel KV) is the next step if usage grows.
- Rate limiting is also per instance for the same reason.
- Yahoo and Google can change or block without notice; `npm run check:providers` is the quickest way to see whether they are answering.
