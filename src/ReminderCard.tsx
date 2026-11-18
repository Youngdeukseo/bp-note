import { useState } from "react";
import { applyRemind, loadRemind, remindSupported, type RemindSettings } from "./notify";

export default function ReminderCard() {
  const [s, setS] = useState<RemindSettings>(loadRemind);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const supported = remindSupported();

  async function apply(next: RemindSettings) {
    setS(next);
    setBusy(true);
    const err = await applyRemind(next);
    setBusy(false);
    setMsg(err || (next.on ? "알림을 설정했어요." : "알림을 껐어요."));
    if (err) setS({ ...next, on: false });
  }

  return (
    <section className="card">
      <h2>측정·복용 알림</h2>
      {!supported ? (
        <p className="muted">알림은 휴대폰에 설치한 앱(APK)에서 쓸 수 있어요. 앱에서 열어 설정해 주세요.</p>
      ) : (
        <>
          <label className="row between remind-row">
            <span>매일 알림 받기</span>
            <input type="checkbox" className="eat" checked={s.on} disabled={busy} onChange={(e) => void apply({ ...s, on: e.target.checked })} />
          </label>
          <label className="row between remind-row">
            <span>아침 (혈압·약)</span>
            <input type="time" value={s.morning} disabled={busy} onChange={(e) => e.target.value && void apply({ ...s, morning: e.target.value })} />
          </label>
          <label className="row between remind-row">
            <span>저녁 (혈압·약)</span>
            <input type="time" value={s.evening} disabled={busy} onChange={(e) => e.target.value && void apply({ ...s, evening: e.target.value })} />
          </label>
          {msg && <p className="hint">{msg}</p>}
          <p className="hint">이 휴대폰에서만 울려요. 이미 기록했어도 알림은 울리니, 필요 없으면 시간을 조정하세요.</p>
        </>
      )}
    </section>
  );
}
