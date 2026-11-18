import { useMemo, useState } from "react";
import { useBackend } from "./backend";
import { addDays, average, classify, fmtDate, todayStr, weekStart, type Avg, type Reading } from "./bp";
import { adherence } from "./MedsTab";
import { intakeByDay, SODIUM_TARGET } from "./meals";
import { Seg, StageChip } from "./ui";

const GOAL_SYS = 135;
const GOAL_DIA = 85;
const NOTE_KEY = "bp.doctorq.v1";

function loadNote(): string {
  try {
    return localStorage.getItem(NOTE_KEY) ?? "";
  } catch {
    return "";
  }
}

function avgOf(rs: Reading[]): Avg | null {
  if (rs.length === 0) return null;
  return {
    sys: Math.round(rs.reduce((a, r) => a + r.sys, 0) / rs.length),
    dia: Math.round(rs.reduce((a, r) => a + r.dia, 0) / rs.length),
    count: rs.length,
  };
}

const fmtAvg = (a: Avg | null) => (a ? `${a.sys}/${a.dia}` : "-");
const md = (d: string) => fmtDate(d).split(" ")[0];

/** 앱(APK) 안이면 true */
export const isNativeApp = (): boolean => {
  const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!c?.isNativePlatform?.();
};

async function shareText(title: string, text: string): Promise<string> {
  const w = window as unknown as {
    Capacitor?: { Plugins?: { Share?: { share: (o: { title: string; text: string; dialogTitle?: string }) => Promise<unknown> } } };
  };
  try {
    const sh = w.Capacitor?.Plugins?.Share;
    if (sh) {
      await sh.share({ title, text, dialogTitle: "진료 리포트 공유" });
      return "";
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return "";
    }
    await navigator.clipboard.writeText(text);
    return "복사했어요. 메시지나 메모에 붙여 넣으세요.";
  } catch (e) {
    if (e instanceof Error && /abort|cancel/i.test(`${e.name} ${e.message}`)) return "";
    try {
      await navigator.clipboard.writeText(text);
      return "복사했어요. 메시지나 메모에 붙여 넣으세요.";
    } catch {
      return "공유하지 못했어요. 화면을 캡처해서 보내 주세요.";
    }
  }
}

