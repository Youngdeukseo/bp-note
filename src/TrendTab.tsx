import { useMemo, useState } from "react";
import { useBackend } from "./backend";
import { SLOT_LABEL, addDays, average, classify, fmtDate, todayStr, type Reading } from "./bp";
import { Seg, StageChip } from "./ui";
import { SODIUM_TARGET, intakeByDay } from "./meals";

const RANK: Record<string, number> = { ok: 0, elev: 1, pre: 2, s1: 3, s2: 4, crisis: 5 };
const GOAL_SYS = 135;
const GOAL_DIA = 85;

function byDate(readings: Reading[]): Map<string, Reading[]> {
  const m = new Map<string, Reading[]>();
  for (const r of readings) {
    const a = m.get(r.date) ?? [];
    a.push(r);
    m.set(r.date, a);
  }
  return m;
}

function goalRate(rs: Reading[]): number | null {
  if (rs.length === 0) return null;
  return Math.round((rs.filter((r) => r.sys < GOAL_SYS && r.dia < GOAL_DIA).length / rs.length) * 100);
}

export default function TrendTab() {
  const [view, setView] = useState<"cal" | "graph">("cal");
  return (
    <>
      <div className="week-head">
        <Seg
          value={view}
          onChange={setView}
          options={[
            { value: "cal", label: "달력" },
            { value: "graph", label: "그래프" },
          ]}
        />
      </div>
      {view === "cal" ? <CalendarView /> : <GraphView />}
    </>
  );
}

