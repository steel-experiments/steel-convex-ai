# SCENARIO — Claude Pricing Watch

A ~5-minute video walkthrough of building a scheduled pricing monitor.
Scrapes `https://claude.com/pricing` every 10 minutes from three
proxy-routed probes, stores snapshots in Convex, and flags when probes
see different prices.

Stack: `@steel-dev/convex` (for the proxy-routed scrape) + Convex
crons + React dashboard. Same dark theme + `#F5D90A` accent as the
chat demo.

Each code step is a prompt to paste into a coding agent.

## Prereqs before hitting record

- Node 18+, npm.
- Steel API key exported as `STEEL_API_KEY`.
- `npx convex login` done once.
- Convex + Steel dashboards pre-opened.
- A coding agent in the project directory.

## Step 1 — Hook (0:00–0:30)

On-camera, say:

> "A couple of days ago, Anthropic got dragged on X. People were posting
> screenshots of Claude Pro at $20, $17, even double that, all on the
> same sign-up page. A/B pricing experiment. The UI didn't tell you,
> your price depended on your visitor bucket."

Cut to the finished dashboard: three columns of probes showing the
latest scraped prices. Then:

> "Let's build the tool that would have caught it. Scheduled scrapes
> through Steel's proxy, one row per probe per tier stored in Convex,
> a dashboard that highlights whenever the probes disagree. Thirteen
> files, about 300 lines, five minutes."

## Step 2 — Scaffold (0:30–0:55)

```bash
npm create convex@latest price-watch
cd price-watch
npm install @steel-dev/convex class-variance-authority clsx tailwind-merge
npm install -D tailwindcss @tailwindcss/vite
```

React + Vite + TypeScript defaults.

## Step 3 — Mount Steel (0:55–1:05)

Paste into the coding agent:

```
Install the Steel Convex component in convex.config.ts. Docs:
https://www.convex.dev/components/steel-dev/steel-dev.md
```

## Step 4 — Backend env var (1:05–1:15)

```bash
npx convex env set STEEL_API_KEY "$STEEL_API_KEY"
npx convex env list
```

## Step 5 — Dark theme + shadcn primitives (1:15–1:35)

Paste:

```
Set up Tailwind v4 with Vite. Use #F5D90A as the primary / focus color,
dark neutrals everywhere else. Add an "@" → ./src path alias. Dark only.

Also add these shadcn-style primitives: cn() helper in src/lib/utils.ts
(clsx + tailwind-merge); a Button in src/components/ui/button.tsx with
primary (yellow) and ghost variants using class-variance-authority; an
Input in src/components/ui/input.tsx; and a Spinner in
src/components/Spinner.tsx that cycles braille dot frames as an inline
yellow span.
```

If the chat-with-page canonical build exists in the same workspace, say
so and the agent will copy these files verbatim.

## Step 6 — Backend (1:35–3:00)

Three prompts in order.

### 6a — Schema

```
Create convex/schema.ts with one table, priceSnapshots, storing one row
per probe-scrape-tier: { region (string label — the probe slot),
tier, priceText, amount (optional number), currency (optional),
rawMarkdown (for audit), capturedAt }. Indexes: (region, tier,
capturedAt) and (capturedAt).
```

### 6b — Scraper

```
Create convex/scraper.ts that scrapes https://claude.com/pricing from
two parallel probes running in Steel's regions "lax" and "iad".

- captureFromRegion({ region }) internalAction: call
  steel.steel.scrape with { delay: 5000, commandArgs: {
  format: ["markdown"], useProxy: true, region } }. Retry once if the
  markdown comes back empty or without any tier names. For each tier
  in ["Free", "Pro", "Max"] find the first mention and extract the
  nearest ($|€|£)N price. Write rows via an internalMutation.
- captureAll(): Promise.all the probes, each wrapped in try/
  catch. A 503 from one Steel region shouldn't blank the dashboard.
- snapshotNow(): public action wrapping captureAll for the UI button.

Notes:
- `region` on ScrapeParams accepts airport-code slugs — "lax" and
  "iad" here. These are where Steel's browser runs.
- `useProxy: true` is boolean on scrape — each probe still gets a
  random residential IP, which is what catches visitor-bucket A/B.
- `delay: 5000` is load-bearing: without it the page returns a nav
  stub with "Oops!" and no tier content.
- Enterprise is omitted — the page shows "Contact sales".
```

