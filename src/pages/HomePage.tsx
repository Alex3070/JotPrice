import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useRecords } from "../hooks/useRecords";
import { useChannels } from "../hooks/useChannels";
import { useOcrConfig } from "../hooks/useOcrConfig";
import CaptureView from "../components/CaptureView";
import OcrTaskList, { type OcrTask } from "../components/OcrTaskList";
import RecordForm, { type FormInit } from "../components/RecordForm";
import { recognizePrice, type OcrResult } from "../lib/ocr";
import { useToast } from "../components/ui";
import type { OcrConfig } from "../types";

type View = "capture" | "form";

/** 同时进行的识别请求上限，避免连续上传把大模型打限流 */
const MAX_CONCURRENT = 2;

export default function HomePage() {
  const { add } = useRecords();
  const { channels, add: addChannel } = useChannels();
  const { config } = useOcrConfig();
  const toast = useToast();

  const [view, setView] = useState<View>("capture");
  const [formInit, setFormInit] = useState<FormInit | null>(null);
  const [tasks, setTasks] = useState<OcrTask[]>([]);

  // 后台识别队列：提交即返回，识别完成后回写任务状态
  const queueRef = useRef<{ taskId: string; file: File; cfg: OcrConfig }[]>([]);
  const runningRef = useRef(0);

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

  /** 依次启动队列里的任务（不超过并发上限） */
  function pump() {
    while (runningRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      runningRef.current++;
      runTask(item).finally(() => {
        runningRef.current--;
        pump();
      });
    }
  }

  async function runTask(item: {
    taskId: string;
    file: File;
    cfg: OcrConfig;
  }) {
    try {
      const result = await recognizePrice(item.file, item.cfg);
      setTasks((ts) =>
        ts.map((t) =>
          t.id === item.taskId ? { ...t, status: "done", result } : t
        )
      );
    } catch (err) {
      console.error(err);
      setTasks((ts) =>
        ts.map((t) =>
          t.id === item.taskId
            ? {
                ...t,
                status: "error",
                error: err instanceof Error ? err.message : "识别失败",
              }
            : t
        )
      );
    }
  }

  function enqueueTask(file: File, cfg: OcrConfig) {
    const task: OcrTask = {
      id: crypto.randomUUID(),
      photoUrl: URL.createObjectURL(file),
      file,
      status: "processing",
      createdAt: Date.now(),
    };
    setTasks((ts) => [task, ...ts]);
    queueRef.current.push({ taskId: task.id, file, cfg });
    pump();
  }

  function handleFile(file: File) {
    if (!ocrReady || !config) {
      toast("OCR 未配置，可在「管理-拍照设置」中填写接口", "info");
      return;
    }
    enqueueTask(file, config);
    toast("已加入识别队列，可继续拍摄", "success");
  }

  /** 点击识别完成的卡片，进入表单核对 */
  function openResult(result: OcrResult) {
    setFormInit(buildInit(result));
    setView("form");
    toast("识别完成，请核对后保存", "success");
  }

  function retryTask(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task || !config) return;
    setTasks((ts) =>
      ts.map((t) =>
        t.id === id
          ? { ...t, status: "processing", error: undefined, result: undefined }
          : t
      )
    );
    queueRef.current.push({ taskId: id, file: task.file, cfg: config });
    pump();
  }

  function removeTask(id: string) {
    setTasks((ts) => {
      const task = ts.find((t) => t.id === id);
      if (task) URL.revokeObjectURL(task.photoUrl);
      return ts.filter((t) => t.id !== id);
    });
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
        <>
          <CaptureView ocrReady={ocrReady} onFile={handleFile} />
          <OcrTaskList
            tasks={tasks}
            onOpen={openResult}
            onRetry={retryTask}
            onRemove={removeTask}
          />
        </>
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
