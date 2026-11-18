// 측정·복용 알림 — APK(Capacitor) 안에서만 동작하는 기기 내 알림 (서버·비용 없음)
const KEY = "bp.remind.v1";
const CH = "bp-remind";
const IDS = { morning: 101, evening: 102 } as const;

export interface RemindSettings {
  on: boolean;
  morning: string; // "HH:MM"
  evening: string;
}
export const DEFAULT_REMIND: RemindSettings = { on: false, morning: "07:30", evening: "21:00" };

interface LN {
  checkPermissions: () => Promise<{ display: string }>;
  requestPermissions: () => Promise<{ display: string }>;
  createChannel?: (c: { id: string; name: string; description?: string; importance: number; vibration?: boolean }) => Promise<void>;
  schedule: (o: {
    notifications: {
      id: number;
      title: string;
      body: string;
      channelId?: string;
      schedule: { on: { hour: number; minute: number }; allowWhileIdle?: boolean };
    }[];
  }) => Promise<unknown>;
  cancel: (o: { notifications: { id: number }[] }) => Promise<void>;
}

function plugin(): LN | null {
  const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { LocalNotifications?: LN } } }).Capacitor;
  if (!c?.isNativePlatform?.()) return null;
  return c.Plugins?.LocalNotifications ?? null;
}

export const remindSupported = () => plugin() !== null;

export function loadRemind(): RemindSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_REMIND, ...(JSON.parse(raw) as Partial<RemindSettings>) } : DEFAULT_REMIND;
  } catch {
    return DEFAULT_REMIND;
  }
}
function persist(s: RemindSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const hm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return { hour: Number.isFinite(h) ? h : 7, minute: Number.isFinite(m) ? m : 0 };
};

/** 설정을 저장하고 알림을 다시 예약한다. 실패 시 오류 메시지를 돌려준다. */
export async function applyRemind(s: RemindSettings): Promise<string> {
  const ln = plugin();
  if (!ln) return "앱(APK)에서만 알림을 쓸 수 있어요.";
  try {
    await ln.cancel({ notifications: [{ id: IDS.morning }, { id: IDS.evening }] });
    if (!s.on) {
      persist(s);
      return "";
    }
    let perm = await ln.checkPermissions();
    if (perm.display !== "granted") perm = await ln.requestPermissions();
    if (perm.display !== "granted") {
      persist({ ...s, on: false });
      return "알림 권한이 꺼져 있어요. 휴대폰 설정 → 앱 → 혈압 노트 → 알림을 켜 주세요.";
    }
    await ln.createChannel?.({ id: CH, name: "측정·복용 알림", description: "혈압 측정과 약 복용 시간 알림", importance: 4, vibration: true });
    await ln.schedule({
      notifications: [
        {
          id: IDS.morning,
          title: "아침 혈압 측정",
          body: "아침 혈압을 재고, 약 드실 시간이에요.",
          channelId: CH,
          schedule: { on: hm(s.morning), allowWhileIdle: true },
        },
        {
          id: IDS.evening,
          title: "저녁 혈압 측정",
          body: "저녁 혈압을 재고, 약 챙기셨는지 확인하세요.",
          channelId: CH,
          schedule: { on: hm(s.evening), allowWhileIdle: true },
        },
      ],
    });
    persist(s);
    return "";
  } catch (e) {
    return `알림을 예약하지 못했어요. (${e instanceof Error ? e.message : String(e)})`;
  }
}

/** 앱을 열 때 저장된 설정대로 다시 예약(기기 재부팅·앱 업데이트 대비) */
export function syncRemind() {
  const s = loadRemind();
  if (s.on && plugin()) void applyRemind(s);
}
