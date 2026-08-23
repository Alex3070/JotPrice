import { useMemo, useState } from "react";
import { MapPin, Search, Trash2 } from "lucide-react";
import { useRecords } from "../hooks/useRecords";
import { useChannels } from "../hooks/useChannels";
import { getAllChannels, isOfflineChannel } from "../lib/channels";
import { formatDate, formatPrice } from "../lib/format";
import { unitLabel, weightLabel } from "../lib/units";
import { useToast } from "../components/ui";

export default function ListPage() {
  const { records, loading, remove } = useRecords();
  const { channels } = useChannels();
  const toast = useToast();

  const [keyword, setKeyword] = useState("");
  const [chId, setChId] = useState("");

  const allChannels = getAllChannels(channels);

  const chMap = useMemo(
    () => Object.fromEntries(getAllChannels(channels).map((c) => [c.id, c])),
    [channels]
  );

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (keyword && !r.name.includes(keyword)) return false;
        if (chId && r.channelId !== chId) return false;
        return true;
      }),
    [records, keyword, chId]
  );

  async function handleDelete(id: string) {
    await remove(id);
    toast("已删除", "info");
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6">
      <header className="mb-4 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-ink">价格记录</h1>
        <p className="mt-1 text-sm text-muted">
          共 {records.length} 条 · 筛选出 {filtered.length} 条
        </p>
      </header>

      <div className="glass-card mb-4 space-y-3 p-4">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            className="input-base pl-10"
            placeholder="搜索商品名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <select
          className="input-base appearance-none"
          value={chId}
          onChange={(e) => setChId(e.target.value)}
        >
          <option value="">全部渠道</option>
          {allChannels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted">加载中…</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-muted">暂无记录，去「记一笔」添加吧</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const ch = chMap[r.channelId];
            return (
              <li
                key={r.id}
                className="glass-card flex items-center justify-between p-4 animate-fade-in-up"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{r.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {ch?.name} · {formatDate(r.date)}
                  </div>
                  {r.location && isOfflineChannel(r.channelId) && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      <MapPin size={12} className="shrink-0 text-brand-orange" />
                      <span className="truncate">{r.location}</span>
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-muted">
                    {r.spec ? (
                      <>
                        规格 ¥{formatPrice(r.spec.price)} / {r.spec.weight}
                        {weightLabel(r.spec.unit)}
                      </>
                    ) : (
                      <>
                        原价 ¥{formatPrice(r.price)} {unitLabel(r.unit)}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-brand-orange">
                      ¥{formatPrice(r.pricePerJin)}
                    </div>
                    <div className="text-xs text-muted">每斤</div>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-full p-2 text-muted transition active:scale-90 hover:text-red-500"
                    aria-label="删除"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
