import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "../components/ui";
import type { OcrTask } from "../components/OcrTaskList";
import { useOcrConfig } from "./useOcrConfig";
import { recognizePrice } from "../lib/ocr";
import type { OcrConfig } from "../types";

/** 同时进行的识别请求上限，避免连续上传把大模型打限流 */
const MAX_CONCURRENT = 2;

interface QueuedItem {
  taskId: string;
  file: File;
  cfg: OcrConfig;
}

interface OcrQueueValue {
  tasks: OcrTask[];
  /** 提交一张图片进入识别队列（立即返回，后台识别） */
  enqueue: (file: File) => void;
  /** 重试识别失败的任务 */
  retry: (id: string) => void;
  /** 清除指定任务（保存到记录后调用） */
  clearTask: (id: string) => void;
  /** 当前表单对应的任务：保存到记录后清除该任务 */
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
}

const OcrQueueContext = createContext<OcrQueueValue | null>(null);

/**
 * 识别任务队列：常驻在 App 顶层，跨路由切换不丢失。
 * 提交即返回，任务在后台识别，完成后回写状态；
 * 切换到「记录」等页面再切回来，任务列表仍在。
 */
export function OcrQueueProvider({ children }: { children: ReactNode }) {
  const { config } = useOcrConfig();
  const toast = useToast();

  const [tasks, setTasks] = useState<OcrTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const queueRef = useRef<QueuedItem[]>([]);
  const runningRef = useRef(0);

  async function runTask(item: QueuedItem) {
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

  function enqueue(file: File) {
    if (!config?.enabled) {
      toast("OCR 未配置，可在「管理-拍照设置」中填写接口", "info");
      return;
    }
    const task: OcrTask = {
      id: crypto.randomUUID(),
      photoUrl: URL.createObjectURL(file),
      file,
      status: "processing",
      createdAt: Date.now(),
    };
    setTasks((ts) => [task, ...ts]);
    queueRef.current.push({ taskId: task.id, file, cfg: config });
    pump();
    toast("已加入识别队列，可继续拍摄", "success");
  }

  function retry(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task || !config?.enabled) return;
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

  function clearTask(id: string) {
    setTasks((ts) => {
      const task = ts.find((t) => t.id === id);
      if (task) URL.revokeObjectURL(task.photoUrl);
      return ts.filter((t) => t.id !== id);
    });
  }

  return (
    <OcrQueueContext.Provider
      value={{
        tasks,
        enqueue,
        retry,
        clearTask,
        activeTaskId,
        setActiveTaskId,
      }}
    >
      {children}
    </OcrQueueContext.Provider>
  );
}

export function useOcrQueue() {
  const ctx = useContext(OcrQueueContext);
  if (!ctx) {
    throw new Error("useOcrQueue 必须在 OcrQueueProvider 内使用");
  }
  return ctx;
}
