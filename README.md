# Folio

A live dashboard for your NSE and BSE equity holdings. Add what you own and what you paid; Folio shows the current market price, what each position is worth, your gain or loss, and the P/E and latest earnings for every stock, grouped by sector with totals. Prices refresh every 15 seconds while the tab is open.

- **Frontend:** plain HTML, CSS and ES modules. No framework, no build step.
- **Backend:** Node 22 and Express 5.
- **Database and sign-in:** Supabase (Postgres, Auth, row level security).
- **Market data:** Yahoo Finance for prices, Google Finance for P/E and earnings, with Yahoo as the fallback.
- **Hosting:** one Vercel project. The same code also runs as a normal Node server anywhere else.

## Run it locally

You need Node 22 or newer and a Supabase project.

1. Create a Supabase project, then open **SQL Editor** and run `supabase/migrations/20261002000000_create_holdings.sql`.
2. Copy the environment file and fill it in. The URL and the anon (publishable) key are under **Project Settings > API**.

   ```sh
   cp .env.example .env
   ```

3. Install and start.

   ```sh
   npm install
   npm run dev
   ```

4. Open http://localhost:3000, create an account, and use **Load sample portfolio** to see the dashboard with data.

If your Supabase project requires email confirmation (the default), confirm the address from the email before signing in. To skip that while developing, turn off **Confirm email** under **Authentication > Providers > Email**.

### Environment variables

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_URL` | yes | | Project URL |
| `SUPABASE_ANON_KEY` | yes | | Anon or publishable key. The service role key is never used. |
| `PORT` | no | `3000` | Port for `npm start` |
| `QUOTE_TTL_SECONDS` | no | `10` | How long a price is reused before Yahoo is asked again |
| `FUNDAMENTALS_TTL_SECONDS` | no | `21600` | How long P/E and earnings are reused (six hours) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the server and restarts it when files change |
| `npm start` | Starts the server |
| `npm test` | Runs the test suite with Node's built-in test runner |
| `npm run check:providers` | Fetches a few real quotes from Yahoo and Google and prints what came back |

Run `npm run check:providers` from the machine or network you will deploy from. Both sources are public web endpoints with no contract, and some networks block them.

## Deploy

### Vercel

1. Push this repository to GitHub and import it at https://vercel.com/new. No framework preset or build command is needed.
2. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` under **Settings > Environment Variables**.
3. Deploy.

Vercel serves `public/` from its CDN and runs `src/app.js` as a single function behind `/api`. Security headers for the static files come from `vercel.json`.

In Supabase, set **Authentication > URL Configuration > Site URL** to your Vercel domain so confirmation emails link back to the app.

### Anywhere else (Replit, Railway, Render, a VM)

Set the same environment variables, and run `npm install && npm start`. `NODE_ENV=production` makes session cookies `Secure`, so serve it over HTTPS. The app trusts one proxy hop for client IPs (used by rate limiting), which suits hosts that put a single load balancer in front.

## API

Every route is under `/api`. Everything except health and the three auth routes needs a session.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness check |
| POST | `/api/auth/signup` | Create an account |
| POST | `/api/auth/signin` | Sign in |
| POST | `/api/auth/signout` | Sign out |
| GET | `/api/portfolio` | Holdings, current prices, totals and fundamentals, grouped by sector |
| POST | `/api/holdings` | Add a holding |
| POST | `/api/holdings/bulk` | Add up to 100 holdings at once |
| PATCH | `/api/holdings/:id` | Change a holding's name, sector, purchase price or quantity |
| DELETE | `/api/holdings/:id` | Remove a holding |

Sessions live in `httpOnly`, `SameSite=Strict` cookies. Errors come back as `{ "error": { "code", "message", "details" } }`.

## Things worth knowing

- **Market data is unofficial.** Yahoo's endpoints and Google Finance's page layout can change without notice. When a source fails, Folio shows the last known price marked as stale, or leaves the stock out of the gain totals with a notice, rather than showing an error page.
- **Earnings.** Google Finance reports the latest quarter, which is what the dashboard shows. When Google has nothing for a stock, Yahoo's trailing twelve month figure is used instead and labelled `TTM`.
- **Prices are delayed.** Yahoo's NSE and BSE quotes can lag the exchange by a few minutes. Don't trade off them.
- **Unpriced stocks.** A holding with no price still counts toward your invested amount but not toward present value or gain, so totals don't show a loss that isn't real.

More on how it fits together is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
