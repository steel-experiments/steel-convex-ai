# SPECIFICATION — Chat with any webpage

Build a chat app where a user pastes a URL, asks a question, and an AI agent
answers using the live page content — scraped through a cloud browser and
streamed back token-by-token. End-to-end replicable in ~15 minutes.

Each code step below is a **prompt**. Paste it into your coding agent
(Claude Code, Codex, Cursor, etc.). The agent fetches live docs and generates
the file. This stays robust as component APIs evolve.

## Stack

- **Convex** — backend, database, realtime client subscriptions.
- **`@steel-dev/convex`** — cloud browser automation as Convex actions.
- **`@convex-dev/agent`** — AI agent with persistent threads, tool calls,
  and delta streaming over websockets.
- **`@ai-sdk/openai`** (v3, the `ai-v6`-compatible tag) — LLM provider.
- **React + Vite** — frontend scaffold.
- **Tailwind v4** + small set of shadcn-style components.
- **react-markdown** + **remark-gfm** — for rendering assistant replies.
- **motion** — for the split-screen pane animation.

## Prerequisites

- Node 18+ and npm.
- A Convex account — run `npx convex login` once on first run.
- A Steel API key — `https://app.steel.dev`.
- An OpenAI API key.
- A coding agent (Claude Code, Codex, etc.) running in the project directory.
- `STEEL_API_KEY` and `OPENAI_API_KEY` exported in your shell.

## Final directory layout

```
chat-with-page/
├── convex/
│   ├── convex.config.ts    # mounts both components
│   ├── schema.ts           # scrapeCache table
│   ├── scrape.ts           # internal cache helpers
│   ├── agent.ts            # pageAgent + scrapePage tool
│   └── chat.ts             # createThread / sendMessage / listThreadMessages
├── src/
│   ├── lib/
│   │   └── utils.ts        # shadcn cn() helper
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   └── input.tsx
│   │   ├── Markdown.tsx        # react-markdown wrapper
│   │   ├── Spinner.tsx         # ascii-style loading spinner
│   │   └── ScrapedPagePane.tsx # animated right pane
│   ├── index.css           # Tailwind import + theme tokens
│   ├── main.tsx
│   └── App.tsx             # split-screen chat UI
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Step 1 — Scaffold the project

```bash
npm create convex@latest chat-with-page
cd chat-with-page
```

Accept React + Vite + TypeScript. Log in if prompted.

## Step 2 — Install dependencies

The `@ai-sdk/openai` `ai-v6` tag is required for compatibility with the
`ai@6` peer dep used by the agent component.

```bash
npm install @steel-dev/convex @convex-dev/agent @ai-sdk/openai@ai-v6 zod
npm install react-markdown remark-gfm class-variance-authority clsx tailwind-merge motion
npm install -D tailwindcss @tailwindcss/vite
```

## Step 3 — Mount components

Paste this into your coding agent:

```
Install the Steel and Agent Convex components in convex.config.ts. Docs:
- https://www.convex.dev/components/steel-dev/steel-dev.md
- https://www.convex.dev/components/agent/agent.md
```

## Step 4 — Set backend environment variables

Convex functions do not inherit shell env vars. Set them on the deployment:

```bash
npx convex env set STEEL_API_KEY "$STEEL_API_KEY"
npx convex env set OPENAI_API_KEY "$OPENAI_API_KEY"
npx convex env list
```

Both keys should appear.

## Step 5 — Wire Tailwind and the dark theme

Styling constraints for the whole project: **dark only, #F5D90A as the
accent, minimal** — no light mode, no toggle, no decorative effects.

Paste this into your coding agent:

```
Set up Tailwind v4 with Vite. Use #F5D90A as the primary / focus color,
dark neutrals everywhere else. Add an "@" → ./src path alias. Dark only.
```

## Step 6 — Add the scrape cache

Paste this into your coding agent:

```
Add a cache so the agent doesn't re-fetch a URL when the model needs
more chunks. One Convex table keyed by (url, ownerId), with a secondary
index on ownerId for "latest" lookups. Put the table in convex/schema.ts
and these helpers in convex/scrape.ts:

- internal get/put with a 10-minute freshness window.
- A public query, latestForOwner(ownerId), that returns the most recent
  entry joined into one markdown string — the chat UI shows this live
  in a split-screen pane.
- A public mutation, clearForOwner(ownerId), that deletes every cache
  row for that owner. The UI calls this from a "Clear" button to reset
  the demo between takes.
```

## Step 7 — Define the agent and scrape tool

Paste this into your coding agent:

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

## Step 8 — Chat functions with streaming

Paste this into your coding agent:

```
Create convex/chat.ts — the public API the frontend talks to, all scoped
by ownerId:

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

## Step 9 — UI primitives (shadcn-style)

Paste this into your coding agent:

```
Add the minimum shadcn-style primitives the chat screen needs: a cn()
helper (clsx + tailwind-merge) in src/lib/utils.ts, and a Button and
Input in src/components/ui/. Button uses class-variance-authority with
a primary variant (the yellow) and a ghost variant. Input picks up the
dark muted background and the yellow focus ring. Both forwardRef and
accept className. Keep them minimal — this is for one screen, not a
design system.
```

## Step 10 — Markdown renderer

Paste this into your coding agent:

```
Add src/components/Markdown.tsx using react-markdown + remark-gfm.
Style for dark theme with tight spacing — headings, lists, inline
code, code blocks, blockquotes, links. Yellow accent on links and
blockquote bars. Readable, not decorated.
```

## Step 11 — Spinner and split-screen pane

Paste this into your coding agent:

