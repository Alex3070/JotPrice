import { useState } from "react";
import { Pencil } from "lucide-react";
import { useRecords } from "../hooks/useRecords";
import { useChannels } from "../hooks/useChannels";
import { useOcrConfig } from "../hooks/useOcrConfig";
import CaptureView from "../components/CaptureView";
import RecordForm, { type FormInit } from "../components/RecordForm";
import { recognizePrice } from "../lib/ocr";
import { useToast } from "../components/ui";

type View = "capture" | "form";

export default function HomePage() {
  const { add } = useRecords();
  const { channels, add: addChannel } = useChannels();
  const { config } = useOcrConfig();
  const toast = useToast();

  const [view, setView] = useState<View>("capture");
  const [formInit, setFormInit] = useState<FormInit | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const ocrReady =
    !!config?.enabled &&
    (!!config?.workerUrl || (!!config?.endpoint && !!config?.apiKey));

  async function handleFile(file: File) {
    if (ocrLoading) return;
    setPhoto(URL.createObjectURL(file));
    if (!ocrReady || !config) {
      toast("OCR 未配置，可在「管理-拍照设置」中填写接口", "info");
      return;
    }
    setOcrLoading(true);
    try {
      const result = await recognizePrice(file, config);
      const init: FormInit = {
        auto: true,
        name: result.name,
        // 渠道与地点由 RecordForm 自动带入上次的选择
      };

      // 自动计算单价：按规格（总价+重量）优先，否则按单价
      if (
        result.price != null &&
        result.price > 0 &&
        result.weight != null &&
        result.weight > 0
      ) {
        init.spec = {
          price: result.price,
          weight: result.weight,
          unit: result.weightUnit ?? result.unit ?? "g",
        };
      } else if (result.price != null && result.price > 0) {
        init.price = result.price;
        if (result.unit) init.unit = result.unit;
      }

      setFormInit(init);
      setView("form");
      toast("已识别，请核对后保存", "success");
    } catch (err) {
      console.error(err);
      toast(
        `识别失败：${err instanceof Error ? err.message : "请手动填写"}`,
        "error"
      );
    } finally {
      setOcrLoading(false);
    }
  }

  function openManual() {
    // 渠道与地点由 RecordForm 自动带入上次的选择
    setFormInit({});
    setView("form");
  }

  async function handleSubmit(
    rec: Parameters<typeof add>[0]
  ): Promise<void> {
    await add(rec);
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6">
      <header className="mb-5 flex items-start justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-ink">记一笔买菜价</h1>
          <p className="mt-1 text-sm text-muted">拍照识别，自动换算每斤</p>
        </div>
        {view === "capture" && (
          <button onClick={openManual} className="btn-ghost shrink-0 text-sm">
            <Pencil size={15} className="mr-1 inline" />
            手动填写
          </button>
        )}
      </header>

      {view === "capture" ? (
        <CaptureView
          ocrReady={ocrReady}
          loading={ocrLoading}
          photo={photo}
          onFile={handleFile}
          onClearPhoto={() => setPhoto(null)}
        />
      ) : (
        <RecordForm
          channels={channels}
          initial={formInit}
          onSubmit={handleSubmit}
          onAddChannel={addChannel}
          amapKey={config?.amapKey}
          amapSecurityCode={config?.amapSecurityCode}
          onBack={() => setView("capture")}
        />
      )}
    </div>
  );
}
