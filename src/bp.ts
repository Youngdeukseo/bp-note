export type Slot = "morning" | "evening";

export interface Reading {
  id: string;
  date: string; // YYYY-MM-DD
  slot: Slot;
  sys: number;
  dia: number;
  pulse?: number;
  meds: boolean;
  note?: string;
}

export interface Stage {
  key: string;
  label: string;
  color: string; // 글자/강조색
  bg: string; // 배경색
}

// 대한고혈압학회 분류 (수축기 또는 이완기 중 높은 쪽 기준)
export function classify(sys: number, dia: number): Stage {
  if (sys >= 180 || dia >= 120) return { key: "crisis", label: "위험 수준", color: "#991b1b", bg: "#fee2e2" };
  if (sys >= 160 || dia >= 100) return { key: "s2", label: "고혈압 2기", color: "#b91c1c", bg: "#fee2e2" };
  if (sys >= 140 || dia >= 90) return { key: "s1", label: "고혈압 1기", color: "#c2410c", bg: "#ffedd5" };
  if (sys >= 130 || dia >= 80) return { key: "pre", label: "고혈압 전단계", color: "#a16207", bg: "#fef9c3" };
  if (sys >= 120) return { key: "elev", label: "주의 혈압", color: "#4d7c0f", bg: "#ecfccb" };
  return { key: "ok", label: "정상", color: "#15803d", bg: "#dcfce7" };
}

export const SLOT_LABEL: Record<Slot, string> = { morning: "아침", evening: "저녁" };

// 한국 시간 기준 YYYY-MM-DD
export function todayStr(d = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const w = ["일", "월", "화", "수", "목", "금", "토"][dt.getUTCDay()];
  return `${m}/${d} (${w})`;
}

export interface Avg {
  sys: number;
  dia: number;
  count: number;
}

// 오늘 포함 최근 days일 평균 (slot 지정 시 해당 시간대만)
export function average(readings: Reading[], days: number, slot?: Slot, today = todayStr()): Avg | null {
  const from = addDays(today, -(days - 1));
  const rows = readings.filter((r) => r.date >= from && r.date <= today && (!slot || r.slot === slot));
  if (rows.length === 0) return null;
  const sys = rows.reduce((a, r) => a + r.sys, 0) / rows.length;
  const dia = rows.reduce((a, r) => a + r.dia, 0) / rows.length;
  return { sys: Math.round(sys), dia: Math.round(dia), count: rows.length };
}

export function sortDesc(readings: Reading[]): Reading[] {
  return [...readings].sort((a, b) =>
    a.date === b.date ? (a.slot === b.slot ? 0 : a.slot === "evening" ? -1 : 1) : a.date < b.date ? 1 : -1
  );
}

export function validate(sys: number, dia: number, pulse?: number): string | null {
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) return "수축기와 이완기를 입력해 주세요";
  if (sys < 60 || sys > 260) return "수축기(위) 수치를 확인해 주세요";
  if (dia < 30 || dia > 160) return "이완기(아래) 수치를 확인해 주세요";
  if (sys <= dia) return "수축기가 이완기보다 높아야 해요";
  if (pulse !== undefined && (pulse < 30 || pulse > 220)) return "맥박 수치를 확인해 주세요";
  return null;
}

/* ---------------- 체중 (주 1회) ---------------- */
export interface Weight {
  id: string;
  date: string; // YYYY-MM-DD
  kg: number;
  note?: string;
}

// 월요일 시작 주의 첫날
export function weekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
  return addDays(dateStr, -((dow + 6) % 7));
}

export function validateWeight(kg: number): string | null {
  if (!Number.isFinite(kg)) return "체중을 입력해 주세요";
  if (kg < 20 || kg > 300) return "체중 수치를 확인해 주세요";
  return null;
}

/* ---------------- 약 · 복용 기록 ---------------- */
export interface Med {
  id: string;
  name: string;
  cls?: string; // 계열 키 (medinfo.ts)
  dose?: string; // 예: "5mg 1정"
  times: Slot[]; // 복용 시간대
  active: boolean;
  note?: string;
}
export interface MedLog {
  date: string;
  medId: string;
  slot: Slot;
  taken: boolean;
}
export interface Check {
  weekStart: string;
  key: string;
  checked: boolean;
}