/* ---------------- 달력 ---------------- */
function CalendarView() {
  const { readings } = useBackend();
  const today = todayStr();
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [sel, setSel] = useState<string>(today);
  const map = useMemo(() => byDate(readings), [readings]);

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = first.getUTCDay(); // 일요일 시작
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const monthRows = readings.filter((r) => r.date.startsWith(month));
  const avg = monthRows.length
    ? { sys: Math.round(monthRows.reduce((a, r) => a + r.sys, 0) / monthRows.length), dia: Math.round(monthRows.reduce((a, r) => a + r.dia, 0) / monthRows.length) }
    : null;
  const rate = goalRate(monthRows);

  const move = (d: number) => {
    const dt = new Date(Date.UTC(y, m - 1 + d, 1));
    setMonth(dt.toISOString().slice(0, 7));
  };
  const selRows = map.get(sel) ?? [];

  return (
    <>
      <section className="card">
        <div className="row between cal-head">
          <button className="link" onClick={() => move(-1)} aria-label="이전 달">
            ◀
          </button>
          <h2>
            {y}년 {m}월
          </h2>
          <button className="link" onClick={() => move(1)} aria-label="다음 달">
            ▶
          </button>
        </div>
        <div className="cal">
          {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
            <div key={w} className="cal-w">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const rs = map.get(d);
            const worst = rs?.reduce((a, r) => (RANK[classify(r.sys, r.dia).key] > RANK[classify(a.sys, a.dia).key] ? r : a));
            const st = worst ? classify(worst.sys, worst.dia) : null;
            return (
              <button
                key={d}
                className={`cal-d ${sel === d ? "sel" : ""} ${d === today ? "today" : ""}`}
                style={st ? { background: st.bg, color: st.color } : undefined}
                onClick={() => setSel(d)}
                aria-label={`${d}${worst ? ` ${worst.sys}/${worst.dia}` : ""}`}
              >
                <span>{Number(d.slice(8, 10))}</span>
                {worst && <small>{worst.sys}</small>}
              </button>
            );
          })}
        </div>
        <div className="legend wrap">
          {[
            ["#dcfce7", "정상"],
            ["#ecfccb", "주의"],
            ["#fef9c3", "전단계"],
            ["#ffedd5", "1기"],
            ["#fee2e2", "2기 이상"],
          ].map(([c, l]) => (
            <span key={l} className="lg">
              <i style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
        <p className="hint">날짜 칸의 숫자는 그날 가장 높았던 수축기 혈압이에요.</p>
      </section>

      <section className="card">
        <h2>{y}년 {m}월 요약</h2>
        {avg ? (
          <>
            <div className="avg">
              <span className="avg-label">평균</span>
              <b>
                {avg.sys}/{avg.dia}
              </b>
              <StageChip sys={avg.sys} dia={avg.dia} />
              <span className="muted">{monthRows.length}회</span>
            </div>
            <div className="avg">
              <span className="avg-label">목표</span>
              <b>{rate}%</b>
              <span className="muted">
                {GOAL_SYS}/{GOAL_DIA} 미만인 측정 비율
              </span>
            </div>
          </>
        ) : (
          <p className="muted">이 달에는 기록이 없어요</p>
        )}
      </section>

      <section className="card">
        <h2>{fmtDate(sel)}</h2>
        {selRows.length === 0 ? (
          <p className="muted">기록이 없어요</p>
        ) : (
          [...selRows]
            .sort((a, b) => (a.slot === b.slot ? 0 : a.slot === "morning" ? -1 : 1))
            .map((r) => (
              <div className="hist" key={r.id}>
                <span className="avg-label">{SLOT_LABEL[r.slot]}</span>
                <b>
                  {r.sys}/{r.dia}
                </b>
                {r.pulse ? <span className="muted">맥박 {r.pulse}</span> : null}
                <StageChip sys={r.sys} dia={r.dia} />
                {r.meds && <span className="meds on">약</span>}
                {r.note && <div className="note full">{r.note}</div>}
              </div>
            ))
        )}
      </section>
    </>
  );
}

/* ---------------- 그래프 ---------------- */
function GraphView() {
  const { readings } = useBackend();
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const today = todayStr();
  const from = addDays(today, -(range - 1));
  const rows = readings.filter((r) => r.date >= from && r.date <= today);
  const map = byDate(rows);

  const pts = [...map.entries()]
    .map(([d, rs]) => ({
      x: Math.round((Date.parse(d) - Date.parse(from)) / 86400000),
      sys: Math.round(rs.reduce((a, r) => a + r.sys, 0) / rs.length),
      dia: Math.round(rs.reduce((a, r) => a + r.dia, 0) / rs.length),
    }))
    .sort((a, b) => a.x - b.x);

  const W = 320, H = 200, L = 30, R = 8, T = 10, B = 22;
  const lo = Math.min(60, ...pts.map((p) => p.dia - 10));
  const hi = Math.max(170, ...pts.map((p) => p.sys + 10));
  const X = (x: number) => L + (x / (range - 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = (k: "sys" | "dia") => pts.map((p) => `${X(p.x)},${Y(p[k])}`).join(" ");
  const tickCount = range === 7 ? 7 : 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => Math.round((i * (range - 1)) / (tickCount - 1)));

  const morning = average(readings, range, "morning");
  const evening = average(readings, range, "evening");
  const rate = goalRate(rows);

  return (
    <>
      <div className="week-head">
        <Seg
          value={range}
          onChange={setRange}
          options={[
            { value: 7, label: "7일" },
            { value: 30, label: "30일" },
            { value: 90, label: "90일" },
          ]}
        />
      </div>
      <section className="card">
        <h2>하루 평균 혈압</h2>
        {pts.length === 0 ? (
          <p className="muted">이 기간에는 기록이 없어요</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`최근 ${range}일 혈압 추이`} className="chart">
            {[80, 120, 160].filter((v) => v > lo && v < hi).map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="grid" />
                <text x={L - 4} y={Y(v) + 3} className="axis" textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            <line x1={L} x2={W - R} y1={Y(GOAL_SYS)} y2={Y(GOAL_SYS)} className="goal" />
            <line x1={L} x2={W - R} y1={Y(GOAL_DIA)} y2={Y(GOAL_DIA)} className="goal" />
            <polyline points={line("sys")} className="l-sys" />
            <polyline points={line("dia")} className="l-dia" />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={X(p.x)} cy={Y(p.sys)} r={range === 90 ? 2 : 3} className="d-sys" />
                <circle cx={X(p.x)} cy={Y(p.dia)} r={range === 90 ? 2 : 3} className="d-dia" />
              </g>
            ))}
            {ticks.map((t) => (
              <text key={t} x={X(t)} y={H - 6} className="axis" textAnchor="middle">
                {fmtDate(addDays(from, t)).split(" ")[0]}
              </text>
            ))}
          </svg>
        )}
        <div className="legend">
          <span className="k-sys">● 수축기</span>
          <span className="k-dia">● 이완기</span>
          <span className="muted">점선: {GOAL_SYS} / {GOAL_DIA}</span>
        </div>
      </section>

      <section className="card">
        <h2>최근 {range}일 통계</h2>
        {[
          ["아침", morning],
          ["저녁", evening],
        ].map(([label, a]) => {
          const v = a as ReturnType<typeof average>;
          return (
            <div className="avg" key={label as string}>
              <span className="avg-label">{label as string}</span>
              {v ? (
                <>
                  <b>
                    {v.sys}/{v.dia}
                  </b>
                  <StageChip sys={v.sys} dia={v.dia} />
                  <span className="muted">{v.count}회</span>
                </>
              ) : (
                <span className="muted">기록 없음</span>
              )}
            </div>
          );
        })}
        <div className="avg">
          <span className="avg-label">목표</span>
          <b>{rate === null ? "-" : `${rate}%`}</b>
          <span className="muted">{GOAL_SYS}/{GOAL_DIA} 미만 비율</span>
        </div>
      </section>
      <IntakeCard />
    </>
  );
}

