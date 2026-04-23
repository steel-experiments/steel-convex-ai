// ABOUTME: Stores one price snapshot per (region, tier, capturedAt) so the
// ABOUTME: dashboard can show current values, divergences, and history.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  priceSnapshots: defineTable({
    region: v.string(), // ISO 3166-1 alpha-2, e.g. "US", "GB", "DE"
    tier: v.string(), // "Free" | "Pro" | "Max" | "Team" | "Enterprise"
    priceText: v.string(), // raw as scraped, e.g. "$20/month"
    amount: v.optional(v.number()), // parsed numeric amount
    currency: v.optional(v.string()), // parsed currency symbol
    rawMarkdown: v.string(), // full page markdown for audit
    capturedAt: v.number(),
  })
    .index("by_region_tier_time", ["region", "tier", "capturedAt"])
    .index("by_time", ["capturedAt"]),
});
