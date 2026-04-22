# SCENARIO — Chat with any webpage

A ~6-minute video walkthrough of building a chat app where a user pastes a
URL, asks a question, and an AI agent answers using the live page content
— scraped through a cloud browser and streamed back token-by-token.

Stack: `@steel-dev/convex` + `@convex-dev/agent` on Convex, React + Vite
frontend, Tailwind v4 with a dark theme (#F5D90A accent), markdown
rendering, motion for the split-screen animation.

Each code step is a prompt to paste into a coding agent (Claude Code, Codex,
Cursor, etc.) — no manual code copying.

## Prereqs before hitting record

- Node 18+, npm.
- Steel API key from `https://app.steel.dev`, exported as `STEEL_API_KEY`.
- OpenAI API key, exported as `OPENAI_API_KEY`.
- `npx convex login` done once.
- Convex and Steel dashboards pre-opened in browser tabs.
- Two terminals ready.
- A coding agent running in the project directory.

## Step 1 — Hook (0:00–0:30)

On-camera, say:

> "Giving an AI access to live web pages sounds simple. It isn't — you need
> a browser, session management, a place to store state. Today we're
> skipping all of that."

Cut to the finished app answering a question about a real URL. Then say:

> "This chat opens any web page in a real cloud browser, streams the answer
> back in real time, and scopes everything per user. Two Convex components.
> Let's build it."

## Step 2 — Scaffold (0:30–0:55)

Terminal:

```bash
npm create convex@latest chat-with-page
cd chat-with-page
npm install @steel-dev/convex @convex-dev/agent @ai-sdk/openai@ai-v6 zod
npm install react-markdown remark-gfm class-variance-authority clsx tailwind-merge motion
npm install -D tailwindcss @tailwindcss/vite
```

Accept defaults (React + Vite + TypeScript). The `@ai-v6` tag on
`@ai-sdk/openai` is the version that pairs with `ai@6`, the peer dep used
by `@convex-dev/agent`.

## Step 3 — Mount components (0:55–1:10)

Paste into the coding agent:

```
Install the Steel and Agent Convex components in convex.config.ts. Docs:
- https://www.convex.dev/components/steel-dev/steel-dev.md
- https://www.convex.dev/components/agent/agent.md
```

## Step 4 — Backend env vars (1:10–1:25)

```bash
npx convex env set STEEL_API_KEY "$STEEL_API_KEY"
npx convex env set OPENAI_API_KEY "$OPENAI_API_KEY"
npx convex env list
```

Say:

> "One gotcha. Convex functions don't inherit your shell env vars — they
> have to be set on the deployment. Almost everyone trips on this the
> first time."

## Step 5 — Dark theme + Tailwind (1:25–1:50)

Paste into the coding agent:

```
Set up Tailwind v4 with Vite. Use #F5D90A as the primary / focus color,
dark neutrals everywhere else. Add an "@" → ./src path alias. Dark only.
```

## Step 6 — Backend (1:50–3:10)

Three prompts, one after the other. Each produces one file.

### 6a — `convex/schema.ts` + `convex/scrape.ts`

```
Add a cache so the agent doesn't re-fetch a URL when the model needs
more chunks. One Convex table keyed by (url, ownerId), with a second
index on ownerId for "latest" lookups. Table in convex/schema.ts,
helpers in convex/scrape.ts — internal get/put (10-minute freshness),
a public query latestForOwner(ownerId) that joins the most recent
entry's chunks into one markdown string (shown live in the right
pane), and a public mutation clearForOwner(ownerId) that deletes all
cache rows for that owner (used by the UI's Clear button).
```

### 6b — `convex/agent.ts`

```
Create convex/agent.ts with a pageAgent that knows how to read webpages.

Give it one tool, scrapePage, that pulls a URL through the Steel
component, chunks the returned markdown into ~25k-char paragraph-boundary
pieces, caches them via convex/scrape.ts, and returns one chunk at a
time (with a chunkIndex the model can advance).

Two gotchas:
- Steel's scrape defaults to HTML. Pass `commandArgs: { format: ["markdown"] }`
  and read `result.content.markdown` (it's nested).
- AI SDK v6 needs `stopWhen: stepCountIs(8)` on the Agent, or the model
  stops after one tool call.

Model: openai.chat("gpt-5.4-mini"). Instruct it to call scrapePage for
any mentioned URL, paginate while hasMore is true, and quote a phrase
from the page.

Docs:
- https://www.convex.dev/components/agent/agent.md
- https://www.convex.dev/components/steel-dev/steel-dev.md
```

While the agent writes this file, say:

> "The whole integration is one tool — scrapePage. When the user mentions
> a URL, the model calls it on its own. The tool pages through long
> articles by returning chunks, cached per user so we don't re-scrape."

### 6c — `convex/chat.ts`

```
Create convex/chat.ts — the public API, all scoped by ownerId:

- createThreadForOwner(ownerId) — mutation, returns a new thread id.
- sendMessage(threadId, ownerId, prompt) — action. Continue the thread,
  call thread.streamText with saveStreamDeltas: true, then await
  consumeStream so tokens flush to the DB as they arrive.
- listThreadMessages(threadId, paginationOpts, streamArgs) — query that
  merges listMessages (persisted) with syncStreams (in-flight).

Streaming needs all three — action, query, and the useThreadMessages
hook later — or no tokens flow.

Docs: https://www.convex.dev/components/agent/agent.md
```

## Step 7 — UI (3:10–3:55)

Three prompts, one after the other.

### 7a — UI primitives

```
Add the minimum shadcn-style primitives the chat screen needs: a cn()
helper (clsx + tailwind-merge) in src/lib/utils.ts, and a Button and
Input in src/components/ui/. Button uses class-variance-authority with
a primary variant (the yellow) and a ghost variant. Input uses the
dark muted background and the yellow focus ring. Both forwardRef and
accept className. Keep them minimal — this is for one screen, not a
design system.
```

### 7b — Markdown renderer

```
Add src/components/Markdown.tsx using react-markdown + remark-gfm.
Style for dark theme with tight spacing — headings, lists, inline
code, code blocks, blockquotes, links. Yellow accent on links and
blockquote bars. Readable, not decorated.
```

### 7c — Spinner + split-screen pane

```
Add two small components:

src/components/Spinner.tsx — a React component that cycles braille
dot frames ("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏") every ~90ms. Renders as an inline
yellow span. Used next to "thinking…" and in the pane.

src/components/ScrapedPagePane.tsx — the right-side pane that shows
the latest scraped page. Uses motion/react to slide in from the
right (width 0 → 50%, opacity 0 → 1, ease-out, ~450ms). Header: title
as a link + char count. Body: rendered Markdown. Spinner while
waiting. Exits (animates out) when there's nothing to show.
```

### 7d — `src/App.tsx`

```
Replace src/App.tsx with a two-pane chat screen.

Left pane: the conversation. Right pane: the latest scraped page
rendered as markdown. Right pane is hidden until there's a message in
flight or a scrape to show, then animates in — left pane shrinks from
full width to half, right slides in. Use motion/react.

Behavior:
- Constant OWNER_ID = "demo-alice" (swapped on camera for tenancy).
- On mount, create a thread via api.chat.createThreadForOwner.
- Subscribe to messages via useThreadMessages with { stream: true }.
- Subscribe to api.scrape.latestForOwner({ ownerId }) for the pane.
- Sending calls api.chat.sendMessage, disables input, auto-scrolls.
- While sending, show <Spinner /> next to "thinking…" in the chat.
- A small "Clear" button in the top-right of the left pane's header
  calls api.scrape.clearForOwner, resets threadId to null (which
  triggers a fresh thread), and clears the input — a clean slate
  between takes.

Dark only, minimal. Animations only for the split-screen transition
and the spinner.
```

## Step 8 — Run it (3:55–4:40)

Terminal 1:

```bash
npx convex dev
```

Terminal 2:

```bash
npm run dev
```

Open the Vite URL. Paste:

```
https://en.wikipedia.org/wiki/Steel
```

Ask:

```
When was stainless steel invented? Short quote from the article.
```

Expected: user message appears, the "thinking…" bubble spins, then the
right pane slides in with the scraped page's markdown while the assistant
bubble fills in live on the left. Pause on this beat — it's the strongest
single frame in the video.

Say:

> "Left is the chat. Right is the actual page my agent just read — the
> full markdown it's reasoning over. And the answer is streaming in live."

While the assistant is still talking, open the Steel dashboard, click the
active session's debug URL, and show the cloud browser:

> "This is the actual browser Steel opened. You can watch it live. When
> something breaks in production, you're not guessing from logs — you can
> see exactly what the browser sees."

The Steel/Steel pun is intentional. Lean into it: "We're using Steel to
chat with the Wikipedia article on Steel."

## Step 9 — Show the database (4:40–5:05)

Open Convex dashboard → Data. Click through:

- `agent.messages` — user prompt, streamed assistant reply, tool calls.
- `agent.threads` — one row with `userId: "demo-alice"`.
- `steel.sessions` — the session Steel opened and released.
- `scrapeCache` — one row per (url, ownerId) with chunked markdown.

Say:

> "Everything is sitting in your Convex database. Messages, scrapes,
> sessions, all in tables you can query like any other data. If you want
> a history view or a billing page, the data's already there."

## Step 10 — Why a real browser (5:05–5:35)

The "fetch can't do this" moment. In a fresh terminal tab:

```bash
curl -s https://www.notion.so/templates | head -30
```

Expected output: an almost-empty `<div id="__next">` shell.

Say:

> "That's what curl sees — an empty shell. The content is rendered by
> JavaScript. Watch the same URL in our app."

Paste the URL into the chat UI, ask a simple question. Open the Steel
debug URL to show the browser rendering the page. Answer streams in with
real content.

> "Steel ran the JavaScript, rendered the page, handed us the text. That's
> the thing a fetch can't do."

Backup targets if Notion is flaky on the day: `vercel.com/templates`, a
public Linear page, any SPA without SSR. Verify the curl-returns-empty
property the morning of recording.

## Step 11 — Multi-tenancy swap (5:35–5:55)

In `src/App.tsx`, change:

```ts
const OWNER_ID = "demo-alice";
```

to:

```ts
const OWNER_ID = "demo-bob";
```

Reload the browser. Ask a different question. Open Convex dashboard →
`agent.threads`. Show two rows with different `userId`s, each with their
own messages. Say:

> "That's multi-tenancy, basically for free. One string, ownerId, and
> Alice's stuff stays out of Bob's stuff. No session-ownership scheme to
> invent."

## Step 12 — What you could build (5:55–6:25)

On-screen list (bullets appear as you say them):

- Chat with pages behind a login → `credentials` + `sessions`
- Scheduled monitoring (prices, news, competitors) → Convex crons + `sessions`
- Sites gated by captchas → `captchas`
- Per-user browser profiles that persist → `profiles`
- Fleets of parallel browsers, one per user → `ownerId` scoping

Say:

> "This was the simplest version — one tool, one agent, streamed answers.
> The same two components handle logins, captchas, per-user profiles, and
> scheduled automations. Pick whichever is closest to something you
> actually need, and build that."

## Step 13 — Wrap (6:25–6:40)

Show the install line:

```bash
npm install @steel-dev/convex @convex-dev/agent
```

Say:

> "Two components, one deploy, browser automation you can actually hand
> to users. Repo's in the description. That's it."

## Must-show checklist

- [ ] The two `app.use` lines in `convex.config.ts`.
- [ ] The `scrapePage` tool body.
- [ ] Right pane sliding in on first scrape (the money shot).
- [ ] Spinner animating next to "thinking…".
- [ ] Assistant text streaming into the UI (not arriving all at once).
- [ ] Steel debug URL showing the cloud browser rendering a page.
- [ ] Convex dashboard rows in `agent.*`, `steel.*`, and `scrapeCache`.
- [ ] `curl` on a JS-heavy URL returning an empty shell, then Steel
      rendering the same URL.
- [ ] `OWNER_ID` swap producing two isolated threads.

## Out of scope for the main build

Long-lived sessions with explicit release, profiles, credentials,
extensions, captchas, auth, rate limiting, usage tracking. Each appears
on the "what you could build" list so viewers know they exist — just
not implemented in the main walkthrough.
