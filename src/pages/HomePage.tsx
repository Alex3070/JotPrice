import { useState } from "react";
import { Pencil } from "lucide-react";
import { useRecords } from "../hooks/useRecords";
import { useChannels } from "../hooks/useChannels";
import { useOcrConfig } from "../hooks/useOcrConfig";
import { useOcrQueue } from "../hooks/useOcrQueue";
import CaptureView from "../components/CaptureView";
import OcrTaskList, { type OcrTask } from "../components/OcrTaskList";
import RecordForm, { type FormInit } from "../components/RecordForm";
import { useToast } from "../components/ui";
import type { OcrResult } from "../lib/ocr";

type View = "capture" | "form";

export default function HomePage() {
  const { add } = useRecords();
  const { channels, add: addChannel } = useChannels();
  const { config } = useOcrConfig();
  const toast = useToast();
  const {
    tasks,
    enqueue,
    retry,
    clearTask,
    activeTaskId,
    setActiveTaskId,
  } = useOcrQueue();

  const [view, setView] = useState<View>("capture");
  const [formInit, setFormInit] = useState<FormInit | null>(null);

  const ocrReady =
    !!config?.enabled &&
    (!!config?.workerUrl || (!!config?.endpoint && !!config?.apiKey));

  /** 由识别结果构造表单初始化值 */
  function buildInit(result: OcrResult): FormInit {
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
    return init;
  }

  function handleFile(file: File) {
    if (!ocrReady) {
      toast("OCR 未配置，可在「管理-拍照设置」中填写接口", "info");
      return;
    }
    enqueue(file);
  }

  /** 点击识别完成的卡片，进入表单核对（保存成功后才清除任务） */
  function openResult(task: OcrTask) {
    if (!task.result) return;
    setActiveTaskId(task.id);
    setFormInit(buildInit(task.result));
    setView("form");
    toast("识别完成，请核对后保存", "success");
  }

  function openManual() {
    // 渠道与地点由 RecordForm 自动带入上次的选择
    setActiveTaskId(null);
    setFormInit({});
    setView("form");
  }

  async function handleSubmit(
    rec: Parameters<typeof add>[0]
  ): Promise<void> {
    await add(rec);
    // 只有真正保存到记录，才清除对应的识别任务
    if (activeTaskId) {
      clearTask(activeTaskId);
      setActiveTaskId(null);
    }
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
        <>
          <CaptureView ocrReady={ocrReady} onFile={handleFile} />
          <OcrTaskList tasks={tasks} onOpen={openResult} onRetry={retry} />
        </>
      ) : (
        <RecordForm
          channels={channels}
          initial={formInit}
          onSubmit={handleSubmit}
          onAddChannel={addChannel}
          amapKey={config?.amapKey}
          amapSecurityCode={config?.amapSecurityCode}
          onBack={() => {
            // 未保存直接返回：任务保留在列表，仅解除与当前表单的关联
            setActiveTaskId(null);
            setView("capture");
          }}
        />
      )}
    </div>
  );
}
