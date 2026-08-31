import { useEffect, useState } from "react";
import { Plus, Trash2, RotateCcw, Cloud, RefreshCw } from "lucide-react";
import { useChannels } from "../hooks/useChannels";
import { useSync } from "../hooks/useSync";
import { clearAllData } from "../db/database";
import { getVisibleBuiltinChannels, OFFLINE_CHANNEL_ID } from "../lib/channels";
import { useToast } from "../components/ui";

export default function ManagePage() {
  const toast = useToast();
  const {
    channels,
    hidden,
    add: addCh,
    remove: rmCh,
    hideBuiltin,
    restoreBuiltins,
  } = useChannels();

  const { config, lastSyncAt, syncing, error, saveConfig, syncNow } = useSync();

  const [newCh, setNewCh] = useState("");
  const [syncUrl, setSyncUrl] = useState("");
  const [syncToken, setSyncToken] = useState("");
  const visibleBuiltins = getVisibleBuiltinChannels(hidden);

  // 配置加载完成后回填输入框
  useEffect(() => {
    setSyncUrl(config.url);
    setSyncToken(config.token ?? "");
  }, [config.url, config.token]);

  async function handleClear() {
    if (!confirm("确定清空所有记录和渠道吗？此操作不可恢复。")) return;
    await clearAllData();
    toast("已清空", "info");
  }

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 pb-28 pt-6">
      <header className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-ink">管理</h1>
        <p className="mt-1 text-sm text-muted">渠道管理</p>
      </header>

      {/* 渠道管理 */}
      <Section title="购买渠道">
        <p className="mb-3 text-xs text-muted">
          内置常用平台（仅「线下购买」需要填写购买地点），可删除不常用的，也可添加自定义渠道：
        </p>
        <div className="flex flex-wrap gap-2">
          {visibleBuiltins.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-sm text-ink shadow-card"
            >
              {c.name}
              {c.id === OFFLINE_CHANNEL_ID ? (
                <span className="text-[10px] font-medium text-brand-orange">
                  必选
                </span>
              ) : (
                <span className="text-[10px] font-medium text-muted">内置</span>
              )}
              {c.id !== OFFLINE_CHANNEL_ID && (
                <button
                  onClick={() => {
                    hideBuiltin(c.id);
                    toast(`已删除「${c.name}」`, "info");
                  }}
                  className="ml-0.5 text-muted hover:text-red-500"
                  aria-label={`删除渠道 ${c.name}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </span>
          ))}
          {channels.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-orange/10 px-3 py-1.5 text-sm text-ink shadow-card"
            >
              {c.name}
              {c.custom && (
                <button
                  onClick={() => rmCh(c.id)}
                  className="ml-1 text-muted hover:text-red-500"
                  aria-label="删除渠道"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </span>
          ))}
          {hidden.length > 0 && (
            <button
              onClick={async () => {
                await restoreBuiltins();
                toast("已恢复全部内置渠道", "info");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-orange-200 px-3 py-1.5 text-xs text-brand-orange"
            >
              <RotateCcw size={12} />
              恢复已删除的内置渠道（{hidden.length}）
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input-base"
            placeholder="新增渠道，如：钱大妈"
            value={newCh}
            onChange={(e) => setNewCh(e.target.value)}
          />
          <button
            className="btn-ghost shrink-0"
            onClick={async () => {
              if (!newCh.trim()) return;
              await addCh(newCh.trim());
              setNewCh("");
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      </Section>

      {/* 云同步 */}
      <Section title="云同步">
        <p className="mb-3 text-xs text-muted">
          将记录与渠道同步到云端 D1 数据库，多设备共享数据。地址留空时使用同域
          <code className="mx-1 rounded bg-black/5 px-1">/api/sync</code>。
        </p>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-ink">自动同步</span>
          <button
            onClick={() => saveConfig({ auto: !config.auto })}
            className={`relative h-6 w-11 rounded-full transition ${
              config.auto ? "bg-brand-orange" : "bg-muted/40"
            }`}
            aria-label="自动同步开关"
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                config.auto ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        <label className="mb-1 block text-xs text-muted">同步接口地址</label>
        <input
          className="input-base mb-3"
          placeholder="https://your-site.pages.dev/api/sync"
          value={syncUrl}
          onChange={(e) => setSyncUrl(e.target.value)}
        />

        <label className="mb-1 block text-xs text-muted">
          访问口令（可选，与服务端 ACCESS_TOKEN 一致）
        </label>
        <input
          className="input-base mb-3"
          type="password"
          placeholder="留空则使用 VITE_ACCESS_TOKEN"
          value={syncToken}
          onChange={(e) => setSyncToken(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            className="btn-ghost flex-1"
            onClick={async () => {
              await saveConfig({ url: syncUrl.trim(), token: syncToken.trim() });
              toast("同步设置已保存", "success");
            }}
          >
            <Cloud size={16} />
            保存设置
          </button>
          <button
            className="btn-ghost flex-1"
            disabled={syncing}
            onClick={() => void syncNow()}
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "同步中" : "立即同步"}
          </button>
        </div>

        <div className="mt-3 space-y-1 text-xs">
          {syncing && <p className="text-muted">正在同步…</p>}
          {!syncing && error && <p className="text-red-500">{error}</p>}
          {!syncing && !error && lastSyncAt && (
            <p className="text-muted">
              上次同步：{new Date(lastSyncAt).toLocaleString()}
            </p>
          )}
          {!syncing && !error && !lastSyncAt && (
            <p className="text-muted">尚未同步过</p>
          )}
        </div>
      </Section>

      <button
        onClick={handleClear}
        className="w-full rounded-2xl border border-red-100 bg-white/60 py-3 text-sm font-medium text-red-500 transition active:scale-[0.98]"
      >
        清空所有数据
      </button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card p-5 animate-fade-in-up">
      <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

