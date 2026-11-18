import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  readings: defineTable({
    date: v.string(), // YYYY-MM-DD (한국 시간 기준)
    slot: v.union(v.literal("morning"), v.literal("evening")),
    sys: v.number(),
    dia: v.number(),
    pulse: v.optional(v.number()),
    meds: v.boolean(),
    note: v.optional(v.string()),
  }).index("by_date_slot", ["date", "slot"]),
  weights: defineTable({
    date: v.string(),
    kg: v.number(),
    note: v.optional(v.string()),
  }).index("by_date", ["date"]),
});
