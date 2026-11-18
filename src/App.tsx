import { useMemo, useState } from "react";
import { useBackend } from "./backend";
import {
  SLOT_LABEL,
  addDays,
  average,
  classify,
  fmtDate,
  sortDesc,
  todayStr,
  validate,
  type Reading,
  type Slot,
} from "./bp";

type Tab = "today" | "history";

export default function App() {
  const { role, mode, logout } = useBackend();
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>혈압 노트</h1>
          <span className={`badge ${role}`}>{role === "edit" ? "기록 모드" : "보기 모드"}</span>
          {mode === "local" && <span className="badge local">이 기기에만 저장</span>}
        </div>
        {logout && (
          <button className="link" onClick={logout}>
            코드 변경
          </button>
        )}
      </header>

      <main>{tab === "today" ? <TodayTab /> : <HistoryTab />}</main>

      <nav className="tabs">
        <button className={tab === "today" ? "on" : ""} onClick={() => setTab("today")}>
          오늘
        </button>
        <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>
          기록
        </button>
      </nav>

      <PrintReport />
    </div>
  );
}

/* ---------------- 오늘 ---------------- */
function TodayTab() {
  const { readings } = useBackend();
  const today = todayStr();
  const latest = useMemo(() => sortDesc(readings)[0], [readings]);
  const crisis = latest && classify(latest.sys, latest.dia).key === "crisis";

  return (
    <>
      {crisis && (
        <div className="alert">
          <b>
            최근 기록 {latest.sys}/{latest.dia} — 180/120 이상입니다.
          </b>
          <br />
          흉통, 호흡곤란, 심한 두통, 시야 이상, 마비 증상이 있으면 바로 119 또는 응급실로 가세요. 증상이 없어도 5분
          쉰 뒤 다시 재고, 계속 높으면 병원에 연락하세요.
        </div>
      )}
      <div className="date-title">{fmtDate(today)}</div>
      <SlotCard slot="morning" date={today} />
      <SlotCard slot="evening" date={today} />
      <Summary />
      <Chart />
    </>
  );
}