export default function ReportTab() {
  const { readings, weights, meds, medLogs, plans, checks, ready } = useBackend();
  const [days, setDays] = useState<14 | 28 | 60>(28);
  const [note, setNote] = useState(loadNote);
  const [msg, setMsg] = useState("");
  const today = todayStr();
  const from = addDays(today, -(days - 1));

  const r = useMemo(() => {
    const rows = readings.filter((x) => x.date >= from && x.date <= today);
    const all = avgOf(rows);
    const morning = average(readings, days, "morning");
    const evening = average(readings, days, "evening");
    const goal = rows.length ? Math.round((rows.filter((x) => x.sys < GOAL_SYS && x.dia < GOAL_DIA).length / rows.length) * 100) : null;
    const hi = rows.reduce<Reading | null>((a, x) => (!a || x.sys > a.sys ? x : a), null);
    const lo = rows.reduce<Reading | null>((a, x) => (!a || x.sys < a.sys ? x : a), null);
    // 주별 평균
    const weeks: { ws: string; morning: Avg | null; evening: Avg | null; count: number }[] = [];
    for (let ws = weekStart(from); ws <= today; ws = addDays(ws, 7)) {
      const wr = rows.filter((x) => x.date >= ws && x.date < addDays(ws, 7));
      weeks.push({ ws, morning: avgOf(wr.filter((x) => x.slot === "morning")), evening: avgOf(wr.filter((x) => x.slot === "evening")), count: wr.length });
    }
    const ws2 = [...weights].filter((w) => w.date >= from && w.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
    const wFirst = ws2[0];
    const wLast = ws2[ws2.length - 1];
    const med = adherence(meds, medLogs, days);
    const intake = intakeByDay(plans, checks, from, today).filter((d) => d.complete);
    const avgNa = intake.length ? Math.round(intake.reduce((n, d) => n + d.sodium, 0) / intake.length) : null;
    return { rows, all, morning, evening, goal, hi, lo, weeks, wFirst, wLast, med, avgNa, naDays: intake.length };
  }, [readings, weights, meds, medLogs, plans, checks, days, from, today]);

  const activeMeds = meds.filter((m) => m.active);

  function saveNote(v: string) {
    setNote(v);
    try {
      localStorage.setItem(NOTE_KEY, v);
    } catch {
      /* 저장 실패는 무시 */
    }
  }

  function buildText(): string {
    const L: string[] = [];
    L.push(`[혈압 진료 요약] ${md(from)} ~ ${md(today)} (최근 ${days}일)`);
    L.push(`측정 ${r.rows.length}회 · 평균 ${fmtAvg(r.all)}${r.all ? ` (${classify(r.all.sys, r.all.dia).label})` : ""}`);
    L.push(`아침 평균 ${fmtAvg(r.morning)} · 저녁 평균 ${fmtAvg(r.evening)}`);
    if (r.goal !== null) L.push(`목표(${GOAL_SYS}/${GOAL_DIA} 미만) 달성 ${r.goal}%`);
    if (r.hi) L.push(`최고 ${r.hi.sys}/${r.hi.dia} (${md(r.hi.date)} ${r.hi.slot === "morning" ? "아침" : "저녁"})`);
    if (r.lo) L.push(`최저 ${r.lo.sys}/${r.lo.dia} (${md(r.lo.date)} ${r.lo.slot === "morning" ? "아침" : "저녁"})`);
    L.push("");
    L.push("주별 평균 (아침 / 저녁)");
    r.weeks.forEach((w) => L.push(`- ${md(w.ws)}~ : ${fmtAvg(w.morning)} / ${fmtAvg(w.evening)} (${w.count}회)`));
    L.push("");
    if (r.med) L.push(`약 복용률 ${r.med.pct}% (${r.med.taken}/${r.med.scheduled}회)`);
    if (activeMeds.length) L.push(`복용 중인 약: ${activeMeds.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ""}`).join(", ")}`);
    if (r.wFirst && r.wLast) {
      const diff = Math.round((r.wLast.kg - r.wFirst.kg) * 10) / 10;
      L.push(r.wFirst.date === r.wLast.date ? `체중 ${r.wLast.kg}kg` : `체중 ${r.wFirst.kg}kg → ${r.wLast.kg}kg (${diff > 0 ? "+" : ""}${diff}kg)`);
    }
    if (r.avgNa !== null) L.push(`식사 나트륨(추정) 하루 평균 약 ${r.avgNa.toLocaleString()}mg (${r.naDays}일 기록)`);
    if (note.trim()) {
      L.push("");
      L.push("진료 때 물어볼 것");
      note.trim().split("\n").forEach((l) => L.push(`- ${l.replace(/^[-•]\s*/, "")}`));
    }
    L.push("");
    L.push("※ 가정 혈압 기록이며 진단이 아닙니다.");
    return L.join("\n");
  }

  async function share() {
    setMsg(await shareText("혈압 진료 요약", buildText()));
  }

  function print() {
    document.body.classList.add("print-report");
    const done = () => {
      document.body.classList.remove("print-report");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }

  if (!ready) return <p className="muted">불러오는 중…</p>;

  return (
    <div className="report-root">
      <div className="week-head no-print">
        <Seg
          value={days}
          onChange={setDays}
          options={[
            { value: 14, label: "2주" },
            { value: 28, label: "4주" },
            { value: 60, label: "60일" },
          ]}
        />
        <span className="muted">
          {md(from)} ~ {md(today)}
        </span>
      </div>

      <section className="card">
        <h2>진료 요약 · 최근 {days}일</h2>
        {r.rows.length === 0 ? (
          <p className="muted">이 기간에 기록이 없어요.</p>
        ) : (
          <>
            <div className="avg">
              <span className="avg-label">전체</span>
              <b>{fmtAvg(r.all)}</b>
              {r.all && <StageChip sys={r.all.sys} dia={r.all.dia} />}
              <span className="muted">{r.rows.length}회</span>
            </div>
            <div className="avg">
              <span className="avg-label">아침</span>
              <b>{fmtAvg(r.morning)}</b>
              {r.morning && <StageChip sys={r.morning.sys} dia={r.morning.dia} />}
              <span className="muted">{r.morning?.count ?? 0}회</span>
            </div>
            <div className="avg">
              <span className="avg-label">저녁</span>
              <b>{fmtAvg(r.evening)}</b>
              {r.evening && <StageChip sys={r.evening.sys} dia={r.evening.dia} />}
              <span className="muted">{r.evening?.count ?? 0}회</span>
            </div>
            <div className="avg">
              <span className="avg-label">목표</span>
              <b>{r.goal}%</b>
              <span className="muted">
                {GOAL_SYS}/{GOAL_DIA} 미만 비율
              </span>
            </div>
            {r.hi && r.lo && (
              <div className="avg">
                <span className="avg-label">범위</span>
                <span>
                  최고 <b>{r.hi.sys}/{r.hi.dia}</b> ({md(r.hi.date)}) · 최저 <b>{r.lo.sys}/{r.lo.dia}</b> ({md(r.lo.date)})
                </span>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2>주별 평균</h2>
        <table className="mini">
          <thead>
            <tr>
              <th>주</th>
              <th>아침</th>
              <th>저녁</th>
              <th>횟수</th>
            </tr>
          </thead>
          <tbody>
            {r.weeks.map((w) => (
              <tr key={w.ws}>
                <td>{md(w.ws)}~</td>
                <td>{fmtAvg(w.morning)}</td>
                <td>{fmtAvg(w.evening)}</td>
                <td>{w.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>약 · 체중 · 식사</h2>
        <div className="avg">
          <span className="avg-label">복용률</span>
          {r.med ? (
            <>
              <b>{r.med.pct}%</b>
              <span className="muted">
                {r.med.taken}/{r.med.scheduled}회
              </span>
            </>
          ) : (
            <span className="muted">복용 기록 없음</span>
          )}
        </div>
        <div className="avg">
          <span className="avg-label">복용약</span>
          <span>{activeMeds.length ? activeMeds.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ""}`).join(", ") : <span className="muted">등록한 약 없음</span>}</span>
        </div>
        <div className="avg">
          <span className="avg-label">체중</span>
          {r.wFirst && r.wLast ? (
            r.wFirst.date === r.wLast.date ? (
              <b>{r.wLast.kg}kg</b>
            ) : (
              <span>
                <b>{r.wFirst.kg}kg → {r.wLast.kg}kg</b> ({Math.round((r.wLast.kg - r.wFirst.kg) * 10) / 10 > 0 ? "+" : ""}
                {Math.round((r.wLast.kg - r.wFirst.kg) * 10) / 10}kg)
              </span>
            )
          ) : (
            <span className="muted">기록 없음</span>
          )}
        </div>
        <div className="avg">
          <span className="avg-label">나트륨</span>
          {r.avgNa !== null ? (
            <span>
              <b>약 {r.avgNa.toLocaleString()}mg</b> <span className="muted">하루 평균 · 목표 {SODIUM_TARGET.toLocaleString()} · {r.naDays}일(추정)</span>
            </span>
          ) : (
            <span className="muted">식단 체크 기록 없음</span>
          )}
        </div>
      </section>

      <section className="card">
        <h2>진료 때 물어볼 것</h2>
        <textarea
          className="note-box"
          rows={4}
          value={note}
          placeholder="예: 약 시간을 아침 식후로 바꿔도 되는지, 저녁 혈압이 높은 이유 등"
          onChange={(e) => saveNote(e.target.value)}
        />
        <p className="hint no-print">이 기기에만 저장돼요. 줄바꿈으로 항목을 나누세요.</p>
        {note.trim() && <p className="print-note">{note}</p>}
      </section>

      <div className="no-print">
        <button className="btn wide" onClick={() => void share()}>
          {typeof navigator.share === "function" || isNativeApp() ? "공유하기 (카톡·메시지)" : "텍스트 복사"}
        </button>
        {!isNativeApp() && (
          <button className="btn wide ghost" onClick={print}>
            인쇄 / PDF 저장
          </button>
        )}
        {msg && <p className="hint">{msg}</p>}
      </div>
      <p className="hint">가정에서 잰 기록의 요약이며 진단이 아니에요. 진료 때 보여주는 참고 자료로 쓰세요.</p>
    </div>
  );
}
