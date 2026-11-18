import { useState } from "react";
import { useBackend } from "./backend";
import { addDays, todayStr, weekStart } from "./bp";
import { Seg } from "./ui";
import { RECIPE_MAP } from "./recipes";
import {
  SLOT_KEYS,
  SLOT_NAME,
  SODIUM_TARGET,
  dayOfWeekLabel,
  daySodium,
  eatKey,
  generatePlan,
  swapSlot,
  weekRange,
  type Plan,
  type SlotKey,
} from "./meals";
import { usePlan } from "./usePlan";

export default function MealsTab() {
  const { role, savePlan, checks, setCheck } = useBackend();
  const today = todayStr();
  const thisWs = weekStart(today);
  const [which, setWhich] = useState<0 | 1>(0);
  const ws = which === 0 ? thisWs : addDays(thisWs, 7);
  const { plan, prev } = usePlan(ws);
  const canEdit = !!role;
  const todayIdx = ws === thisWs ? Math.round((Date.parse(today) - Date.parse(thisWs)) / 86400000) : -1;

  async function update(p: Plan) {
    await savePlan(p);
  }

  return (
    <>
      <div className="week-head">
        <Seg
          value={which}
          onChange={setWhich}
          options={[
            { value: 0, label: "이번 주" },
            { value: 1, label: "다음 주" },
          ]}
        />
        <span className="muted">{weekRange(ws)}</span>
      </div>

      {plan.days.map((day, i) => (
        <DayCard
          key={i}
          idx={i}
          date={addDays(ws, i)}
          day={day}
          isToday={i === todayIdx}
          canEdit={canEdit}
          eaten={(slot) => checks.some((c) => c.weekStart === ws && c.key === eatKey(addDays(ws, i), slot) && c.checked)}
          onEat={(slot, on) => void setCheck(ws, eatKey(addDays(ws, i), slot), on)}
          past={addDays(ws, i) <= today}
          onSwap={(slot) => update(swapSlot(plan, i, slot))}
          onSkip={(slot) => update({ ...plan, days: plan.days.map((d, k) => (k === i ? { ...d, [slot]: "skip" } : d)) })}
          onRestore={(slot) => update(swapSlot({ ...plan, days: plan.days.map((d, k) => (k === i ? { ...d, [slot]: "x" } : d)) }, i, slot))}
        />
      ))}

      {canEdit && (
        <button
          className="btn wide"
          onClick={() => {
            if (confirm("이 주 식단을 처음부터 새로 짤까요? 바꿔 둔 끼니도 모두 바뀌어요.")) {
              void update(generatePlan(ws, plan.variant + 1, prev));
            }
          }}
        >
          이 주 식단 새로 뽑기
        </button>
      )}
      <p className="hint">
        나트륨은 저염으로 조리했을 때의 추정치예요(실제와 다를 수 있어요). 하루 목표 {SODIUM_TARGET.toLocaleString()}mg(소금 약 5g) 기준이고,
        국물은 남기고 간은 약하게 하세요. 먹은 끼니에 체크하면 실제로 먹은 나트륨(추정)이 합산돼요. 식단은 매주 새로 짜이고, 지난주와 겹치지 않게 구성돼요.
      </p>
    </>
  );
}

function DayCard({
  idx,
  date,
  day,
  isToday,
  canEdit,
  eaten,
  onEat,
  past,
  onSwap,
  onSkip,
  onRestore,
}: {
  idx: number;
  date: string;
  day: Plan["days"][number];
  isToday: boolean;
  canEdit: boolean;
  eaten: (s: SlotKey) => boolean;
  onEat: (s: SlotKey, on: boolean) => void;
  past: boolean; // 오늘 이전(포함) 날짜만 먹은 것 체크
  onSwap: (s: SlotKey) => void;
  onSkip: (s: SlotKey) => void;
  onRestore: (s: SlotKey) => void;
}) {
  const [open, setOpen] = useState<SlotKey | null>(null);
  const sodium = daySodium(day);
  const pct = Math.min(100, Math.round((sodium / SODIUM_TARGET) * 100));
  const eatenSodium = SLOT_KEYS.reduce((n, k) => n + (eaten(k) ? RECIPE_MAP[day[k]]?.sodium ?? 0 : 0), 0);
  const eatenCount = SLOT_KEYS.filter((k) => eaten(k) && RECIPE_MAP[day[k]]).length;
  return (
    <section className={`card day ${isToday ? "today" : ""}`}>
      <div className="row between">
        <h2>
          {dayOfWeekLabel(idx)} {Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}
          {isToday && <span className="badge edit">오늘</span>}
        </h2>
        <span className="muted">
          {eatenCount > 0 ? `먹은 것 약 ${eatenSodium.toLocaleString()}mg / 계획 ${sodium.toLocaleString()}mg` : `나트륨 약 ${sodium.toLocaleString()}mg`}
        </span>
      </div>
      <div className="bar" aria-label={`나트륨 ${pct}%`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {SLOT_KEYS.map((k) => {
        const id = day[k];
        const r = RECIPE_MAP[id];
        const skipped = !r;
        return (
          <div key={k} className="meal">
            <div className="meal-row">
              <span className="avg-label">{SLOT_NAME[k]}</span>
              {!skipped && past && (
                <input
                  type="checkbox"
                  className="eat"
                  aria-label={`${SLOT_NAME[k]} 먹음`}
                  checked={eaten(k)}
                  disabled={!canEdit}
                  onChange={(e) => onEat(k, e.target.checked)}
                />
              )}
              <button className="meal-name" onClick={() => !skipped && setOpen(open === k ? null : k)} disabled={skipped}>
                {skipped ? <span className="muted">먹지 않음 / 외식</span> : r.name}
              </button>
              {canEdit && (
                <span className="meal-actions">
                  {skipped ? (
                    <button className="link" onClick={() => onRestore(k)}>
                      식단 넣기
                    </button>
                  ) : (
                    <>
                      <button className="link" onClick={() => onSwap(k)} aria-label={`${SLOT_NAME[k]} 바꾸기`}>
                        바꾸기
                      </button>
                      <button className="link muted-link" onClick={() => onSkip(k)}>
                        빼기
                      </button>
                    </>
                  )}
                </span>
              )}
            </div>
            {open === k && r && (
              <div className="recipe">
                <p className="muted">
                  약 {r.mins}분 · 1인분 나트륨 약 {r.sodium}mg (추정)
                </p>
                <p className="r-title">재료 (2인분)</p>
                <p className="r-text">{r.ingredients.map((g) => `${g.name} ${g.amount}${g.unit}`).join(", ")}</p>
                <p className="r-title">만드는 법</p>
                <ol>
                  {r.steps.map((s, n) => (
                    <li key={n}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
