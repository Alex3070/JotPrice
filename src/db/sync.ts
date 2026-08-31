import {
  applyRemoteChanges,
  clearOutbox,
  getChannels,
  getOutbox,
  getRecords,
  getSetting,
  setSetting,
  type RemoteChange,
} from "./database";

/** 云同步配置（存于 IndexedDB settings） */
export interface SyncConfig {
  /** 是否自动同步（启动 + 每 60 秒 + 回到前台时） */
  auto: boolean;
}

const KEY_CONFIG = "sync:config";
const KEY_LAST_PULL = "sync:lastPulledAt";
const KEY_LAST_SYNC = "sync:lastSyncAt";
/** 历史数据基线是否已补传（云同步上线前就在本地的数据没有 outbox 记录） */
const KEY_BASELINE_DONE = "sync:baselineDone";

/** 同步接口固定使用同域相对路径（与站点同源部署） */
const SYNC_URL = "/api/sync";

export async function getSyncConfig(): Promise<SyncConfig> {
  return (await getSetting<SyncConfig>(KEY_CONFIG)) ?? { auto: false };
}

export async function setSyncConfig(cfg: SyncConfig): Promise<void> {
  await setSetting(KEY_CONFIG, cfg);
}

/** 最近一次成功同步的时间（毫秒），用于界面展示 */
export async function getLastSyncAt(): Promise<number | null> {
  return (await getSetting<number>(KEY_LAST_SYNC)) ?? null;
}

async function getLastPulledAt(): Promise<number> {
  return (await getSetting<number>(KEY_LAST_PULL)) ?? 0;
}

/**
 * 执行一次完整同步：先拉取云端增量应用到本地，再把本地待推送变更推上云端。
 * 冲突策略为 Last-Write-Wins（按 updatedAt 比较）。
 */
export async function syncOnce(): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = (import.meta.env.VITE_ACCESS_TOKEN as string | undefined) || "";
  if (token) headers["x-access-token"] = token;

  const since = await getLastPulledAt();

  // 1. 拉取增量
  const res = await fetch(`${SYNC_URL}?since=${since}`, { headers });
  if (!res.ok) {
    throw new Error(`同步拉取失败：HTTP ${res.status}`);
  }
  const pull = (await res.json()) as {
    serverTime: number;
    items: RemoteChange[];
  };

  // 2. 合并到本地
  await applyRemoteChanges(pull.items);

  // 3. 推送本地变更
  const outbox = await getOutbox();
  const items = outbox.map((c) => ({
    id: c.id,
    type: c.type,
    data: c.data,
    deleted: c.op === "del",
    updatedAt: c.t,
  }));

  // 历史数据基线：云同步功能上线前已在本地存在的数据没有 outbox 记录，
  // 首次同步（基线未完成）时全量补传一次；服务端 LWW 会自动跳过云端更新版本
  const baselineDone = (await getSetting<boolean>(KEY_BASELINE_DONE)) ?? false;
  if (!baselineDone) {
    const [records, channels] = await Promise.all([getRecords(), getChannels()]);
    // 基线时间戳必须用「推送时刻」：若沿用记录的创建时间，其他已同步过的设备
    // 游标已推进，会因 updated_at 过旧而永远拉取不到这批数据
    const baselineAt = Date.now();
    const pushed = new Set(items.map((i) => `${i.type}:${i.id}`));
    for (const r of records) {
      if (!pushed.has(`record:${r.id}`)) {
        items.push({ id: r.id, type: "record", data: r, deleted: false, updatedAt: baselineAt });
      }
    }
    for (const c of channels) {
      if (!pushed.has(`channel:${c.id}`)) {
        items.push({ id: c.id, type: "channel", data: c, deleted: false, updatedAt: baselineAt });
      }
    }
  }

  if (items.length > 0) {
    const pushRes = await fetch(SYNC_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ items }),
    });
    if (!pushRes.ok) {
      const detail = await pushRes.text().catch(() => "");
      throw new Error(
        `同步推送失败：HTTP ${pushRes.status}${detail ? ` | ${detail.slice(0, 150)}` : ""}`
      );
    }
    await clearOutbox();
  }

  // 4. 推进拉取游标与最近同步时间；推送成功才标记基线完成，失败则下次重试
  await setSetting(KEY_BASELINE_DONE, true);
  await setSetting(KEY_LAST_PULL, pull.serverTime);
  await setSetting(KEY_LAST_SYNC, Date.now());
}
