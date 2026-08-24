import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
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
  onOpen: (result: OcrResult) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

/** 拍照识别任务列表：后台排队识别，完成/失败后由用户点击处理 */
export default function OcrTaskList({
  tasks,
  onOpen,
  onRetry,
  onRemove,
}: Props) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <Loader2 size={15} className={tasks.some((t) => t.status === "processing") ? "animate-spin text-brand-green" : "text-muted"} />
        识别任务
        <span className="text-xs font-normal text-muted">
          （{tasks.filter((t) => t.status === "done").length}/{tasks.length} 完成）
        </span>
      </p>

      {tasks.map((task) => (
        <div
          key={task.id}
          className={`glass-card flex items-center gap-3 rounded-2xl p-3 transition ${
            task.status === "done" ? "cursor-pointer active:scale-[0.99]" : ""
          }`}
          onClick={
            task.status === "done" && task.result
              ? () => onOpen(task.result!)
              : undefined
          }
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
            <ChevronRight size={18} className="shrink-0 text-muted" />
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
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(task.id);
              }}
              className="shrink-0 text-muted transition-colors hover:text-ink"
              aria-label="移除任务"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
