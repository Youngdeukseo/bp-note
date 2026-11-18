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
  plans: defineTable({
    weekStart: v.string(),
    variant: v.number(),
    days: v.array(v.object({ b: v.string(), l: v.string(), d: v.string() })),
  }).index("by_week", ["weekStart"]),
  checks: defineTable({
    weekStart: v.string(),
    key: v.string(),
    checked: v.boolean(),
  }).index("by_week_key", ["weekStart", "key"]),
  meds: defineTable({
    name: v.string(),
    cls: v.optional(v.string()),
    dose: v.optional(v.string()),
    times: v.array(v.union(v.literal("morning"), v.literal("evening"))),
    active: v.boolean(),
    note: v.optional(v.string()),
  }),
  medLogs: defineTable({
    date: v.string(),
    medId: v.string(),
    slot: v.union(v.literal("morning"), v.literal("evening")),
    taken: v.boolean(),
  }).index("by_date_med_slot", ["date", "medId", "slot"]),
  weights: defineTable({
    date: v.string(),
    kg: v.number(),
    note: v.optional(v.string()),
  }).index("by_date", ["date"]),
});
