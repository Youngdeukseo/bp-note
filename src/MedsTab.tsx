import { useState } from "react";
import { useBackend } from "./backend";
import { SLOT_LABEL, addDays, todayStr, type Med, type MedLog, type Slot } from "./bp";
import { COMMON_POINTS, MED_CLASSES, NEDRUG_URL, classesOf, detectClasses } from "./medinfo";

/* ---------------- 복용률 계산 ---------------- */
// 첫 복용 기록 날짜부터 계산(앱을 막 쓰기 시작한 때 복용률이 부당하게 낮아지지 않도록)
export function adherence(meds: Med[], logs: MedLog[], days: number, today = todayStr()) {
  const active = meds.filter((m) => m.active);
  if (active.length === 0) return null;
  const from = addDays(today, -(days - 1));
  const mine = logs.filter((l) => l.date >= from && l.date <= today);
  if (mine.length === 0) return null;
  const first = mine.reduce((a, l) => (l.date < a ? l.date : a), today);
  const span = Math.round((Date.parse(today) - Date.parse(first)) / 86400000) + 1;
  const scheduled = active.reduce((n, m) => n + m.times.length, 0) * span;
  const ids = new Set(active.map((m) => m.id));
  const taken = mine.filter((l) => l.taken && ids.has(l.medId) && active.find((m) => m.id === l.medId)?.times.includes(l.slot)).length;
  if (scheduled === 0) return null;
  return { taken: Math.min(taken, scheduled), scheduled, pct: Math.round((Math.min(taken, scheduled) / scheduled) * 100) };
}

