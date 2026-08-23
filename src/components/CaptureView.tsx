import { type ChangeEvent, type ReactNode } from "react";
import { Camera, ImagePlus, Sparkles, X } from "lucide-react";

interface Props {
  ocrReady: boolean;
  loading: boolean;
  photo: string | null;
  onFile: (file: File) => void;
  onClearPhoto: () => void;
}

export default function CaptureView({
  ocrReady,
  loading,
  photo,
  onFile,
  onClearPhoto,
}: Props) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      {/* 拍照：capture 会直接调起摄像头 */}
      <label
        className={`glass-card relative flex cursor-pointer flex-col items-center justify-center gap-3 py-16 text-center transition active:scale-[0.99] ${
          loading ? "pointer-events-none opacity-70" : ""
        }`}
      >
        {photo ? (
          <>
            <img
              src={photo}
              alt="预览"
              className="h-48 w-48 rounded-2xl object-cover shadow-card"
            />
            <span className="text-sm font-medium text-ink">
              {loading ? "正在识别价格…" : "识别完成，正在回填"}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onClearPhoto();
              }}
              className="absolute right-4 top-4 rounded-full bg-ink/80 p-2 text-white"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <div
              className={`rounded-3xl p-6 ${
                loading
                  ? "bg-brand-green/10 text-brand-green"
                  : "bg-brand-orange/10 text-brand-orange"
              }`}
            >
              {loading ? (
                <Sparkles size={40} className="animate-spin" />
              ) : (
                <Camera size={40} />
              )}
            </div>
            <span className="text-lg font-semibold text-ink">
              {loading ? "识别中…" : "拍照识别单价"}
            </span>
            <span className="max-w-60 text-sm text-muted">
              {loading
                ? "正在识别图片中的商品、单价与重量"
                : ocrReady
                  ? "拍下价签或商品图，自动填写价格"
                  : "OCR 未配置，可在「管理-拍照设置」中填写接口"}
            </span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleChange}
        />
      </label>

      {/* 从相册选择：不带 capture，可打开相册/文件选择器 */}
      <label
        className={`glass-card flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-medium text-ink transition active:scale-[0.99] ${
          loading ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <ImagePlus size={18} className="text-brand-orange" />
        从相册选择图片识别
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </label>

      <div className="rounded-2xl border border-dashed border-ink/10 bg-white/60 px-4 py-3 text-xs leading-relaxed text-muted">
        <p className="flex items-center gap-1.5 font-medium text-ink">
          <ImagePlus size={14} /> 使用提示
        </p>
        <p className="mt-1">
          1. 对准价签或商品图拍照，自动识别商品、价格与重量；
          <br />
          2. 识别结果可核对修改后再保存。
        </p>
      </div>
    </div>
  );
}