function StageChip({ sys, dia }: { sys: number; dia: number }) {
  const s = classify(sys, dia);
  return (
    <span className="chip" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function SlotCard({ slot, date }: { slot: Slot; date: string }) {
  const { readings, role, save } = useBackend();
  const existing = readings.find((r) => r.date === date && r.slot === slot);
  const [editing, setEditing] = useState(false);
  const canEdit = role === "edit";

  if (canEdit && (!existing || editing)) {
    return (
      <ReadingForm
        slot={slot}
        date={date}
        initial={existing}
        onDone={() => setEditing(false)}
        onCancel={existing ? () => setEditing(false) : undefined}
        save={save}
      />
    );
  }

  return (
    <section className="card">
      <div className="row between">
        <h2>{SLOT_LABEL[slot]}</h2>
        {canEdit && existing && (
          <button className="link" onClick={() => setEditing(true)}>
            수정
          </button>
        )}
      </div>
      {existing ? (
        <>
          <div className="big">
            {existing.sys}
            <span>/</span>
            {existing.dia}
            {existing.pulse ? <small> 맥박 {existing.pulse}</small> : null}
          </div>
          <div className="row gap">
            <StageChip sys={existing.sys} dia={existing.dia} />
            <span className={existing.meds ? "meds on" : "meds"}>{existing.meds ? "약 복용함" : "약 복용 안 함"}</span>
          </div>
          {existing.note && <p className="note">{existing.note}</p>}
        </>
      ) : (
        <p className="muted">아직 기록이 없어요</p>
      )}
    </section>
  );
}

function ReadingForm({
  slot,
  date,
  initial,
  onDone,
  onCancel,
  save,
}: {
  slot: Slot;
  date: string;
  initial?: Reading;
  onDone: () => void;
  onCancel?: () => void;
  save: (r: Omit<Reading, "id">) => Promise<void>;
}) {
  const [sys, setSys] = useState(initial ? String(initial.sys) : "");
  const [dia, setDia] = useState(initial ? String(initial.dia) : "");
  const [pulse, setPulse] = useState(initial?.pulse ? String(initial.pulse) : "");
  const [meds, setMeds] = useState(initial?.meds ?? false);
  const [note, setNote] = useState(initial?.note ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const s = Number(sys);
  const d = Number(dia);
  const preview = sys && dia && !validate(s, d) ? classify(s, d) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = pulse ? Number(pulse) : undefined;
    const msg = validate(s, d, p);
    if (msg) return setErr(msg);
    setErr("");
    setBusy(true);
    try {
      await save({ date, slot, sys: s, dia: d, pulse: p, meds, note: note.trim() || undefined });
      onDone();
    } catch {
      setErr("저장에 실패했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{SLOT_LABEL[slot]} 혈압</h2>
      <div className="inputs">
        <label>
          <span>수축기(위)</span>
          <input inputMode="numeric" pattern="[0-9]*" value={sys} onChange={(e) => setSys(e.target.value)} placeholder="120" />
        </label>
        <label>
          <span>이완기(아래)</span>
          <input inputMode="numeric" pattern="[0-9]*" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="80" />
        </label>
        <label>
          <span>맥박</span>
          <input inputMode="numeric" pattern="[0-9]*" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="선택" />
        </label>
      </div>
      {preview && (
        <div className="preview" style={{ color: preview.color, background: preview.bg }}>
          {preview.label}
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={meds} onChange={(e) => setMeds(e.target.checked)} />
        혈압약 복용함
      </label>
      <input className="memo" value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모 (두통, 운동 후 등)" />
      <p className="hint">앉아서 5분 쉰 뒤 1~2분 간격으로 2번 재고, 평균을 입력하세요.</p>
      {err && <p className="error">{err}</p>}
      <div className="row gap">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </button>
        {onCancel && (
          <button className="btn" type="button" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}

function Summary() {
  const { readings } = useBackend();
  const rows: { label: string; slot?: Slot }[] = [
    { label: "아침", slot: "morning" },
    { label: "저녁", slot: "evening" },
    { label: "전체" },
  ];
  return (
    <section className="card">
      <h2>최근 7일 평균</h2>
      {rows.map(({ label, slot }) => {
        const a = average(readings, 7, slot);
        return (
          <div className="avg" key={label}>
            <span className="avg-label">{label}</span>
            {a ? (
              <>
                <b>
                  {a.sys}/{a.dia}
                </b>
                <StageChip sys={a.sys} dia={a.dia} />
                <span className="muted">{a.count}회</span>
              </>
            ) : (
              <span className="muted">기록 없음</span>
            )}
          </div>
        );
      })}
      <p className="hint">가정혈압 기준 135/85 미만이 일반적인 목표예요. 개인 목표는 담당 의사와 정하세요.</p>
    </section>
  );
}

function Chart() {
  const { readings } = useBackend();
  const today = todayStr();
  const DAYS = 14;
  const start = addDays(today, -(DAYS - 1));
  const pts = readings
    .filter((r) => r.date >= start && r.date <= today)
    .map((r) => {
      const di = DAYS - 1 - daysBetween(r.date, today);
      return { x: di + (r.slot === "evening" ? 0.5 : 0), sys: r.sys, dia: r.dia };
    })
    .sort((a, b) => a.x - b.x);

  const W = 320, H = 170, L = 28, R = 8, T = 10, B = 22;
  const lo = Math.min(60, ...pts.map((p) => p.dia - 10));
  const hi = Math.max(170, ...pts.map((p) => p.sys + 10));
  const X = (x: number) => L + (x / DAYS) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = (key: "sys" | "dia") => pts.map((p) => `${X(p.x)},${Y(p[key])}`).join(" ");
  const ticks = [0, 3, 6, 9, 13];

  return (
    <section className="card">
      <h2>최근 14일 추이</h2>
      {pts.length === 0 ? (
        <p className="muted">기록이 쌓이면 그래프가 보여요</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="최근 14일 혈압 추이" className="chart">
          {[80, 120, 160].filter((v) => v > lo && v < hi).map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="grid" />
              <text x={L - 4} y={Y(v) + 3} className="axis" textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={Y(135)} y2={Y(135)} className="goal" />
          <line x1={L} x2={W - R} y1={Y(85)} y2={Y(85)} className="goal" />
          <polyline points={line("sys")} className="l-sys" />
          <polyline points={line("dia")} className="l-dia" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={X(p.x)} cy={Y(p.sys)} r="3" className="d-sys" />
              <circle cx={X(p.x)} cy={Y(p.dia)} r="3" className="d-dia" />
            </g>
          ))}
          {ticks.map((t) => (
            <text key={t} x={X(t)} y={H - 6} className="axis" textAnchor="middle">
              {fmtDate(addDays(start, t)).split(" ")[0]}
            </text>
          ))}
        </svg>
      )}
      <div className="legend">
        <span className="k-sys">● 수축기</span>
        <span className="k-dia">● 이완기</span>
        <span className="muted">점선: 135 / 85</span>
      </div>
    </section>
  );
}

function daysBetween(a: string, b: string): number {
  const ms = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((ms(b) - ms(a)) / 86400000);
}

/* ---------------- 기록 ---------------- */
function HistoryTab() {
  const { readings, role, remove, save } = useBackend();
  const sorted = useMemo(() => sortDesc(readings), [readings]);
  const dates = [...new Set(sorted.map((r) => r.date))];
  const [msg, setMsg] = useState("");

  function backup() {
    const blob = new Blob([JSON.stringify(readings, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bp-note-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function restore(file: File) {
    try {
      const arr = JSON.parse(await file.text()) as Reading[];
      let n = 0;
      for (const r of arr) {
        if (!r.date || !r.slot || validate(r.sys, r.dia, r.pulse)) continue;
        await save({ date: r.date, slot: r.slot, sys: r.sys, dia: r.dia, pulse: r.pulse, meds: !!r.meds, note: r.note });
        n++;
      }
      setMsg(`${n}건을 불러왔어요`);
    } catch {
      setMsg("파일을 읽지 못했어요");
    }
  }

  return (
    <>
      <div className="row gap wrap tools">
        <button className="btn" onClick={() => window.print()}>
          진료용 인쇄/PDF
        </button>
        <button className="btn" onClick={backup}>
          백업 저장
        </button>
        {role === "edit" && (
          <label className="btn file">
            백업 불러오기
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </label>
        )}
      </div>
      {msg && <p className="hint">{msg}</p>}
      {dates.length === 0 && <p className="muted center-text">아직 기록이 없어요</p>}
      {dates.map((d) => (
        <section className="card" key={d}>
          <h2>{fmtDate(d)}</h2>
          {sorted
            .filter((r) => r.date === d)
            .map((r) => (
              <div className="hist" key={r.id}>
                <span className="avg-label">{SLOT_LABEL[r.slot]}</span>
                <b>
                  {r.sys}/{r.dia}
                </b>
                {r.pulse ? <span className="muted">{r.pulse}</span> : null}
                <StageChip sys={r.sys} dia={r.dia} />
                {r.meds && <span className="meds on">약</span>}
                {role === "edit" && (
                  <button
                    className="link danger"
                    onClick={() => {
                      if (confirm(`${fmtDate(r.date)} ${SLOT_LABEL[r.slot]} 기록을 삭제할까요?`)) remove(r.id);
                    }}
                  >
                    삭제
                  </button>
                )}
                {r.note && <div className="note full">{r.note}</div>}
              </div>
            ))}
        </section>
      ))}
    </>
  );
}

/* ---------------- 진료용 인쇄 (화면에는 숨김) ---------------- */
function PrintReport() {
  const { readings } = useBackend();
  const today = todayStr();
  const from = addDays(today, -29);
  const rows = sortDesc(readings).filter((r) => r.date >= from);
  const a7 = average(readings, 7);
  const a30 = average(readings, 30);
  return (
    <div className="print-only">
      <h1>혈압 기록 (최근 30일)</h1>
      <p>
        출력일 {today} · 7일 평균 {a7 ? `${a7.sys}/${a7.dia} (${a7.count}회)` : "-"} · 30일 평균{" "}
        {a30 ? `${a30.sys}/${a30.dia} (${a30.count}회)` : "-"}
      </p>
      <table>
        <thead>
          <tr>
            <th>날짜</th>
            <th>시간대</th>
            <th>수축기</th>
            <th>이완기</th>
            <th>맥박</th>
            <th>약</th>
            <th>메모</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{fmtDate(r.date)}</td>
              <td>{SLOT_LABEL[r.slot]}</td>
              <td>{r.sys}</td>
              <td>{r.dia}</td>
              <td>{r.pulse ?? ""}</td>
              <td>{r.meds ? "O" : ""}</td>
              <td>{r.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
