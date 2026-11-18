import { internalQuery, internalAction } from "./_generated/server";
import { makeFunctionReference } from "convex/server";

// 전체 데이터 덤프 (내부 전용: 접속 코드 없이 서버에서만 호출)
export const dump = internalQuery({
  args: {},
  handler: async (ctx) => {
    const readings = await ctx.db.query("readings").collect();
    const weights = await ctx.db.query("weights").collect();
    const meds = await ctx.db.query("meds").collect();
    const medLogs = await ctx.db.query("medLogs").collect();
    const plans = await ctx.db.query("plans").collect();
    return {
      readings: readings.map((r) => ({
        date: r.date, slot: r.slot, sys: r.sys, dia: r.dia, pulse: r.pulse ?? null, meds: r.meds, note: r.note ?? "",
      })),
      weights: weights.map((w) => ({ date: w.date, kg: w.kg, note: w.note ?? "" })),
      meds: meds.map((m) => ({
        id: m._id as string, name: m.name, cls: m.cls ?? "", dose: m.dose ?? "", times: m.times, active: m.active, note: m.note ?? "",
      })),
      medLogs: medLogs.map((l) => ({ date: l.date, medId: l.medId, slot: l.slot, taken: l.taken })),
      plans: plans.map((p) => ({ weekStart: p.weekStart, days: p.days })),
    };
  },
});

const dumpRef = makeFunctionReference<"query", Record<string, never>, any>("backup:dump");

// 매일 한 번 Google Apps Script(내 드라이브)로 전송
export const toDrive = internalAction({
  args: {},
  handler: async (ctx) => {
    const url = process.env.BACKUP_URL;
    const token = process.env.BACKUP_TOKEN;
    if (!url || !token) {
      console.log("BACKUP_URL / BACKUP_TOKEN 미설정 — 백업 건너뜀");
      return { ok: false, reason: "not-configured" };
    }
    const data = await ctx.runQuery(dumpRef as any, {});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, exportedAt: new Date().toISOString(), data }),
    });
    const text = await res.text();
    console.log("drive backup:", res.status, text.slice(0, 200));
    if (!res.ok || !text.includes('"ok":true')) throw new Error("백업 실패: " + res.status + " " + text.slice(0, 200));
    return { ok: true };
  },
});
