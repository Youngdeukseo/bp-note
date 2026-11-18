import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { addDays, todayStr, weekStart, type Check, type Med, type MedLog, type Reading, type Slot, type Weight } from "./bp";
import type { Plan, PlanDay } from "./meals";

export type Role = "edit" | "view";
export type NewReading = Omit<Reading, "id">;
export type NewWeight = Omit<Weight, "id">;
export type NewMed = Omit<Med, "id"> & { id?: string };

interface Backend {
  mode: "local" | "cloud";
  role: Role;
  ready: boolean; // 식단·약 데이터까지 불러온 뒤 true
  readings: Reading[];
  weights: Weight[];
  plans: Plan[];
  checks: Check[];
  meds: Med[];
  medLogs: MedLog[];
  save: (r: NewReading) => Promise<void>;
  remove: (id: string) => Promise<void>;
  saveWeight: (w: NewWeight) => Promise<void>;
  removeWeight: (id: string) => Promise<void>;
  savePlan: (p: Plan) => Promise<void>;
  setCheck: (weekStart: string, key: string, checked: boolean) => Promise<void>;
  saveMed: (m: NewMed) => Promise<void>;
  removeMed: (id: string) => Promise<void>;
  setMedLog: (date: string, medId: string, slot: Slot, taken: boolean) => Promise<void>;
  logout?: () => void;
}

const Ctx = createContext<Backend | null>(null);

export function useBackend(): Backend {
  const v = useContext(Ctx);
  if (!v) throw new Error("Backend 없음");
  return v;
}

// undefined 값은 제거 (Convex 인자 규칙)
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 식단/복용 기록을 읽어올 기간 (Convex 쿼리 인자 — 마운트 시 한 번만 계산)
function ranges() {
  const t = todayStr();
  return { planFrom: addDays(weekStart(t), -14), logFrom: addDays(t, -60) };
}

/* ---------------- 로컬 모드 (서버 없이 이 기기에만 저장) ---------------- */
function useLocal<T>(key: string, init: T): [T, (f: (p: T) => T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch {
      return init;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(v));
  }, [key, v]);
  return [v, (f) => setV(f)];
}

