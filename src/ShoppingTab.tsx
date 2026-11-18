import { useState } from "react";
import { useBackend } from "./backend";
import { addDays, todayStr, weekStart } from "./bp";
import { Seg } from "./ui";
import { CAT_LABEL, CAT_ORDER, type Cat } from "./recipes";
import { fmtAmount, shoppingList, weekRange } from "./meals";
import { usePlan } from "./usePlan";

export default function ShoppingTab() {
  const { checks, setCheck, role } = useBackend();
  const today = todayStr();
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 월=0 … 일=6
  const weekend = dow >= 4; // 금~일은 다음 주 장보기가 기본
  const thisWs = weekStart(today);
  const [which, setWhich] = useState<0 | 1>(weekend ? 1 : 0);
  const ws = which === 0 ? thisWs : addDays(thisWs, 7);
  const { plan } = usePlan(ws);
  const items = shoppingList(plan);
  const canEdit = role === "edit";
  const [showPantry, setShowPantry] = useState(false);

  const isChecked = (key: string) => checks.some((c) => c.weekStart === ws && c.key === key && c.checked);
  const main = items.filter((i) => i.cat !== "pantry");
  const pantry = items.filter((i) => i.cat === "pantry");
  const done = main.filter((i) => isChecked(i.key)).length;

  const renderGroup = (cat: Cat, list: typeof items) => {
    const rows = list.filter((i) => i.cat === cat);
    if (rows.length === 0) return null;
    return (
      <section className="card" key={cat}>
        <h2>{CAT_LABEL[cat]}</h2>
        {rows.map((i) => {
          const on = isChecked(i.key);
          return (
            <label key={i.key} className={`shop ${on ? "done" : ""}`}>
              <input type="checkbox" checked={on} disabled={!canEdit} onChange={(e) => void setCheck(ws, i.key, e.target.checked)} />
              <span className="shop-name">{i.name}</span>
              <span className="shop-amt">
                {fmtAmount(i.amount)}
                {i.unit}
              </span>
            </label>
          );
        })}
      </section>
    );
  };

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
      {weekend && which === 1 && <div className="tip">주말 장보기예요. 다음 주 식단에 필요한 재료를 모았어요.</div>}
      <p className="muted progress">
        장본 것 {done} / {main.length}
      </p>
      {CAT_ORDER.filter((c) => c !== "pantry").map((c) => renderGroup(c, main))}
      {pantry.length > 0 && (
        <section className="card">
          <div className="row between">
            <h2>양념·기본 재료</h2>
            <button className="link" onClick={() => setShowPantry(!showPantry)}>
              {showPantry ? "접기" : "집에 있는지 확인"}
            </button>
          </div>
          {showPantry && renderGroup("pantry", pantry)}
          {!showPantry && <p className="muted">{pantry.map((p) => p.name).join(", ")}</p>}
        </section>
      )}
      <p className="hint">식단에서 &quot;빼기&quot;를 한 끼니의 재료는 목록에서 빠져요. 체크 상태는 두 폰에 같이 보여요.</p>
    </>
  );
}
