import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { Reading, Weight } from "./bp";

export type Role = "edit" | "view";
export type NewReading = Omit<Reading, "id">;
export type NewWeight = Omit<Weight, "id">;

interface Backend {
  mode: "local" | "cloud";
  role: Role;
  readings: Reading[];
  weights: Weight[];
  save: (r: NewReading) => Promise<void>;
  remove: (id: string) => Promise<void>;
  saveWeight: (w: NewWeight) => Promise<void>;
  removeWeight: (id: string) => Promise<void>;
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

/* ---------------- 로컬 모드 (서버 없이 이 기기에만 저장) ---------------- */
const LS_KEY = "bp.readings.v1";

function loadLocal(): Reading[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as Reading[];
  } catch {
    return [];
  }
}

const LS_W_KEY = "bp.weights.v1";

function loadLocalWeights(): Weight[] {
  try {
    return JSON.parse(localStorage.getItem(LS_W_KEY) ?? "[]") as Weight[];
  } catch {
    return [];
  }
}

export function LocalBackend({ children }: { children: ReactNode }) {
  const [readings, setReadings] = useState<Reading[]>(loadLocal);
  const [weights, setWeights] = useState<Weight[]>(loadLocalWeights);
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(readings));
  }, [readings]);
  useEffect(() => {
    localStorage.setItem(LS_W_KEY, JSON.stringify(weights));
  }, [weights]);

  const value = useMemo<Backend>(
    () => ({
      mode: "local",
      role: "edit",
      readings,
      weights,
      saveWeight: async (w) => {
        setWeights((prev) => {
          const rest = prev.filter((x) => x.date !== w.date);
          return [...rest, clean({ ...w, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })];
        });
      },
      removeWeight: async (id) => setWeights((prev) => prev.filter((x) => x.id !== id)),
      save: async (r) => {
        setReadings((prev) => {
          const rest = prev.filter((x) => !(x.date === r.date && x.slot === r.slot));
          return [...rest, clean({ ...r, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })];
        });
      },
      remove: async (id) => setReadings((prev) => prev.filter((x) => x.id !== id)),
    }),
    [readings, weights]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------- 클라우드 모드 (Convex, 두 폰 동기화) ---------------- */
const listRef = makeFunctionReference<"query", { code: string }, { role: Role; readings: Reading[]; weights: Weight[] } | null>(
  "readings:list"
);
const saveRef = makeFunctionReference<"mutation", { code: string } & NewReading, null>("readings:save");
const removeRef = makeFunctionReference<"mutation", { code: string; id: string }, null>("readings:remove");
const saveWeightRef = makeFunctionReference<"mutation", { code: string } & NewWeight, null>("readings:saveWeight");
const removeWeightRef = makeFunctionReference<"mutation", { code: string; id: string }, null>("readings:removeWeight");

const CODE_KEY = "bp.code";

export function CloudBackend({ children }: { children: ReactNode }) {
  const [code, setCode] = useState(() => localStorage.getItem(CODE_KEY) ?? "");
  const data = useQuery(listRef, code ? { code } : "skip");
  const saveM = useMutation(saveRef);
  const removeM = useMutation(removeRef);
  const saveWM = useMutation(saveWeightRef);
  const removeWM = useMutation(removeWeightRef);

  const logout = useCallback(() => {
    localStorage.removeItem(CODE_KEY);
    setCode("");
  }, []);

  const value = useMemo<Backend | null>(() => {
    if (!data) return null;
    return {
      mode: "cloud",
      role: data.role,
      readings: data.readings,
      weights: data.weights ?? [],
      saveWeight: async (w) => {
        await saveWM(clean({ code, ...w }));
      },
      removeWeight: async (id) => {
        await removeWM({ code, id });
      },
      save: async (r) => {
        await saveM(clean({ code, ...r }));
      },
      remove: async (id) => {
        await removeM({ code, id });
      },
      logout,
    };
  }, [data, code, saveM, removeM, saveWM, removeWM, logout]);

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