export function LocalBackend({ children }: { children: ReactNode }) {
  const [readings, setReadings] = useLocal<Reading[]>("bp.readings.v1", []);
  const [weights, setWeights] = useLocal<Weight[]>("bp.weights.v1", []);
  const [plans, setPlans] = useLocal<Plan[]>("bp.plans.v1", []);
  const [checks, setChecks] = useLocal<Check[]>("bp.checks.v1", []);
  const [meds, setMeds] = useLocal<Med[]>("bp.meds.v1", []);
  const [medLogs, setMedLogs] = useLocal<MedLog[]>("bp.medlogs.v1", []);

  const value = useMemo<Backend>(
    () => ({
      mode: "local",
      role: "edit",
      ready: true,
      readings,
      weights,
      plans,
      checks,
      meds,
      medLogs,
      save: async (r) =>
        setReadings((prev) => [...prev.filter((x) => !(x.date === r.date && x.slot === r.slot)), clean({ ...r, id: uid() })]),
      remove: async (id) => setReadings((prev) => prev.filter((x) => x.id !== id)),
      saveWeight: async (w) => setWeights((prev) => [...prev.filter((x) => x.date !== w.date), clean({ ...w, id: uid() })]),
      removeWeight: async (id) => setWeights((prev) => prev.filter((x) => x.id !== id)),
      savePlan: async (p) => setPlans((prev) => [...prev.filter((x) => x.weekStart !== p.weekStart), p]),
      setCheck: async (ws, key, checked) =>
        setChecks((prev) => [...prev.filter((x) => !(x.weekStart === ws && x.key === key)), { weekStart: ws, key, checked }]),
      saveMed: async (m) =>
        setMeds((prev) => {
          const id = m.id ?? uid();
          return [...prev.filter((x) => x.id !== id), clean({ ...m, id })];
        }),
      removeMed: async (id) => setMeds((prev) => prev.filter((x) => x.id !== id)),
      setMedLog: async (date, medId, slot, taken) =>
        setMedLogs((prev) => [
          ...prev.filter((x) => !(x.date === date && x.medId === medId && x.slot === slot)),
          { date, medId, slot, taken },
        ]),
    }),
    [readings, weights, plans, checks, meds, medLogs, setReadings, setWeights, setPlans, setChecks, setMeds, setMedLogs]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------- 클라우드 모드 (Convex, 두 폰 동기화) ---------------- */
const listRef = makeFunctionReference<
  "query",
  { code: string },
  { role: Role; readings: Reading[]; weights: Weight[] } | null
>("readings:list");
const saveRef = makeFunctionReference<"mutation", { code: string } & NewReading, null>("readings:save");
const removeRef = makeFunctionReference<"mutation", { code: string; id: string }, null>("readings:remove");
const saveWeightRef = makeFunctionReference<"mutation", { code: string } & NewWeight, null>("readings:saveWeight");
const removeWeightRef = makeFunctionReference<"mutation", { code: string; id: string }, null>("readings:removeWeight");

const overviewRef = makeFunctionReference<
  "query",
  { code: string; planFrom: string; logFrom: string },
  { plans: Plan[]; checks: Check[]; meds: Med[]; medLogs: MedLog[] } | null
>("extra:overview");
const savePlanRef = makeFunctionReference<
  "mutation",
  { code: string; weekStart: string; variant: number; days: PlanDay[] },
  null
>("extra:savePlan");
const setCheckRef = makeFunctionReference<
  "mutation",
  { code: string; weekStart: string; key: string; checked: boolean },
  null
>("extra:setCheck");
const saveMedRef = makeFunctionReference<"mutation", { code: string } & NewMed, null>("extra:saveMed");
const removeMedRef = makeFunctionReference<"mutation", { code: string; id: string }, null>("extra:removeMed");
const setMedLogRef = makeFunctionReference<
  "mutation",
  { code: string; date: string; medId: string; slot: Slot; taken: boolean },
  null
>("extra:setMedLog");

const CODE_KEY = "bp.code";

export function CloudBackend({ children }: { children: ReactNode }) {
  const [code, setCode] = useState(() => localStorage.getItem(CODE_KEY) ?? "");
  const range = useMemo(ranges, []);
  const data = useQuery(listRef, code ? { code } : "skip");
  const extra = useQuery(overviewRef, code ? { code, ...range } : "skip");
  const saveM = useMutation(saveRef);
  const removeM = useMutation(removeRef);
  const saveWM = useMutation(saveWeightRef);
  const removeWM = useMutation(removeWeightRef);
  const savePlanM = useMutation(savePlanRef);
  const setCheckM = useMutation(setCheckRef);
  const saveMedM = useMutation(saveMedRef);
  const removeMedM = useMutation(removeMedRef);
  const setMedLogM = useMutation(setMedLogRef);

  const logout = useCallback(() => {
    localStorage.removeItem(CODE_KEY);
    setCode("");
  }, []);

  const value = useMemo<Backend | null>(() => {
    if (!data) return null;
    return {
      mode: "cloud",
      role: data.role,
      ready: extra !== undefined && extra !== null,
      readings: data.readings,
      weights: data.weights ?? [],
      plans: extra?.plans ?? [],
      checks: extra?.checks ?? [],
      meds: extra?.meds ?? [],
      medLogs: extra?.medLogs ?? [],
      save: async (r) => void (await saveM(clean({ code, ...r }))),
      remove: async (id) => void (await removeM({ code, id })),
      saveWeight: async (w) => void (await saveWM(clean({ code, ...w }))),
      removeWeight: async (id) => void (await removeWM({ code, id })),
      savePlan: async (p) => void (await savePlanM({ code, ...p })),
      setCheck: async (weekStart, key, checked) => void (await setCheckM({ code, weekStart, key, checked })),
      saveMed: async (m) => void (await saveMedM(clean({ code, ...m }))),
      removeMed: async (id) => void (await removeMedM({ code, id })),
      setMedLog: async (date, medId, slot, taken) => void (await setMedLogM({ code, date, medId, slot, taken })),
      logout,
    };
  }, [data, extra, code, saveM, removeM, saveWM, removeWM, savePlanM, setCheckM, saveMedM, removeMedM, setMedLogM, logout]);

  if (!code || data === null) {
    return (
      <CodeEntry
        error={code && data === null ? "코드가 맞지 않아요. 다시 확인해 주세요." : undefined}
        onSubmit={(c) => {
          localStorage.setItem(CODE_KEY, c);
          setCode(c);
        }}
      />
    );
  }
  if (!value) return <div className="center muted">불러오는 중…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function CodeEntry({ onSubmit, error }: { onSubmit: (c: string) => void; error?: string }) {
  const [v, setV] = useState("");
  return (
    <form
      className="center code-entry"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSubmit(v.trim());
      }}
    >
      <h1>혈압 노트</h1>
      <p className="muted">전달받은 접속 코드를 입력해 주세요.</p>
      <input
        type="password"
        autoComplete="off"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="접속 코드"
        aria-label="접속 코드"
      />
      {error && <p className="error">{error}</p>}
      <button className="btn primary" type="submit">
        들어가기
      </button>
    </form>
  );
}
