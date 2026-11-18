import { CAT_ORDER, RECIPES, RECIPE_MAP, type Cat, type MealType, type Recipe } from "./recipes";
import { addDays, weekStart, type Check } from "./bp";

export type SlotKey = "b" | "l" | "d";
export const SLOT_KEYS: SlotKey[] = ["b", "l", "d"];
export const SLOT_NAME: Record<SlotKey, string> = { b: "아침", l: "점심", d: "저녁" };
const SLOT_TYPE: Record<SlotKey, MealType> = { b: "B", l: "L", d: "D" };

/** 레시피 id 또는 "skip"(이 끼니는 먹지 않음/외식) */
export interface PlanDay {
  b: string;
  l: string;
  d: string;
}
export interface Plan {
  weekStart: string; // 월요일 YYYY-MM-DD
  variant: number; // 다시 뽑기 횟수
  days: PlanDay[]; // 월~일 7개
}

export const SODIUM_TARGET = 2000; // mg/일 (소금 약 5g)

/* ---------------- 시드 난수 (같은 주 + 같은 variant면 두 폰에서 같은 식단) ---------------- */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Group = "fish" | "chicken" | "tofu" | "beef" | "pork" | "egg" | "dairy" | "none";
const groupOf = (r: Recipe): Group => (r.protein === "seafood" ? "fish" : (r.protein as Group));

function prevIds(prev: Plan | undefined): Set<string> {
  const s = new Set<string>();
  prev?.days.forEach((d) => SLOT_KEYS.forEach((k) => s.add(d[k])));
  return s;
}

/** 주간 식단 생성: 단백질을 골고루(생선 4, 닭 3, 두부 2, 소/돼지/달걀 각 1~2), 지난주와 겹치지 않게 */
export function generatePlan(ws: string, variant: number, prev?: Plan): Plan {
  const rnd = mulberry32(hashStr(`${ws}#${variant}`));
  const seen = prevIds(prev);
  const days: PlanDay[] = Array.from({ length: 7 }, () => ({ b: "", l: "", d: "" }));

  // 아침: 지난주에 안 먹은 것 우선
  const bPool = shuffle(RECIPES.filter((r) => r.type === "B"), rnd).sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
  bPool.slice(0, 7).forEach((r, i) => (days[i].b = r.id));
  const bOrder = shuffle(days.map((_, i) => i), rnd);
  const bIds = days.map((d) => d.b);
  bOrder.forEach((di, k) => (days[di].b = bIds[k]));

  // 점심/저녁: 단백질 목표를 정하고 이웃한 끼니가 같지 않게 섞는다
  const lTargets: Group[] = ["fish", "fish", "chicken", "chicken", "tofu", "beef", rnd() < 0.5 ? "pork" : "egg"];
  const dTargets: Group[] = ["fish", "fish", "tofu", "chicken", "beef", "pork", "egg"];
  let L = lTargets;
  let D = dTargets;
  for (let tries = 0; tries < 300; tries++) {
    L = shuffle(lTargets, rnd);
    D = shuffle(dTargets, rnd);
    let ok = true;
    for (let i = 0; i < 7 && ok; i++) {
      if (L[i] === D[i]) ok = false;
      if (i < 6 && D[i] === L[i + 1]) ok = false;
    }
    if (ok) break;
  }

  const used = new Set<string>();
  const pick = (type: MealType, g: Group): string => {
    const pool = RECIPES.filter((r) => r.type === type && groupOf(r) === g && !used.has(r.id));
    const cand = shuffle(pool, rnd).sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
    const chosen =
      cand[0] ??
      shuffle(
        RECIPES.filter((r) => r.type === type && !used.has(r.id)),
        rnd
      )[0];
    used.add(chosen.id);
    return chosen.id;
  };
  for (let i = 0; i < 7; i++) {
    days[i].l = pick("L", L[i]);
    days[i].d = pick("D", D[i]);
  }
  return { weekStart: ws, variant, days };
}

