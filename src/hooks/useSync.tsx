import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getLastSyncAt,
  getSyncConfig,
  setSyncConfig,
  syncOnce,
  type SyncConfig,
} from "../db/sync";

interface SyncState {
  config: SyncConfig;
  /** 最近一次成功同步时间（毫秒），null 表示从未同步过 */
  lastSyncAt: number | null;
  syncing: boolean;
  error: string | null;
  saveConfig: (patch: Partial<SyncConfig>) => Promise<void>;
  syncNow: () => Promise<void>;
}

const SyncCtx = createContext<SyncState>({
  config: { url: "", auto: false },
  lastSyncAt: null,
  syncing: false,
  error: null,
  saveConfig: async () => {},
  syncNow: async () => {},
});

export function useSync() {
  return useContext(SyncCtx);
}

const AUTO_SYNC_INTERVAL = 60_000; // 自动同步间隔

export function SyncProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SyncConfig>({ url: "", auto: false });
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  // 初始化：读取本地配置与上次同步时间
  useEffect(() => {
    (async () => {
      const [c, t] = await Promise.all([getSyncConfig(), getLastSyncAt()]);
      setConfig(c);
      setLastSyncAt(t);
    })();
  }, []);

  const syncNow = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSyncing(true);
    setError(null);
    try {
      await syncOnce();
      setLastSyncAt(await getLastSyncAt());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
      busyRef.current = false;
    }
  }, []);

  const saveConfig = useCallback(async (patch: Partial<SyncConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      void setSyncConfig(next);
      return next;
    });
  }, []);

  // 自动同步：启动后执行一次，此后定时同步，回到前台/恢复联网时补一次
  useEffect(() => {
    if (!config.auto) return;
    void syncNow();
    const timer = setInterval(() => void syncNow(), AUTO_SYNC_INTERVAL);
    const onWake = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [config.auto, syncNow]);

  return (
    <SyncCtx.Provider
      value={{ config, lastSyncAt, syncing, error, saveConfig, syncNow }}
    >
      {children}
    </SyncCtx.Provider>
  );
}
