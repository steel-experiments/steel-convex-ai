# SPECIFICATION — Claude Pricing Watch

Build a scheduled monitor that scrapes `https://claude.com/pricing` every
10 minutes from multiple proxy-routed probes, stores one row per tier per
probe in Convex, and renders a live dashboard that highlights when probes
see different prices. End-to-end replicable in ~20 minutes.

Each code step below is a **prompt** you paste into your coding agent
(Claude Code, Codex, Cursor, etc.). The agent fetches live docs and
generates the file.

## Stack

- **Convex** — backend, reactive queries, cron jobs.
- **`@steel-dev/convex`** — cloud browser with proxy routing.
- **React + Vite** — single-page dashboard.
- **Tailwind v4** + the same shadcn-style `Button` / `Input` primitives
  and dark `#F5D90A` theme used by the chat demo. Copy them verbatim.

No LLM. No streaming. No multi-tenant. Just a scheduled scraper + a grid.

## Prerequisites

- Node 18+, npm.
- Convex account (`npx convex login` once).
- Steel API key, exported as `STEEL_API_KEY`.
- Coding agent running in the project directory.

## Final directory layout

```
price-watch/
├── convex/
│   ├── convex.config.ts    # mounts @steel-dev/convex
│   ├── schema.ts           # priceSnapshots table
│   ├── scraper.ts          # captureFromRegion / captureAll / snapshotNow
│   ├── crons.ts            # 10-min schedule
│   └── prices.ts           # current / history / recentDivergences
├── src/
│   ├── lib/utils.ts        # shadcn cn() helper
│   ├── components/
│   │   ├── ui/{button,input}.tsx
│   │   └── Spinner.tsx
│   ├── index.css
│   ├── main.tsx
│   └── App.tsx             # dashboard UI
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Step 1 — Scaffold

```bash
npm create convex@latest price-watch
cd price-watch
```

Accept React + Vite + TypeScript.

## Step 2 — Install dependencies

```bash
npm install @steel-dev/convex class-variance-authority clsx tailwind-merge
npm install -D tailwindcss @tailwindcss/vite
```

## Step 3 — Mount the Steel component

```
Install the Steel Convex component in convex.config.ts. Docs:
https://www.convex.dev/components/steel-dev/steel-dev.md
```

## Step 4 — Backend env var

```bash
npx convex env set STEEL_API_KEY "$STEEL_API_KEY"
npx convex env list
```

## Step 5 — Tailwind + dark theme

Same constraints as the chat demo: dark only, #F5D90A as the primary /
focus color, minimal — no light mode, no gradients, no shadows.

```
Set up Tailwind v4 with Vite. Use #F5D90A as the primary / focus color,
dark neutrals everywhere else. Add an "@" → ./src path alias. Dark only.
```

If you built the chat demo, copy `src/index.css`, `src/lib/utils.ts`,
`src/components/ui/button.tsx`, `src/components/ui/input.tsx`, and
`src/components/Spinner.tsx` verbatim.

## Step 6 — Schema

```
Create convex/schema.ts with one table, priceSnapshots, that stores
one row per probe-scrape-tier: { region (string label for the probe
slot), tier (e.g. "Pro"), priceText, amount (optional number),
currency (optional), rawMarkdown (for audit), capturedAt }. Indexes:
(region, tier, capturedAt) for per-series history and (capturedAt)
for latest-n lookups.
```

## Step 7 — Scraper

```
Create convex/scraper.ts that scrapes https://claude.com/pricing
through Steel's proxy from three parallel probes ("US", "GB", "DE" —
these are slot labels, not geo guarantees; see notes below) and
stores one priceSnapshots row per detected tier per probe.

- Instantiate a SteelComponent wrapping components.steel with
  STEEL_API_KEY from env.
- captureFromRegion({ region }) internalAction:
  - calls steel.steel.scrape(ctx, { url, commandArgs: { format: ["markdown"], useProxy: true } }, { ownerId: "monitor" })
  - reads result.content.markdown
  - for each tier in ["Free","Pro","Max","Team","Enterprise"], finds the
    first occurrence of the tier name in the markdown, searches the
    next ~600 chars for a ($|€|£)N price, extracts { priceText, amount,
    currency }
  - writes one row per tier via an internalMutation
- captureAll() internalAction: Promise.all over the three probes.
- snapshotNow() public action: calls captureAll — triggered by the UI.

