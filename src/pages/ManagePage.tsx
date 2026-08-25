import { useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { useChannels } from "../hooks/useChannels";
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

  const [newCh, setNewCh] = useState("");
  const visibleBuiltins = getVisibleBuiltinChannels(hidden);

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