/* ---------------- 오늘 복용 체크 (오늘 탭) ---------------- */
export function MedCheckCard() {
  const { meds, medLogs, setMedLog, role, ready } = useBackend();
  const today = todayStr();
  const active = meds.filter((m) => m.active);
  const canEdit = role === "edit";
  if (!ready || active.length === 0) return null;
  const isTaken = (id: string, slot: Slot) => medLogs.some((l) => l.date === today && l.medId === id && l.slot === slot && l.taken);
  const a7 = adherence(meds, medLogs, 7);

  return (
    <section className="card">
      <div className="row between">
        <h2>오늘 약</h2>
        {a7 && <span className="muted">최근 7일 복용률 {a7.pct}%</span>}
      </div>
      {(["morning", "evening"] as Slot[]).map((slot) => {
        const list = active.filter((m) => m.times.includes(slot));
        if (list.length === 0) return null;
        const allDone = list.every((m) => isTaken(m.id, slot));
        return (
          <div className="med-slot" key={slot}>
            <div className="row between">
              <b>{SLOT_LABEL[slot]}</b>
              {canEdit && !allDone && (
                <button className="link" onClick={() => list.forEach((m) => void setMedLog(today, m.id, slot, true))}>
                  모두 먹었어요
                </button>
              )}
              {allDone && <span className="meds on">완료</span>}
            </div>
            {list.map((m) => {
              const on = isTaken(m.id, slot);
              return (
                <label key={m.id} className={`shop ${on ? "done" : ""}`}>
                  <input type="checkbox" checked={on} disabled={!canEdit} onChange={(e) => void setMedLog(today, m.id, slot, e.target.checked)} />
                  <span className="shop-name">{m.name}</span>
                  <span className="shop-amt">{m.dose ?? ""}</span>
                </label>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

/* ---------------- 내 약 관리 (더보기 탭) ---------------- */
export default function MedsTab() {
  const { meds, medLogs, saveMed, removeMed, role } = useBackend();
  const canEdit = role === "edit";
  const [editing, setEditing] = useState<Med | "new" | null>(null);
  const a7 = adherence(meds, medLogs, 7);
  const a30 = adherence(meds, medLogs, 30);

  return (
    <>
      <section className="card">
        <h2>복용률</h2>
        <div className="avg">
          <span className="avg-label">7일</span>
          <b>{a7 ? `${a7.pct}%` : "-"}</b>
          {a7 && <span className="muted">{a7.taken}/{a7.scheduled}회</span>}
        </div>
        <div className="avg">
          <span className="avg-label">30일</span>
          <b>{a30 ? `${a30.pct}%` : "-"}</b>
          {a30 && <span className="muted">{a30.taken}/{a30.scheduled}회</span>}
        </div>
        <p className="hint">첫 복용 체크를 한 날부터 계산해요. 오늘 탭에서 먹은 약을 체크하세요.</p>
      </section>

      {meds.length === 0 && <p className="muted center-text">등록된 약이 없어요</p>}
      {meds.map((m) => (
        <MedCard key={m.id} med={m} canEdit={canEdit} onEdit={() => setEditing(m)} onToggle={() => void saveMed({ ...m, active: !m.active })} onRemove={() => {
          if (confirm(`${m.name}을(를) 목록에서 삭제할까요? 복용 중지만 하려면 "복용 중지"를 누르세요.`)) void removeMed(m.id);
        }} />
      ))}

      {canEdit && editing === null && (
        <button className="btn primary wide" onClick={() => setEditing("new")}>
          약 추가
        </button>
      )}
      {editing !== null && (
        <MedForm
          initial={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSave={async (m) => {
            await saveMed(m);
            setEditing(null);
          }}
        />
      )}

      <section className="card">
        <h2>혈압약 복용 시 공통 안내</h2>
        <ul className="plain">
          {COMMON_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="hint">
          일반적인 안내이며 처방과 다를 수 있어요. 약의 정확한 정보는{" "}
          <a href={NEDRUG_URL} target="_blank" rel="noreferrer">
            의약품안전나라(식약처)
          </a>
          나 처방한 의사·약사에게 확인하세요.
        </p>
      </section>
    </>
  );
}

function MedCard({ med, canEdit, onEdit, onToggle, onRemove }: { med: Med; canEdit: boolean; onEdit: () => void; onToggle: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const classes = classesOf(med.name, med.cls);
  return (
    <section className={`card ${med.active ? "" : "inactive"}`}>
      <div className="row between">
        <h2>
          {med.name}
          {!med.active && <span className="badge local">복용 중지</span>}
        </h2>
        {canEdit && (
          <button className="link" onClick={onEdit}>
            수정
          </button>
        )}
      </div>
      <p className="muted">
        {med.dose ? `${med.dose} · ` : ""}
        {med.times.map((t) => SLOT_LABEL[t]).join(", ") || "복용 시간 미지정"}
      </p>
      {med.note && <p className="note">{med.note}</p>}
      {classes.length > 0 ? (
        <>
          <p className="muted">{classes.map((c) => `${c.label} — ${c.desc}`).join(" / ")}</p>
          <button className="link" onClick={() => setOpen(!open)}>
            {open ? "안내 접기" : "주의할 점 보기"}
          </button>
          {open && (
            <div className="recipe">
              {classes.map((c) => (
                <div key={c.key}>
                  <p className="r-title">{c.label}</p>
                  <ul className="plain">
                    {c.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="hint">일반적인 안내예요. 내 상황에 맞는 건 의사·약사에게 확인하세요.</p>
            </div>
          )}
        </>
      ) : (
        <p className="hint">이 약의 계열을 자동으로 찾지 못했어요. 수정에서 계열을 직접 고르면 일반 안내가 나와요.</p>
      )}
      {canEdit && (
        <div className="row gap">
          <button className="link" onClick={onToggle}>
            {med.active ? "복용 중지" : "다시 복용"}
          </button>
          <button className="link danger" onClick={onRemove}>
            삭제
          </button>
        </div>
      )}
    </section>
  );
}

function MedForm({ initial, onSave, onCancel }: { initial?: Med; onSave: (m: Omit<Med, "id"> & { id?: string }) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [dose, setDose] = useState(initial?.dose ?? "");
  const [times, setTimes] = useState<Slot[]>(initial?.times ?? ["morning"]);
  const [cls, setCls] = useState(initial?.cls ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [err, setErr] = useState("");
  const auto = detectClasses(name);

  const toggle = (t: Slot) => setTimes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setErr("약 이름을 입력해 주세요");
        if (times.length === 0) return setErr("복용 시간을 하나 이상 골라 주세요");
        setErr("");
        try {
          await onSave({
            id: initial?.id,
            name: name.trim(),
            dose: dose.trim() || undefined,
            cls: cls || undefined,
            times,
            active: initial?.active ?? true,
            note: note.trim() || undefined,
          });
        } catch {
          setErr("저장에 실패했어요. 다시 시도해 주세요.");
        }
      }}
    >
      <h2>{initial ? "약 수정" : "약 추가"}</h2>
      <label className="field">
        <span>약 이름 (처방전·약봉투에 적힌 이름)</span>
        <input className="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 암로디핀, 노바스크" />
      </label>
      {name && (
        <p className="hint">{auto.length ? `자동 인식: ${auto.map((c) => c.label).join(", ")}` : "자동 인식되지 않았어요. 아래에서 계열을 직접 고를 수 있어요."}</p>
      )}
      <label className="field">
        <span>용량·복용량 (선택)</span>
        <input className="text" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="예: 5mg 1정" />
      </label>
      <div className="field">
        <span>복용 시간</span>
        <div className="row gap">
          {(["morning", "evening"] as Slot[]).map((t) => (
            <label key={t} className="check inline">
              <input type="checkbox" checked={times.includes(t)} onChange={() => toggle(t)} />
              {SLOT_LABEL[t]}
            </label>
          ))}
        </div>
      </div>
      {auto.length === 0 && (
        <label className="field">
          <span>계열 (모르면 비워 두세요)</span>
          <select className="text" value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">모름 / 기타</option>
            {MED_CLASSES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>메모 (선택)</span>
        <input className="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 식후 30분" />
      </label>
      {err && <p className="error">{err}</p>}
      <div className="row gap">
        <button className="btn primary" type="submit">
          저장
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  );
}
