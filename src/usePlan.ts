import { useEffect, useMemo, useRef } from "react";
import { useBackend } from "./backend";
import { addDays } from "./bp";
import { generatePlan, type Plan } from "./meals";

/** 해당 주(월요일 ws)의 식단. 저장된 게 없으면 같은 규칙으로 생성(두 폰이 같은 결과)하고, 불러오기가 끝난 뒤 저장한다. */
export function usePlan(ws: string): { plan: Plan; prev?: Plan } {
  const { plans, ready, role, savePlan } = useBackend();
  const stored = plans.find((p) => p.weekStart === ws);
  const prev = plans.find((p) => p.weekStart === addDays(ws, -7));
  const generated = useMemo(() => generatePlan(ws, 0, prev), [ws, prev]);
  const plan = stored ?? generated;
  const saved = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!ready || !role || stored || saved.current.has(ws)) return;
    saved.current.add(ws);
    void savePlan(generated);
  }, [ready, role, stored, ws, generated, savePlan]);

  return { plan, prev };
}
