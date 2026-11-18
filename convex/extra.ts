import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { roleOf } from "./roles";

const slotV = v.union(v.literal("morning"), v.literal("evening"));

// 식단 · 장보기 체크 · 약 · 복용 기록을 한 번에 읽기
export const overview = query({
  args: { code: v.string(), planFrom: v.string(), logFrom: v.string() },
  handler: async (ctx, { code, planFrom, logFrom }) => {
    if (!roleOf(code)) return null;
    const plans = await ctx.db
      .query("plans")
      .withIndex("by_week", (q) => q.gte("weekStart", planFrom))
      .collect();
    const checks = await ctx.db
      .query("checks")
      .withIndex("by_week_key", (q) => q.gte("weekStart", planFrom))
      .collect();
    const meds = await ctx.db.query("meds").collect();
    const logs = await ctx.db
      .query("medLogs")
      .withIndex("by_date_med_slot", (q) => q.gte("date", logFrom))
      .collect();
    return {
      plans: plans.map((p) => ({ weekStart: p.weekStart, variant: p.variant, days: p.days })),
      checks: checks.map((c) => ({ weekStart: c.weekStart, key: c.key, checked: c.checked })),
      meds: meds.map((m) => ({
        id: m._id as string,
        name: m.name,
        cls: m.cls,
        dose: m.dose,
        times: m.times,
        active: m.active,
        note: m.note,
      })),
      medLogs: logs.map((l) => ({ date: l.date, medId: l.medId, slot: l.slot, taken: l.taken })),
    };
  },
});

export const savePlan = mutation({
  args: {
    code: v.string(),
    weekStart: v.string(),
    variant: v.number(),
    days: v.array(v.object({ b: v.string(), l: v.string(), d: v.string() })),
  },
  handler: async (ctx, { code, ...data }) => {
    if (roleOf(code) !== "edit") throw new Error("권한이 없습니다");
    const existing = await ctx.db
      .query("plans")
      .withIndex("by_week", (q) => q.eq("weekStart", data.weekStart))
      .first();
    if (existing) await ctx.db.replace(existing._id, data);
    else await ctx.db.insert("plans", data);
  },
});

export const setCheck = mutation({
  args: { code: v.string(), weekStart: v.string(), key: v.string(), checked: v.boolean() },
  handler: async (ctx, { code, ...data }) => {
    if (roleOf(code) !== "edit") throw new Error("권한이 없습니다");
    const existing = await ctx.db
      .query("checks")
      .withIndex("by_week_key", (q) => q.eq("weekStart", data.weekStart).eq("key", data.key))
      .first();
    if (existing) await ctx.db.replace(existing._id, data);
    else await ctx.db.insert("checks", data);
  },
});

export const saveMed = mutation({
  args: {
    code: v.string(),
    id: v.optional(v.id("meds")),
    name: v.string(),
    cls: v.optional(v.string()),
    dose: v.optional(v.string()),
    times: v.array(slotV),
    active: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { code, id, ...data }) => {
    if (roleOf(code) !== "edit") throw new Error("권한이 없습니다");
    if (!data.name.trim()) throw new Error("약 이름을 입력해 주세요");
    if (id) await ctx.db.replace(id, data);
    else await ctx.db.insert("meds", data);
  },
});

export const removeMed = mutation({
  args: { code: v.string(), id: v.id("meds") },
  handler: async (ctx, { code, id }) => {
    if (roleOf(code) !== "edit") throw new Error("권한이 없습니다");
    await ctx.db.delete(id);
  },
});

export const setMedLog = mutation({
  args: { code: v.string(), date: v.string(), medId: v.string(), slot: slotV, taken: v.boolean() },
  handler: async (ctx, { code, ...data }) => {
    if (roleOf(code) !== "edit") throw new Error("권한이 없습니다");
    const existing = await ctx.db
      .query("medLogs")
      .withIndex("by_date_med_slot", (q) => q.eq("date", data.date).eq("medId", data.medId).eq("slot", data.slot))
      .first();
    if (existing) await ctx.db.replace(existing._id, data);
    else await ctx.db.insert("medLogs", data);
  },
});
