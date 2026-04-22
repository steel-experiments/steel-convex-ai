// ABOUTME: Split-screen chat app. Left pane is the conversation, right pane
// ABOUTME: slides in with the rendered markdown of whatever page the agent scraped.

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { motion } from "motion/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/Markdown";
import { Spinner } from "@/components/Spinner";
import { ScrapedPagePane } from "@/components/ScrapedPagePane";

const OWNER_ID = "demo-alice";

export default function App() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const createThread = useMutation(api.chat.createThreadForOwner);
  const sendMessage = useAction(api.chat.sendMessage);
  const clearForOwner = useMutation(api.scrape.clearForOwner);
  const latestScrape = useQuery(api.scrape.latestForOwner, {
    ownerId: OWNER_ID,
  });

  const { results: messages = [] } = useThreadMessages(
    api.chat.listThreadMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 50, stream: true },
  );

  useEffect(() => {
    if (!threadId) createThread({ ownerId: OWNER_ID }).then(setThreadId);
  }, [threadId, createThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!threadId || !input.trim() || sending) return;
    const prompt = input;
    setInput("");
    setSending(true);
    try {
      await sendMessage({ threadId, ownerId: OWNER_ID, prompt });
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    setThreadId(null);
    setInput("");
    setSending(false);
    await clearForOwner({ ownerId: OWNER_ID });
  };

  const uiMessages = toUIMessages(messages).filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  // Right pane appears once a message is in flight or a scrape exists.
  const paneVisible = sending || !!latestScrape;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <motion.section
        layout
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={
          paneVisible
            ? "flex flex-col border-r border-border w-1/2 min-w-[420px]"
            : "flex flex-col w-full items-center"
        }
      >
        <div
          className={
            paneVisible
              ? "flex flex-1 flex-col min-h-0 px-6 py-8 w-full"
              : "flex flex-1 flex-col min-h-0 px-6 py-8 w-full max-w-2xl"
          }
        >
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Chat with any webpage
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste a URL, ask a question — answered live via a cloud browser.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto pb-4">
            {uiMessages.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Try:{" "}
                <span className="text-foreground">
                  What's on https://en.wikipedia.org/wiki/Steel?
                </span>
              </div>
            )}

            {uiMessages.map((m) => (
              <div
                key={m.key}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                    : "mr-auto max-w-[95%] rounded-md border border-border bg-muted px-4 py-3"
                }
              >
                {m.role === "assistant" ? (
                  <Markdown>{m.text ?? ""}</Markdown>
                ) : (
                  <span className="whitespace-pre-wrap">{m.text}</span>
                )}
              </div>
            ))}

            {sending && (
              <div className="mr-auto flex items-center gap-2 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Spinner />
                <span>thinking…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form onSubmit={submit} className="mt-2 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about https://en.wikipedia.org/wiki/Steel"
              disabled={!threadId || sending}
            />
            <Button
              type="submit"
              disabled={!threadId || !input.trim() || sending}
            >
              Send
            </Button>
          </form>

          <div className="mt-3 text-xs text-muted-foreground">
            owner: <code className="text-foreground">{OWNER_ID}</code>
          </div>
        </div>
      </motion.section>

      <ScrapedPagePane scrape={latestScrape ?? null} pending={sending} />
    </div>
  );
}