/* ---------------- 먹은 식단 나트륨 vs 혈압 (최근 14일) ---------------- */
function IntakeCard() {
  const { plans, checks, readings, ready } = useBackend();
  const today = todayStr();
  const from = addDays(today, -13);
  const days = intakeByDay(plans, checks, from, today).filter((d) => d.eaten > 0);
  const all = intakeByDay(plans, checks, from, today);
  const planned = all.reduce((n, d) => n + d.planned, 0);
  const eaten = all.reduce((n, d) => n + d.eaten, 0);
  if (!ready) return null;
  const complete = days.filter((d) => d.complete);
  const avgSodium = complete.length ? Math.round(complete.reduce((n, d) => n + d.sodium, 0) / complete.length) : null;
  const map = byDate(readings.filter((r) => r.date >= from && r.date <= today));
  return (
    <section className="card">
      <h2>식사 나트륨과 혈압 (최근 14일)</h2>
      {days.length === 0 ? (
        <p className="muted">식단 탭에서 먹은 끼니에 체크하면 여기에 하루 나트륨과 그날 평균 혈압이 나란히 보여요.</p>
      ) : (
        <>
          <div className="avg">
            <span className="avg-label">실천</span>
            <b>{planned ? Math.round((eaten / planned) * 100) : 0}%</b>
            <span className="muted">
              계획한 {planned}끼 중 {eaten}끼 체크
            </span>
          </div>
          {avgSodium !== null && (
            <div className="avg">
              <span className="avg-label">나트륨</span>
              <b>{avgSodium.toLocaleString()}mg</b>
              <span className="muted">하루 평균 (모두 체크한 {complete.length}일, 목표 {SODIUM_TARGET.toLocaleString()})</span>
            </div>
          )}
          <table className="mini">
            <thead>
              <tr>
                <th>날짜</th>
                <th>끼니</th>
                <th>나트륨</th>
                <th>그날 평균 혈압</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => {
                const rs = map.get(d.date) ?? [];
                const bp = rs.length
                  ? `${Math.round(rs.reduce((a, r) => a + r.sys, 0) / rs.length)}/${Math.round(rs.reduce((a, r) => a + r.dia, 0) / rs.length)}`
                  : "-";
                return (
                  <tr key={d.date}>
                    <td>{fmtDate(d.date).split(" ")[0]}</td>
                    <td>
                      {d.eaten}/{d.planned}
                    </td>
                    <td>{d.sodium.toLocaleString()}mg</td>
                    <td>{bp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint">레시피 기준 추정치이고 체크한 끼니만 합산해요. 며칠 기록으로 원인을 단정할 수는 없고, 참고용으로만 보세요.</p>
        </>
      )}
    </section>
  );
}
