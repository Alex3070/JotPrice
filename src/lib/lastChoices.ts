/** 上次选择的购买渠道与购买地点记忆（localStorage 持久化） */
export interface LastChoices {
  channelId?: string;
  location?: string;
  lat?: number;
  lng?: number;
  updatedAt: number;
}

const KEY = "maicai.last-choices.v1";

export function loadLastChoices(): LastChoices | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    return data as LastChoices;
  } catch {
    return null;
  }
}

/** 合并保存记忆；只传部分字段时保留其余字段 */
export function saveLastChoices(partial: Partial<LastChoices>): void {
  try {
    const prev = loadLastChoices() ?? ({} as LastChoices);
    const next: LastChoices = { ...prev, ...partial, updatedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage 不可用时静默失败，不影响记录功能
  }
}
