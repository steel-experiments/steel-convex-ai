// ABOUTME: Right-hand pane that renders the latest page the agent scraped.
// ABOUTME: Slides in with a motion animation when the first scrape arrives.

import { motion, AnimatePresence } from "motion/react";
import { Markdown } from "@/components/Markdown";
import { Spinner } from "@/components/Spinner";

export type LatestScrape = {
  url: string;
  title: string;
  markdown: string;
  createdAt: number;
} | null;

export function ScrapedPagePane({
  scrape,
  pending,
}: {
  scrape: LatestScrape;
  pending: boolean;
}) {
  const visible = !!scrape || pending;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.aside
          key="pane"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "50%", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="border-l border-border bg-muted/40 overflow-hidden"
        >
          <div className="h-full flex flex-col min-w-[420px]">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-xs text-muted-foreground">
              {scrape ? (
                <>
                  <a
                    href={scrape.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-foreground hover:text-primary"
                  >
                    {scrape.title || scrape.url}
                  </a>
                  <span className="shrink-0 font-mono">
                    {scrape.markdown.length.toLocaleString()} chars
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Spinner />
                  <span>fetching page…</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {scrape ? (
                <Markdown>{scrape.markdown}</Markdown>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Spinner className="text-2xl" />
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
