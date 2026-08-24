import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { OcrResult } from "../lib/ocr";

export interface OcrTask {
  id: string;
  /** 原图本地预览地址 */
  photoUrl: string;
  /** 原始文件，重试时复用 */
  file: File;
  status: "processing" | "done" | "error";
  result?: OcrResult;
  error?: string;
  createdAt: number;
}

const UNIT_LABEL: Record<string, string> = {
  jin: "元/斤",
  kg: "元/kg",
  g: "元/g",
};

function priceText(r: OcrResult): string {
  if (r.price == null || r.price <= 0) return "未识别到价格";
  const unit = UNIT_LABEL[r.unit ?? ""] ?? "";
  if (r.weight != null && r.weight > 0) {
    return `总价 ${r.price} / ${r.weight}${r.weightUnit ?? r.unit ?? ""}`;
  }
  return `${r.price} ${unit}`;
}

interface Props {
  tasks: OcrTask[];
  /** 点击识别完成的卡片（进入表单核对） */
  onOpen: (task: OcrTask) => void;
  /** 重试识别失败的任务 */
  onRetry: (id: string) => void;
}

function TaskCard({
  task,
  onOpen,
  onRetry,
}: {
  task: OcrTask;
  onOpen: (task: OcrTask) => void;
  onRetry: (id: string) => void;
}) {
  const clickable = task.status === "done" && task.result;
  return (
    <div
      className={`glass-card flex items-center gap-3 rounded-2xl p-3 transition ${
        clickable ? "cursor-pointer active:scale-[0.99]" : ""
      }`}
      onClick={clickable ? () => onOpen(task) : undefined}
    >
      <img
        src={task.photoUrl}
        alt="识别原图"
        className="h-12 w-12 shrink-0 rounded-lg object-cover"
      />

      <div className="min-w-0 flex-1">
        {task.status === "processing" && (
          <>
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <Loader2 size={14} className="animate-spin text-brand-green" />
              正在识别…
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              大模型处理中，请稍候
            </p>
          </>
        )}

        {task.status === "done" && task.result && (
          <>
            <p className="truncate text-sm font-semibold text-ink">
              {task.result.name || "未识别商品名"}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-green">
              <CheckCircle2 size={13} />
              {priceText(task.result)}
            </p>
          </>
        )}

        {task.status === "error" && (
          <>
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-500">
              <AlertCircle size={14} />
              识别失败
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">
              {task.error}
            </p>
          </>
        )}
      </div>

      {/* 右侧操作区 */}
      {task.status === "done" ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
          点击核对
          <ChevronRight size={16} />
        </span>
      ) : task.status === "error" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry(task.id);
          }}
          className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
        >
          <RefreshCw size={13} className="mr-1 inline" />
          重试
        </button>
      ) : null}
    </div>
  );
}

/** 拍照识别任务列表：按「等待处理 / 已完成」分组，任务保存到记录后才清除 */
export default function OcrTaskList({ tasks, onOpen, onRetry }: Props) {
  if (tasks.length === 0) return null;

  const pending = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <section className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Loader2
              size={15}
              className={
                pending.some((t) => t.status === "processing")
                  ? "animate-spin text-brand-green"
                  : "text-muted"
              }
            />
            等待处理
            <span className="text-xs font-normal text-muted">
              （{pending.length}）
            </span>
          </p>
          {pending.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpen} onRetry={onRetry} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <CheckCircle2 size={15} className="text-brand-green" />
            已完成
            <span className="text-xs font-normal text-muted">
              （{done.length}）
            </span>
          </p>
          {done.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpen} onRetry={onRetry} />
          ))}
        </section>
      )}
    </div>
  );
}
