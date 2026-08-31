import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Channel, PriceRecord } from "../types";
import { uid } from "../lib/format";

interface MaicaiDB extends DBSchema {
  records: {
    key: string;
    value: PriceRecord;
    indexes: { byDate: string };
  };
  channels: { key: string; value: Channel };
  settings: { key: string; value: unknown };
}

const DB_NAME = "maicai-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MaicaiDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MaicaiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const records = db.createObjectStore("records", { keyPath: "id" });
        records.createIndex("byDate", "date");
        db.createObjectStore("channels", { keyPath: "id" });
        db.createObjectStore("settings");
      },
    });
  }
  return dbPromise;
}

// 清理历史遗留的预设渠道（custom: false），让用户从空白开始
async function removePresets() {
  const db = await getDB();
  const chs = await db.getAll("channels");
  const tx = db.transaction(["channels"], "readwrite");
  await Promise.all(
    chs
      .filter((c) => !c.custom)
      .map((c) => tx.objectStore("channels").delete(c.id))
  );
  await tx.done;
}

export async function initDB() {
  await getDB();
  await removePresets();
}

/* ============ 云同步：待推送队列（outbox） ============ */

export interface SyncChange {
  op: "put" | "del";
  id: string;
  type: "record" | "channel";
  data?: unknown;
  /** 变更时间戳，用于服务端 Last-Write-Wins 比较 */
  t: number;
}

/** 云端变更项（GET /api/sync 返回的 items） */
export interface RemoteChange {
  id: string;
  type: "record" | "channel";
  data?: unknown;
  deleted: boolean;
  updatedAt: number;
}

const SETTINGS_KEY_HIDDEN_BUILTIN = "hiddenBuiltinChannels";
const SETTINGS_KEY_OUTBOX = "sync:outbox";

async function pushOutbox(item: SyncChange) {
  const db = await getDB();
  const prev = (await getSetting<SyncChange[]>(SETTINGS_KEY_OUTBOX)) ?? [];
  await setSetting(SETTINGS_KEY_OUTBOX, [...prev, item]);
}

export async function getOutbox(): Promise<SyncChange[]> {
  return (await getSetting<SyncChange[]>(SETTINGS_KEY_OUTBOX)) ?? [];
}

export async function clearOutbox(): Promise<void> {
  await setSetting(SETTINGS_KEY_OUTBOX, []);
}

/* ============ 通用 settings 读写 ============ */

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get("settings", key)) as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put("settings", value, key);
}

/* Records */
export async function getRecords(): Promise<PriceRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("records", "byDate");
  return all.reverse(); // 最新在前
}

export async function addRecord(
  rec: Omit<PriceRecord, "id" | "createdAt">
): Promise<PriceRecord> {
  const db = await getDB();
  const full: PriceRecord = { ...rec, id: uid(), createdAt: Date.now() };
  await db.put("records", full);
  await pushOutbox({
    op: "put",
    id: full.id,
    type: "record",
    data: full,
    t: full.createdAt,
  });
  return full;
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("records", id);
  await pushOutbox({ op: "del", id, type: "record", t: Date.now() });
}

/* Channels */
export async function getChannels(): Promise<Channel[]> {
  const db = await getDB();
  return db.getAll("channels");
}

export async function addChannel(name: string): Promise<Channel> {
  const db = await getDB();
  const all = await db.getAll("channels");
  const exist = all.find((c) => c.name === name);
  if (exist) return exist; // 同名复用，避免重复
  const ch: Channel = {
    id: uid(),
    name,
    custom: true,
    createdAt: Date.now(),
  };
  await db.put("channels", ch);
  await pushOutbox({ op: "put", id: ch.id, type: "channel", data: ch, t: ch.createdAt! });
  return ch;
}

export async function deleteChannel(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("channels", id);
  await pushOutbox({ op: "del", id, type: "channel", t: Date.now() });
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const [recs, chs] = await Promise.all([
    db.getAll("records"),
    db.getAll("channels"),
  ]);
  const now = Date.now();
  const outbox: SyncChange[] = [
    ...recs.map((r) => ({ op: "del" as const, id: r.id, type: "record" as const, t: now })),
    ...chs.map((c) => ({ op: "del" as const, id: c.id, type: "channel" as const, t: now })),
  ];
  const tx = db.transaction(["records", "channels", "settings"], "readwrite");
  // 清空数据并把旧 outbox 换成删除标记，云端随之清空
  await tx.objectStore("settings").put(outbox, SETTINGS_KEY_OUTBOX);
  await tx.objectStore("records").clear();
  await tx.objectStore("channels").clear();
  await tx.objectStore("settings").delete(SETTINGS_KEY_HIDDEN_BUILTIN);
  await tx.done;
}

/* ============ 云同步：应用云端变更到本地 ============ */

function getItemTimestamp(item: PriceRecord | Channel): number {
  if ("price" in item) return item.createdAt; // PriceRecord 必有 createdAt
  return item.createdAt ?? 0; // Channel 的 createdAt 可选
}

/**
 * 将云端拉取的变更合并到本地 IndexedDB。
 * 策略：云端标记删除的物理删除；云端更新的按 updatedAt 与本地比较，取较新者。
 */
export async function applyRemoteChanges(items: RemoteChange[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(["records", "channels"], "readwrite");

  for (const item of items) {
    if (item.type === "channel") {
      const store = tx.objectStore("channels");
      if (item.deleted) {
        await store.delete(item.id);
        continue;
      }
      if (!item.data) continue;
      const existing = await store.get(item.id);
      if (existing && (existing.createdAt ?? 0) > item.updatedAt) continue;
      await store.put(item.data as Channel);
    } else {
      const store = tx.objectStore("records");
      if (item.deleted) {
        await store.delete(item.id);
        continue;
      }
      if (!item.data) continue;
      const existing = await store.get(item.id);
      if (existing && existing.createdAt > item.updatedAt) continue;
      await store.put(item.data as PriceRecord);
    }
  }
  await tx.done;
}

/* Settings：被手动隐藏的内置渠道（删除内置渠道时写入，用于下拉过滤与恢复） */
export async function getHiddenBuiltinChannels(): Promise<string[]> {
  const db = await getDB();
  const v = await db.get("settings", SETTINGS_KEY_HIDDEN_BUILTIN);
  return Array.isArray(v) ? v : [];
}

export async function setHiddenBuiltinChannels(ids: string[]): Promise<void> {
  const db = await getDB();
  await db.put("settings", ids, SETTINGS_KEY_HIDDEN_BUILTIN);
}
