import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, MapPin, Plus } from "lucide-react";
import type { Channel, PriceRecord, Unit } from "../types";
import {
  UNIT_OPTIONS,
  unitLabel,
  normalizeToJin,
  specPriceToJin,
  weightLabel,
} from "../lib/units";
import { todayISO } from "../lib/format";
import { loadLastChoices, saveLastChoices } from "../lib/lastChoices";
import {
  getAllChannels,
  isOfflineChannel,
  OFFLINE_CHANNEL_ID,
} from "../lib/channels";
import { useToast } from "./ui";
import MapPicker from "./MapPicker";

/** 自动识别后回填到表单的初始值 */
export interface FormInit {
  name?: string;
  price?: number;
  unit?: Unit;
  spec?: { price: number; weight: number; unit: Unit };
  channelId?: string;
  /** 购买地点（菜市场/街道等），可定位或手动填写 */
  location?: string;
  /** 定位纬度 */
  lat?: number;
  /** 定位经度 */
  lng?: number;
  /** 来自 OCR 识别时为 true，用于区分“识别结果”与“手动填写”标题 */
  auto?: boolean;
}

interface Props {
  channels: Channel[];
  initial?: FormInit | null;
  onSubmit: (rec: Omit<PriceRecord, "id" | "createdAt">) => Promise<void>;
  onAddChannel?: (name: string) => Promise<Channel>;
  /** 高德地图 Web 端(JS API) Key，用于“选择地点”地图选点 */
  amapKey?: string;
  /** 高德地图安全密钥（v2.0 安全机制，选填） */
  amapSecurityCode?: string;
  onBack?: () => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function SelectWrap({
  value,
  onChange,
  options,
  placeholder,
  showEmpty = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  showEmpty?: boolean;
}) {
  return (
    <select
      className="input-base flex-1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {showEmpty && <option value="">{placeholder ?? "请选择"}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function RecordForm({
  channels,
  initial,
  onSubmit,
  onAddChannel,
  amapKey,
  amapSecurityCode,
  onBack,
}: Props) {
  const toast = useToast();

  const [name, setName] = useState(initial?.name ?? "");
  const [mode, setMode] = useState<"unit" | "spec">(
    initial?.spec ? "spec" : "unit"
  );
  const [price, setPrice] = useState(
    initial?.price != null ? String(initial.price) : ""
  );
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? "jin");
  const [specPrice, setSpecPrice] = useState(
    initial?.spec ? String(initial.spec.price) : ""
  );
  const [specWeight, setSpecWeight] = useState(
    initial?.spec ? String(initial.spec.weight) : ""
  );
  const [specUnit, setSpecUnit] = useState<Unit>(initial?.spec?.unit ?? "jin");
  // 全部渠道 = 内置平台 + 自定义渠道
  const allChannels = getAllChannels(channels);
  // 记忆上次选择的渠道与地点，打开表单时自动带入（initial 优先级最高）
  const [last] = useState(() => loadLastChoices());
  const [channelId, setChannelId] = useState(() => {
    const init = initial?.channelId;
    if (init && allChannels.some((c) => c.id === init)) return init;
    if (last?.channelId && allChannels.some((c) => c.id === last.channelId))
      return last.channelId;
    // 默认选中「线下购买」
    return OFFLINE_CHANNEL_ID;
  });
  // 仅当初始渠道为线下（线下购买或自定义渠道）时，才带出上一次的地点；线上平台不带出
  const offlineByDefault = isOfflineChannel(channelId);
  const [location, setLocation] = useState(
    offlineByDefault ? initial?.location ?? last?.location ?? "" : ""
  );
  const [lat, setLat] = useState<number | undefined>(
    offlineByDefault ? initial?.lat ?? last?.lat : undefined
  );
  const [lng, setLng] = useState<number | undefined>(
    offlineByDefault ? initial?.lng ?? last?.lng : undefined
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  // 内联新增渠道
  const [addingChan, setAddingChan] = useState(false);
  const [newChanName, setNewChanName] = useState("");

  async function confirmAddChan() {
    const n = newChanName.trim();
    if (!n) return toast("请输入渠道名", "error");
    try {
      const ch = await onAddChannel?.(n);
      if (ch) {
        setChannelId(ch.id);
        saveLastChoices({ channelId: ch.id });
      }
      setAddingChan(false);
      setNewChanName("");
    } catch {
      toast("新增渠道失败", "error");
    }
  }

  // 选择渠道：自动记住，供下次自动带入
  function handleChannelChange(id: string) {
    setChannelId(id);
    if (id) saveLastChoices({ channelId: id });
  }

  // 输入/修改地点：自动保存新地点；手动改文本后坐标不再匹配，一并清空
  function handleLocationChange(v: string) {
    setLocation(v);
    setLat(undefined);
    setLng(undefined);
    const t = v.trim();
    if (t) saveLastChoices({ location: t });
  }

  // 打开地图选点页；未配置高德 Key 时提示去配置
  function handleOpenPicker() {
    if (!amapKey?.trim()) {
      toast(
        "请先申请高德地图 Web 端(JS API) Key，并填入 public/ocr.config.json 的 amapKey",
        "error"
      );
      return;
    }
    setPickerOpen(true);
  }

  // 地图选点确认后回填并自动保存
  function handleConfirmPlace(p: { lat: number; lng: number; location: string }) {
    setLocation(p.location);
    setLat(p.lat);
    setLng(p.lng);
    setPickerOpen(false);
    saveLastChoices({ location: p.location, lat: p.lat, lng: p.lng });
  }

  // 实时折算每斤价格
  function perJinPreview(): number | null {
    if (mode === "unit") {
      const p = parseFloat(price);
      if (!isFinite(p) || p <= 0) return null;
      return normalizeToJin(p, unit);
    }
    const tp = parseFloat(specPrice);
    const w = parseFloat(specWeight);
    if (!isFinite(tp) || tp <= 0 || !isFinite(w) || w <= 0) return null;
    return specPriceToJin(tp, w, specUnit);
  }

  async function handleSubmit() {
    if (!name.trim()) return toast("请填写商品名", "error");

    // 仅线下购买才记录地点，线上平台不记录
    const offline = isOfflineChannel(channelId);
    let pricePerJin: number;
    let data: Omit<PriceRecord, "id" | "createdAt">;

    if (mode === "spec") {
      const tp = parseFloat(specPrice);
      const w = parseFloat(specWeight);
      if (!isFinite(tp) || tp <= 0) return toast("请填写有效总价", "error");
      if (!isFinite(w) || w <= 0) return toast("请填写有效重量", "error");
      pricePerJin = specPriceToJin(tp, w, specUnit);
      data = {
        name: name.trim(),
        price: tp,
        unit: specUnit,
        pricePerJin,
        channelId,
        location: offline ? location.trim() || undefined : undefined,
        lat: offline ? lat ?? undefined : undefined,
        lng: offline ? lng ?? undefined : undefined,
        date,
        note: note.trim() || undefined,
        spec: { price: tp, weight: w, unit: specUnit },
      };
    } else {
      const p = parseFloat(price);
      if (!isFinite(p) || p <= 0) return toast("请填写有效单价", "error");
      pricePerJin = normalizeToJin(p, unit);
      data = {
        name: name.trim(),
        price: p,
        unit,
        pricePerJin,
        channelId,
        location: offline ? location.trim() || undefined : undefined,
        lat: offline ? lat ?? undefined : undefined,
        lng: offline ? lng ?? undefined : undefined,
        date,
        note: note.trim() || undefined,
      };
    }

    await onSubmit(data);
    // 兜底：保存记录时同步记住本次渠道与地点
    saveLastChoices({
      channelId: data.channelId || undefined,
      location: data.location,
      lat: data.lat,
      lng: data.lng,
    });
    toast("已记录 🎉", "success");
    onBack?.();
  }

  return (
    <div className="glass-card space-y-4 p-4 animate-fade-in-up">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="btn-ghost shrink-0 px-2"
            title="返回拍照"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h2 className="text-base font-bold text-ink">
          {initial?.auto ? "识别结果，核对后保存" : "手动填写"}
        </h2>
      </div>

      <Field label="商品名">
        <input
          className="input-base"
          placeholder="如 五花肉"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label="购买渠道">
        <div className="flex gap-2">
          <SelectWrap
            value={channelId}
            onChange={handleChannelChange}
            options={allChannels.map((c) => ({ value: c.id, label: c.name }))}
            showEmpty={false}
          />
          <button
            type="button"
            onClick={() => setAddingChan(true)}
            className="btn-ghost shrink-0 px-3"
            title="新增渠道"
          >
            <Plus size={16} />
          </button>
        </div>
        {addingChan && (
          <div className="mt-2 flex gap-2">
            <input
              className="input-base flex-1"
              placeholder="输入新渠道名"
              value={newChanName}
              onChange={(e) => setNewChanName(e.target.value)}
            />
            <button
              type="button"
              onClick={confirmAddChan}
              className="btn-primary shrink-0 px-3"
            >
              <Check size={16} />
            </button>
          </div>
        )}
      </Field>

      {/* 仅「线下购买」才显示购买地点；线上平台不显示 */}
      {isOfflineChannel(channelId) && (
        <>
          <Field label="购买地点">
            <div className="flex gap-2">
              <input
                className="input-base flex-1"
                placeholder="选择地点或手动填写，如 三里屯菜市场"
                value={location}
                onChange={(e) => handleLocationChange(e.target.value)}
              />
              <button
                type="button"
                onClick={handleOpenPicker}
                className="btn-ghost shrink-0 px-3"
                title="在地图上选择地点"
              >
                <MapPin size={16} className="text-brand-orange" />
              </button>
            </div>
            {(lat != null || lng != null) && (
              <span className="text-[11px] text-muted">
                坐标 {lat?.toFixed(5)}, {lng?.toFixed(5)}
              </span>
            )}
          </Field>

          {pickerOpen && (
            <MapPicker
              amapKey={amapKey!}
              amapSecurityCode={amapSecurityCode}
              initialLat={lat}
              initialLng={lng}
              onConfirm={handleConfirmPlace}
              onCancel={() => setPickerOpen(false)}
            />
          )}
        </>
      )}

      {/* 录入方式切换 */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-orange-50 p-1">
        <button
          type="button"
          onClick={() => setMode("unit")}
          className={`rounded-xl py-2 text-sm font-medium transition ${
            mode === "unit"
              ? "bg-white text-brand-orange shadow-card"
              : "text-muted"
          }`}
        >
          按单价
        </button>
        <button
          type="button"
          onClick={() => setMode("spec")}
          className={`rounded-xl py-2 text-sm font-medium transition ${
            mode === "spec"
              ? "bg-white text-brand-orange shadow-card"
              : "text-muted"
          }`}
        >
          按规格（总价+重量）
        </button>
      </div>

      {mode === "unit" ? (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="单价">
            <input
              className="input-base"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field label="计价单位">
            <SelectWrap
              value={unit}
              onChange={(v) => setUnit(v as Unit)}
              options={UNIT_OPTIONS}
              showEmpty={false}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="总价（元）">
            <input
              className="input-base"
              type="number"
              inputMode="decimal"
              placeholder="如 22.9"
              value={specPrice}
              onChange={(e) => setSpecPrice(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="总重量">
              <input
                className="input-base"
                type="number"
                inputMode="decimal"
                placeholder="如 700"
                value={specWeight}
                onChange={(e) => setSpecWeight(e.target.value)}
              />
            </Field>
            <Field label="重量单位">
              <SelectWrap
                value={specUnit}
                onChange={(v) => setSpecUnit(v as Unit)}
                options={[
                  { value: "g", label: "g" },
                  { value: "kg", label: "kg" },
                  { value: "jin", label: "斤" },
                ]}
                showEmpty={false}
              />
            </Field>
          </div>
        </div>
      )}

      {perJinPreview() != null && (
        <div className="rounded-2xl bg-brand-green/10 px-4 py-3 text-sm text-ink">
          折算
          <span className="font-semibold text-brand-green">
            ¥{perJinPreview()!.toFixed(2)}
          </span>
          /斤
          <span className="text-muted">
            {mode === "unit"
              ? `（原始 ${unitLabel(unit)}）`
              : `（${specPrice} 元 / ${specWeight}${weightLabel(specUnit)}）`}
          </span>
        </div>
      )}

      <Field label="日期">
        <input
          className="input-base"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Field label="备注（可选）">
        <input
          className="input-base"
          placeholder="如 很新鲜"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <button type="button" onClick={handleSubmit} className="btn-primary w-full">
        保存记录
      </button>
    </div>
  );
}