```
Add two small components for the chat screen:

src/components/Spinner.tsx — a tiny React component that cycles
braille dot frames ("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏") every ~90ms. Renders as an
inline yellow span. Used next to "thinking…" and in the pane.

src/components/ScrapedPagePane.tsx — the right-side pane that shows
the latest scraped page's markdown. Uses motion/react to slide in
from the right (width 0 → 50%, opacity 0 → 1, ease-out, ~450ms).
Header shows the page title as a link and its char count. Body
renders through the Markdown component. While waiting for data,
center the Spinner. The pane exits (animates out) when there's
nothing to show.
```

## Step 12 — Chat UI

Paste this into your coding agent:

```
Replace src/App.tsx with a two-pane chat screen.

Left pane: the conversation. Right pane: the latest scraped page,
rendered as markdown. The right pane is hidden until there's a message
in flight or a scrape to show, then animates in — the left pane shrinks
from full width to half, and the right slides in. Use motion/react for
the left-pane width transition.

Behavior:
- Constant OWNER_ID = "demo-alice" (swapped live on camera for tenancy).
- On mount, create a thread via api.chat.createThreadForOwner.
- Subscribe to messages via useThreadMessages with { stream: true }.
- Subscribe to api.scrape.latestForOwner({ ownerId }) for the pane.
- Sending calls api.chat.sendMessage, disables input, auto-scrolls.
- While sending, show <Spinner /> next to "thinking…" in the chat bubble.
- A small "Clear" button lives in the top-right of the left pane's
  header. On click it calls api.scrape.clearForOwner, resets threadId
  to null (which triggers a fresh thread), and clears the input. This
  gives a clean slate between takes — important because the pane is
  backed by Convex state that survives page refresh.

Dark only, minimal. Animations only for the split-screen transition
and the spinner.
```

## Step 13 — Run it

```bash
# Terminal 1
npx convex dev

# Terminal 2
npm run dev
```

Open the Vite URL, paste `https://en.wikipedia.org/wiki/Steel`, ask "when
was stainless steel invented?". Expected:

1. User message appears immediately.
2. The "thinking…" bubble shows with the spinner next to it.
3. The right pane slides in from the right once the scrape lands.
4. The rendered page fills the right pane; the assistant bubble on the
   left fills in live as deltas stream back.
5. Convex dashboard has rows in `agent.messages`, `agent.threads`,
   `steel.sessions`, and `scrapeCache`. Click the session's Steel debug
   URL to watch the actual cloud browser.

## Step 14 — Verification checklist

- [ ] `npx convex env list` shows `STEEL_API_KEY` and `OPENAI_API_KEY`.
- [ ] `npx convex dev` starts without type errors.
- [ ] First send of a URL creates one row in `steel.sessions`, one in
      `scrapeCache`, and several messages in `agent.messages`.
- [ ] Second send of the SAME URL within 10 minutes does not create a new
      `steel.sessions` row — the cache is doing its job.
- [ ] Changing `OWNER_ID` in `src/App.tsx` to a different string produces
      a separate thread in `agent.threads` with a distinct `userId`.
- [ ] The assistant bubble fills in gradually as tokens arrive (streaming),
      not all at once at the end.
- [ ] The assistant reply renders markdown: bold, italics, links, lists
      all display correctly.
- [ ] The right pane slides in the first time content arrives and shows
      the scraped page's markdown.
- [ ] The spinner animates next to "thinking…" while the action is
      in flight.

## Troubleshooting

If a prompt's generated code doesn't run, paste the error back to the
coding agent along with the component's docs link. Most failures are
API-shape drift and resolve in one follow-up prompt.

| Symptom | Likely cause | Fix |
|---|---|---|
| `Missing STEEL_API_KEY` in Convex logs | Key set in shell, not in Convex | `npx convex env set STEEL_API_KEY "$STEEL_API_KEY"` |
| `No matching export ... components` | Wrong import path | Import `components` from `./_generated/api`, not `./_generated/server` |
| Tool never fires | Model too weak or prompt vague | Use `gpt-5.4-mini` or stronger; tighten the tool description |
| Assistant message stays empty after tool call | Missing `stopWhen: stepCountIs(N)` | AI SDK v6 requires an explicit stop condition to continue after a tool call |
| `This model's maximum context length is N tokens…` | Returning the whole scrape blob, not the markdown field | Pass `commandArgs: { format: ["markdown"] }` to scrape and return only `result.content.markdown` |
| Scrape returns empty content | Steel's default format is HTML | Pass `commandArgs: { format: ["markdown"] }` in the scrape call |
| Answer arrives all at once (no streaming) | Action uses `generateText`, or query skips `syncStreams`, or hook lacks `stream: true` | All three pieces need to be wired: `streamText` + `saveStreamDeltas`, `syncStreams`, and the hook option |
| `ai` / `@ai-sdk/openai` version mismatch | Default `@ai-sdk/openai` is v1 which pairs with `ai@5` | Install `@ai-sdk/openai@ai-v6` to match `ai@6` used by the agent component |

## Build ideas (extensions)

The base build is intentionally small. The same two components support
much more. Each of these is a one-step extension:

| Idea | Modules to reach for |
|---|---|
| Chat with pages behind a login | `credentials`, `sessions` |
| Scheduled price or news monitoring | Convex crons + `sessions` |
| Solve captchas in-session | `captchas` |
| Per-user browser profiles that persist | `profiles` |
| Upload browser extensions (ad blockers, etc.) | `extensions` |
| Attach user files to a browsing session | `sessionFiles` |
| Enforce per-user rate limits | Rate Limiter component + `ownerId` |
| Multi-agent research workflows | `@convex-dev/agent` workflows |

Swap `OWNER_ID` for the authenticated user id from Clerk, WorkOS, or any
auth provider and the build becomes a real multi-tenant product.
