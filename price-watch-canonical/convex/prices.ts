// ABOUTME: Public queries for the dashboard: latest prices, per-series
// ABOUTME: history, and a divergence check that drives the viral callout.

import { v } from "convex/values";
import { query } from "./_generated/server";

const REGIONS = ["US", "GB", "DE"] as const;
const TIERS = ["Free", "Pro", "Max", "Team", "Enterprise"] as const;

async function latestFor(
  ctx: { db: { query: (t: "priceSnapshots") => any } },
  region: string,
  tier: string,
) {
  return await ctx.db
    .query("priceSnapshots")
    .withIndex("by_region_tier_time", (q: any) =>
      q.eq("region", region).eq("tier", tier),
    )
    .order("desc")
    .first();
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const cells: Array<{
      region: string;
      tier: string;
      priceText: string;
      amount?: number;
      currency?: string;
      capturedAt: number;
    }> = [];
    for (const region of REGIONS) {
      for (const tier of TIERS) {
        const row = await latestFor(ctx, region, tier);
        if (row) {
          cells.push({
            region,
            tier,
            priceText: row.priceText,
            amount: row.amount,
            currency: row.currency,
            capturedAt: row.capturedAt,
          });
        }
      }
    }
    return { regions: [...REGIONS], tiers: [...TIERS], cells };
  },
});

export const history = query({
  args: { region: v.string(), tier: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { region, tier, limit }) => {
    const rows = await ctx.db
      .query("priceSnapshots")
      .withIndex("by_region_tier_time", (q) =>
        q.eq("region", region).eq("tier", tier),
      )
      .order("desc")
      .take(limit ?? 20);
    return rows.map((r) => ({
      priceText: r.priceText,
      amount: r.amount,
      currency: r.currency,
      capturedAt: r.capturedAt,
    }));
  },
});

// A divergence = at a given tier, not every region reports the same amount.
// Returns one entry per tier that has disagreement across regions.
export const recentDivergences = query({
  args: {},
  handler: async (ctx) => {
    const out: Array<{
      tier: string;
      perRegion: Array<{ region: string; priceText: string; amount?: number }>;
    }> = [];
    for (const tier of TIERS) {
      const perRegion: Array<{
        region: string;
        priceText: string;
        amount?: number;
      }> = [];
      for (const region of REGIONS) {
        const row = await latestFor(ctx, region, tier);
        if (row) {
          perRegion.push({
            region,
            priceText: row.priceText,
            amount: row.amount,
          });
        }
      }
      const amounts = perRegion
        .map((p) => p.amount)
        .filter((a): a is number => typeof a === "number");
      if (amounts.length >= 2 && new Set(amounts).size > 1) {
        out.push({ tier, perRegion });
      }
    }
    return out;
  },
});