/** 한 끼니 바꾸기: 이번 주에 아직 없는 같은 종류 레시피로 교체 */
export function swapSlot(plan: Plan, dayIdx: number, slot: SlotKey): Plan {
  const type = SLOT_TYPE[slot];
  const current = plan.days[dayIdx][slot];
  const inWeek = new Set(plan.days.map((d) => d[slot]));
  const curRecipe = RECIPE_MAP[current];
  const otherSlot = slot === "l" ? "d" : slot === "d" ? "l" : null;
  const sameDayOther = otherSlot ? RECIPE_MAP[plan.days[dayIdx][otherSlot]] : undefined;
  let pool = RECIPES.filter((r) => r.type === type && r.id !== current && !inWeek.has(r.id));
  if (pool.length === 0) pool = RECIPES.filter((r) => r.type === type && r.id !== current);
  const better = pool.filter((r) => !sameDayOther || groupOf(r) !== groupOf(sameDayOther));
  const finalPool = better.length ? better : pool;
  void curRecipe;
  const next = finalPool[Math.floor(Math.random() * finalPool.length)];
  const days = plan.days.map((d, i) => (i === dayIdx ? { ...d, [slot]: next.id } : d));
  return { ...plan, days };
}

export function dayOfWeekLabel(i: number): string {
  return ["월", "화", "수", "목", "금", "토", "일"][i];
}

export function daySodium(d: PlanDay): number {
  return SLOT_KEYS.reduce((sum, k) => sum + (RECIPE_MAP[d[k]]?.sodium ?? 0), 0);
}

/* ---------------- 장보기 목록 ---------------- */
export interface ShopItem {
  key: string; // 이름|단위
  name: string;
  unit: string;
  amount: number;
  cat: Cat;
  uses: string[]; // 사용되는 레시피 이름
}

export function shoppingList(plan: Plan): ShopItem[] {
  const map = new Map<string, ShopItem>();
  for (const day of plan.days) {
    for (const k of SLOT_KEYS) {
      const r = RECIPE_MAP[day[k]];
      if (!r) continue;
      for (const ing of r.ingredients) {
        const key = `${ing.name}|${ing.unit}`;
        const cur = map.get(key);
        if (cur) {
          cur.amount += ing.amount;
          if (!cur.uses.includes(r.name)) cur.uses.push(r.name);
        } else {
          map.set(key, { key, name: ing.name, unit: ing.unit, amount: ing.amount, cat: ing.cat, uses: [r.name] });
        }
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat) || a.name.localeCompare(b.name, "ko")
  );
}

export function fmtAmount(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
}

export function weekRange(ws: string): string {
  const end = addDays(ws, 6);
  const f = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
  return `${f(ws)} ~ ${f(end)}`;
}

export { weekStart };


/* ---------------- 먹은 끼니 기록 (checks 테이블 재사용) ---------------- */
export const eatKey = (date: string, slot: SlotKey) => `eat:${date}:${slot}`;

export interface DayIntake {
  date: string;
  planned: number; // 계획된 끼니 수 (빼기한 끼니 제외)
  eaten: number; // 먹었다고 체크한 끼니 수
  sodium: number; // 먹은 끼니의 나트륨 합계(추정, mg)
  complete: boolean; // 계획된 끼니를 모두 체크
}

/** from~to(포함) 사이 날짜별 식사 기록. 계획이 없는 날은 건너뜀 */
export function intakeByDay(plans: Plan[], checks: Check[], from: string, to: string): DayIntake[] {
  const out: DayIntake[] = [];
  const done = new Set(checks.filter((c) => c.checked && c.key.startsWith("eat:")).map((c) => `${c.weekStart}|${c.key}`));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const ws = weekStart(d);
    const plan = plans.find((p) => p.weekStart === ws);
    if (!plan) continue;
    const idx = Math.round((Date.parse(d) - Date.parse(ws)) / 86400000);
    const day = plan.days[idx];
    if (!day) continue;
    let planned = 0;
    let eaten = 0;
    let sodium = 0;
    for (const k of SLOT_KEYS) {
      const r = RECIPE_MAP[day[k]];
      if (!r) continue;
      planned++;
      if (done.has(`${ws}|${eatKey(d, k)}`)) {
        eaten++;
        sodium += r.sodium;
      }
    }
    out.push({ date: d, planned, eaten, sodium, complete: planned >= 2 && eaten === planned });
  }
  return out;
}
