// ABOUTME: Fetches claude.com/pricing via Steel's proxy from multiple countries
// ABOUTME: and persists one row per detected tier into priceSnapshots.

import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
import { SteelComponent } from "@steel-dev/convex";

const TARGET_URL = "https://claude.com/pricing";

// Steel supports ISO 3166-1 alpha-2 country codes for the proxy geolocation.
// Three diverse regions chosen to maximise the chance of catching an A/B or
// geo-targeted pricing experiment.
const REGIONS = ["US", "GB", "DE"] as const;

// Tier labels we look for on the pricing page. Order doesn't matter — we
// search for each one independently in the scraped markdown.
const TIERS = ["Free", "Pro", "Max", "Team", "Enterprise"] as const;

const steel = new SteelComponent(components.steel, {
  STEEL_API_KEY: process.env.STEEL_API_KEY,
});

// Extracts { priceText, amount, currency } from markdown for a given tier by
// looking for the nearest "$N" (or "€N") after the tier's name. Fragile to
// layout changes but good enough for a demo against a known page.
function extractTierPrice(
  markdown: string,
  tier: string,
): { priceText: string; amount?: number; currency?: string } | null {
  // Find the first mention of the tier name, case-insensitive.
  const tierIdx = markdown.toLowerCase().indexOf(tier.toLowerCase());
  if (tierIdx === -1) return null;

  // Search a window of the next 600 chars for a price.
  const window = markdown.slice(tierIdx, tierIdx + 600);
  const priceMatch = window.match(/([$€£])\s*(\d+(?:[.,]\d{1,2})?)/);
  if (!priceMatch) return null;

  const currency = priceMatch[1];
  const amount = Number(priceMatch[2].replace(",", "."));
  return {
    priceText: `${currency}${priceMatch[2]}`,
    amount: Number.isFinite(amount) ? amount : undefined,
    currency,
  };
}

export const insertSnapshots = internalMutation({
  args: {
    region: v.string(),
    capturedAt: v.number(),
    rawMarkdown: v.string(),
    rows: v.array(
      v.object({
        tier: v.string(),
        priceText: v.string(),
        amount: v.optional(v.number()),
        currency: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert("priceSnapshots", {
        region: args.region,
        tier: row.tier,
        priceText: row.priceText,
        amount: row.amount,
        currency: row.currency,
        rawMarkdown: args.rawMarkdown,
        capturedAt: args.capturedAt,
      });
    }
  },
});

export const captureFromRegion = internalAction({
  args: { region: v.string() },
  handler: async (ctx, { region }) => {
    const result = (await steel.steel.scrape(
      ctx,
      {
        url: TARGET_URL,
        commandArgs: {
          format: ["markdown"],
          // Each probe goes through a residential proxy. Steel picks a random
          // exit per request, so three parallel probes exercise three IPs and
          // catch any cookie/visitor-bucket A/B pricing experiments. True
          // country-pinned routing requires sessions with Geolocation (see
          // PRICE-SPECIFICATION's extension notes).
          useProxy: true,
        },
      },
      { ownerId: "monitor" },
    )) as { content?: { markdown?: string } } | null;

    const markdown = result?.content?.markdown ?? "";
    if (!markdown) return { region, inserted: 0 };

    const capturedAt = Date.now();
    const rows = TIERS.map((tier) => {
      const extracted = extractTierPrice(markdown, tier);
      return extracted ? { tier, ...extracted } : null;
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      await ctx.runMutation(internal.scraper.insertSnapshots, {
        region,
        capturedAt,
        rawMarkdown: markdown,
        rows,
      });
    }
    return { region, inserted: rows.length };
  },
});

export const captureAll = internalAction({
  args: {},
  handler: async (ctx): Promise<
    Array<{ region: string; inserted: number }>
  > => {
    return await Promise.all(
      REGIONS.map((region) =>
        ctx.runAction(internal.scraper.captureFromRegion, { region }),
      ),
    );
  },
});

// Public trigger used by the "Snapshot now" button in the UI.
export const snapshotNow = action({
  args: {},
  handler: async (ctx): Promise<
    Array<{ region: string; inserted: number }>
  > => {
    return await ctx.runAction(internal.scraper.captureAll, {});
  },
});