Note: `useProxy: true` is boolean-only on ScrapeParams. Steel picks a
random residential proxy per call, so three parallel probes exercise
three IPs and catch any visitor-bucket-based A/B pricing experiment.
True country-pinned routing requires steel.sessions.create with
`sessionArgs: { useProxy: { geolocation: { country } } }` and scraping
through that session — left as an extension.
```

## Step 8 — Cron

```
Create convex/crons.ts that schedules internal.scraper.captureAll every
10 minutes. Use `cronJobs()` from "convex/server" and `crons.interval`.
```

## Step 9 — Public queries

```
Create convex/prices.ts with three public queries:

- current() — for each (region, tier) pair, return the latest row.
  Shape: { regions, tiers, cells: [{ region, tier, priceText, amount,
  currency, capturedAt }] }.
- history({ region, tier, limit? }) — latest N rows for that series.
- recentDivergences() — for each tier, if the latest snapshots across
  regions don't all share the same numeric amount, return
  { tier, perRegion: [...] }. Drives the "divergence detected" callout.

Use the by_region_tier_time index for efficient "latest per series".
```

## Step 10 — Dashboard UI

```
Replace src/App.tsx with a dashboard.

- Header: "Claude pricing watch" + short subtitle + a ghost "Snapshot
  now" button that calls api.scraper.snapshotNow. While it runs, show
  <Spinner /> next to "snapshotting…" on the button.
- Below the header: if api.prices.recentDivergences is non-empty, a
  yellow-tinted "Divergence detected" card listing each tier and the
  per-region prices. This is the viral callout.
- Main grid: rows = tiers, columns = regions. Each cell shows the
  latest priceText and a relative time ("3m ago"). Cells whose amount
  differs from the majority for their tier are tinted yellow
  (bg-primary/20, text-primary). Empty cells show a dash — or a
  Spinner if snapshotting is in flight.
- Footer line: "Proxy-routed via Steel. Cron runs every 10 minutes."

Dark only, minimal. No shadows, gradients, or decorative animations.
```

## Step 11 — Run it

```bash
# Terminal 1
npx convex dev

# Terminal 2
npm run dev
```

Open the Vite URL, click "Snapshot now". Within ~15–30 seconds the grid
populates with live prices from claude.com/pricing. Re-click to get
fresh probes; watch for divergences between the three rows.

## Step 12 — Verification

- [ ] `npx convex env list` shows `STEEL_API_KEY`.
- [ ] `npx convex dev --once` deploys with no type errors.
- [ ] `npx convex run scraper:snapshotNow '{}'` returns an array with
      three `{ region, inserted }` entries, most of them > 0.
- [ ] `npx convex run prices:current '{}'` returns cells for the
      populated regions.
- [ ] Convex dashboard shows a cron job named "price snapshot" with
      a next-run timestamp.
- [ ] UI grid renders; a stale probe shows "—", a fresh one shows
      a dollar amount + "Xm ago".

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `body/useProxy must be boolean` | Passed `useProxy` as an object on scrape | ScrapeParams only accepts boolean. Object form (`{ geolocation: { country } }`) is for sessions, not scrape. |
| `Invalid region` on scrape | Steel's `region?: unknown` field rejects arbitrary strings | Drop `region` from scrape args; use `useProxy: true` alone and use sessions for country-pinned routing. |
| A probe returns `inserted: 0` | Proxy IP hit a region where Anthropic's page skipped server rendering, or the tier names aren't in the markdown | Transient. Snapshot again. For resilience, fall back to `cleaned_html` or log the raw markdown for inspection. |
| Cron never runs | Dev deployment is paused | Convex dev deployments pause after inactivity; open the dashboard to wake it. |
| `Missing STEEL_API_KEY` | Key set in shell, not Convex | `npx convex env set STEEL_API_KEY "$STEEL_API_KEY"` |

## Build ideas (extensions)

| Idea | Steel module / Convex feature |
|---|---|
| True per-country proxy routing | `steel.sessions.create` with `sessionArgs: { useProxy: { geolocation: { country } } }` |
| Alert when divergence is seen | Convex scheduler + HTTP action posting to Slack/Discord |
| Public price-history API | Add a public HTTP action reading `priceSnapshots` |
| Watch more sites | Add URLs + parsing rules per target site |
| Store screenshots alongside prices | Add a `screenshot` call next to each scrape, write to `ctx.storage` |
| Notify on tier addition/removal | Diff latest vs previous in `recentDivergences` |