While this generates, say:

> "The scraper is one function: call Steel, read the markdown, regex
> out the prices. We fire two parallel probes per tick — two
> random proxy IPs — so if Anthropic's serving different variants to
> different visitors, we see it."

### 6c — Cron + queries

```
Create convex/crons.ts that schedules internal.scraper.captureAll
every 10 minutes via cronJobs().interval.

Create convex/prices.ts with three public queries:
- current(): latest row per (region, tier), joined for the grid.
- history({ region, tier, limit? }): latest N for a series.
- recentDivergences(): for each tier where the latest amounts across
  regions don't all match, return { tier, perRegion: [...] }.
```

## Step 7 — UI (3:00–3:45)

Paste:

```
Replace src/App.tsx with a dashboard.

- Header: "Claude pricing watch" + subtitle + "Snapshot now" ghost
  button that calls api.scraper.snapshotNow. Show <Spinner /> next to
  "snapshotting…" while it runs.
- Below the header: if api.prices.recentDivergences is non-empty, a
  yellow-tinted callout listing each tier with disagreeing amounts
  per region. This is the viral card.
- Main grid: rows = tiers, columns = regions. Latest priceText +
  relative time per cell. Cells diverging from the per-tier majority
  are tinted yellow. Empty cells show "—" (or a Spinner when in
  flight).
- Footer: "Proxy-routed via Steel. Cron runs every 10 minutes."

Dark only, minimal. No extras.
```

## Step 8 — Run it (3:45–4:30)

Terminal 1:
```bash
npx convex dev
```

Terminal 2:
```bash
npm run dev
```

Open the Vite URL. Click **Snapshot now**. Say:

> "Three parallel Steel scrapes, each through a different proxy IP,
> each parsing the same pricing page. Streaming back now."

Within 15–30 seconds the grid fills. If probes disagree, the yellow
divergence card appears on top — that's the money shot. If they all
match this time, tap the button again or wait for the cron.

## Step 9 — Show the pieces (4:30–5:00)

Open the Convex dashboard:

- `priceSnapshots` — one row per probe per tier. Point out that the
  same tier across probes are separate rows.
- `Cron jobs` tab — "price snapshot" listed with a next-run timestamp.
- Steel dashboard → open a recent `sessions` row → click the debug
  URL to show the proxy IP the browser actually used.

Say:

> "Every scrape is a row. Every divergence is a query. If I wanted to
> ping Slack whenever the price changes, I add one HTTP action. If I
> wanted per-country routing instead of just proxied, I swap the
> scrape call for a Steel session with geolocation. Two components,
> a cron, and a grid."

## Step 10 — Wrap (5:00–5:15)

```bash
npm install @steel-dev/convex
```

> "Same component as the chat demo — different use case, same
> primitives. Repo's in the description. Go build."

## Must-show checklist

- [ ] The `useProxy: true` line in `scraper.ts`.
- [ ] The `crons.interval` call in `crons.ts`.
- [ ] "Snapshot now" button triggering a live scrape.
- [ ] Grid populating with real claude.com/pricing numbers.
- [ ] Divergence callout (ideally). If no divergence at record time,
      call that out honestly — "today they're showing everyone the
      same price" — and explain the tool would still flag it.
- [ ] Convex dashboard cron entry + `priceSnapshots` rows.
- [ ] Steel debug URL showing the actual proxy session.

## Out of scope for the main build

- Country-pinned proxy routing (extension — use sessions).
- Alerts / notifications on divergence.
- Historical charts (grid shows latest only; history query exists but
  isn't wired into the UI).
- Screenshots stored alongside prices.
- Multi-site monitoring (hardcoded to claude.com/pricing).

Each is a follow-up.
