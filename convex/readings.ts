import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 접속 코드는 Convex 환경변수(EDIT_CODE, VIEW_CODE)로만 관리합니다.
//   npx convex env set EDIT_CODE <기록용 코드>
//   npx convex env set VIEW_CODE <보기용 코드>
function roleOf(code: string): "edit" | "view" | null {
  const edit = process.env.EDIT_CODE;
  const view = process.env.VIEW_CODE;
  if (edit && code === edit) return "edit";
  if (view && code === view) return "view";
  return null;
}

export const list = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const role = roleOf(code);
    if (!role) return null;
    const rows = await ctx.db.query("readings").collect();
    return {
      role,
      readings: rows.map((r) => ({
        id: r._id as string,
        date: r.date,
        slot: r.slot,
        sys: r.sys,
        dia: r.dia,
        pulse: r.pulse,
        meds: r.meds,
        note: r.note,
      })),
    };
  },
});

export const save = mutation({
  args: {
    code: v.string(),
    date: v.string(),
    slot: v.union(v.literal("morning"), v.literal("evening")),
    sys: v.number(),
    dia: v.number(),
    pulse: v.optional(v.number()),
    meds: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { code, ...data }) => {
    if (roleOf(code) !== "edit") throw new Error("권한이 없습니다");
    if (data.sys < 60 || data.sys > 260 || data.dia < 30 || data.dia > 160 || data.sys <= data.dia) {
      throw new Error("수치를 확인해 주세요");
    }
    const existing = await ctx.db
      .query("readings")
      .withIndex("by_date_slot", (q) => q.eq("date", data.date).eq("slot", data.slot))
      .first();
    if (existing) await ctx.db.replace(existing._id, data);
    else await ctx.db.insert("readings", data);
  },
});

export const remove = mutation({
  args: { code: v.string(), id: v.id("readings") },
  handler: async (ctx, { code, id }) => {
    if (roleOf(code) !== "edit") throw new Error("권한이 없습니다");
    await ctx.db.delete(id);
  },
});
