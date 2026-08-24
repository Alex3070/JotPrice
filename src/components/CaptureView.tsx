import { type ChangeEvent } from "react";
import { Camera, ImagePlus, Sparkles } from "lucide-react";

interface Props {
  ocrReady: boolean;
  onFile: (file: File) => void;
}

export default function CaptureView({ ocrReady, onFile }: Props) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      {/* 拍照：capture 会直接调起摄像头 */}
      <label className="glass-card relative flex cursor-pointer flex-col items-center justify-center gap-3 py-14 text-center transition active:scale-[0.99]">
        <div className="rounded-3xl bg-brand-orange/10 p-6 text-brand-orange">
          <Camera size={40} />
        </div>
        <span className="text-lg font-semibold text-ink">拍照识别单价</span>
        <span className="max-w-60 text-sm text-muted">
          {ocrReady
            ? "拍下价签或商品图，识别结果会出现在下方，可连续拍摄"
            : "OCR 未配置，可在「管理-拍照设置」中填写接口"}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleChange}
        />
      </label>

      {/* 从相册选择：不带 capture，可打开相册/文件选择器 */}
      <label className="glass-card flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-medium text-ink transition active:scale-[0.99]">
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
          <Sparkles size={14} /> 使用提示
        </p>
        <p className="mt-1">
          1. 上传图片后会在下方自动排队识别，可继续拍摄其他价签；
          <br />
          2. 识别完成的卡片会显示商品与价格，点它即可核对后保存；
          <br />
          3. 识别失败的卡片可一键重试。
        </p>
      </div>
    </div>
  );
}
