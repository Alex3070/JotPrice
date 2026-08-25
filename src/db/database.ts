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
  return full;
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("records", id);
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
  const ch: Channel = { id: uid(), name, custom: true };
  await db.put("channels", ch);
  return ch;
}

export async function deleteChannel(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("channels", id);
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear("records"),
    db.clear("channels"),
    db.clear("settings"),
  ]);
}

/* Settings：被手动隐藏的内置渠道（删除内置渠道时写入，用于下拉过滤与恢复） */
const SETTINGS_KEY_HIDDEN_BUILTIN = "hiddenBuiltinChannels";

export async function getHiddenBuiltinChannels(): Promise<string[]> {
  const db = await getDB();
  const v = await db.get("settings", SETTINGS_KEY_HIDDEN_BUILTIN);
  return Array.isArray(v) ? v : [];
}

export async function setHiddenBuiltinChannels(ids: string[]): Promise<void> {
  const db = await getDB();
  await db.put("settings", ids, SETTINGS_KEY_HIDDEN_BUILTIN);
}
