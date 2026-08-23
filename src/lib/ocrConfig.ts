import type { OcrConfig } from "../types";

/** 内置默认提示词：当配置文件未提供 prompt 时使用 */
const DEFAULT_PROMPT = `你是一个价格识别助手。请从图片中提取商品信息，只输出一个合法的 JSON 对象，不要输出任何解释、前后缀文字或 markdown 代码块。
字段与规则：
- name：商品名（字符串）。如果标题里包含重量规格（如“约700g”），请把重量部分去掉，只保留商品名，例如“鲜猪五花肉约700g (称重退差)” → name="鲜猪五花肉"。
- price：数字金额，纯数字，不要带 ¥ 或“元”。
- unit：仅在商品明确按“单价”标价时使用，取 kg/jin/g。例如图中写 ¥12.5/kg 则 price=12.5, unit="kg"；写 ¥8/斤 则 price=8, unit="jin"。
- weight：总重量数字（纯数字）。当商品按“规格/份”出售时给出，例如标题含“约700g”、图片里标“净含量 1kg”，则必须返回 weight。
- weightUnit：重量单位，g/kg/jin。按规格出售时必须返回。

判断规则（非常重要）：
1. 如果价格明显是一份/一件商品的总价，且同时能看到重量（如“约700g”、“净含量1kg”），则这是按规格出售。此时 price 为总价，必须返回 weight 和 weightUnit，不要返回 unit。
2. 如果图片只标注了单价（如“¥12.5/kg”、“¥8/斤”），则返回 price 和 unit，不要返回 weight 和 weightUnit。
3. 如果标题里包含重量但价格没有单位（如“鲜猪五花肉约700g  ¥22.9”），视为按规格出售：price=22.9, weight=700, weightUnit="g"。

示例：
- 图中：鲜猪五花肉约700g  ¥22.9 → {"name":"鲜猪五花肉","price":22.9,"weight":700,"weightUnit":"g"}
- 图中：¥12.5/kg → {"price":12.5,"unit":"kg"}
- 图中：五花肉 ¥18/斤 → {"name":"五花肉","price":18,"unit":"jin"}

严格遵守：所有字段值必须是图片中真实识别出的具体内容（如 name="鲜猪五花肉"、price=22.9、weight=700），严禁输出字段模板、占位符或类型说明文字（例如 商品名、数字单价、kg|jin|g 这类内容）。`;

const DEFAULT_CONFIG: OcrConfig = {
  enabled: false,
  endpoint: "",
  apiKey: "",
  model: "gpt-4o-mini",
  prompt: DEFAULT_PROMPT,
};

/**
 * 加载拍照识别配置，两种模式：
 *
 * 1. 云端代理模式（发布后默认）：识别请求走同域 /api/ocr（Cloudflare Pages
 *    Functions），OpenRouter 的 key / 模型名 / 接口域名全部由服务端环境变量
 *    决定（OPENROUTER_API_KEY / OCR_MODEL / OPENROUTER_ENDPOINT），客户端不感知；
 *    高德 Key 从构建环境变量（VITE_AMAP_KEY / VITE_AMAP_SECURITY_CODE）注入。
 * 2. 本地直连模式（开发调试）：读取 public/ocr.config.json，apiKey、model 等
 *    由开发者在本地填写。注意：此文件若存在会被打包进静态站点，切勿提交真实密钥。
 */
export async function getOcrConfig(): Promise<OcrConfig> {
  const amapKey = (import.meta.env.VITE_AMAP_KEY as string | undefined)?.trim();
  const amapSecurityCode = (
    import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined
  )?.trim();

  const workerUrl =
    (import.meta.env.VITE_OCR_WORKER_URL as string | undefined)?.trim() ||
    (import.meta.env.PROD ? `${import.meta.env.BASE_URL}api/ocr` : "");

  if (workerUrl) {
    return {
      ...DEFAULT_CONFIG,
      enabled: true,
      workerUrl,
      // 云端代理模式下模型名由服务端 OCR_MODEL 决定，此字段仅作占位，前端不再使用
      model: DEFAULT_CONFIG.model,
      amapKey: amapKey || undefined,
      amapSecurityCode: amapSecurityCode || undefined,
    };
  }

  // 本地开发 / 自配直连模式
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}ocr.config.json`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const partial = (await res.json()) as Partial<OcrConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...partial,
      prompt: partial.prompt?.trim() ? partial.prompt : DEFAULT_PROMPT,
      amapKey: amapKey || partial.amapKey || undefined,
      amapSecurityCode:
        amapSecurityCode || partial.amapSecurityCode || undefined,
    };
  } catch (err) {
    console.warn("[ocrConfig] 未找到 ocr.config.json，OCR 功能已关闭", err);
    return {
      ...DEFAULT_CONFIG,
      amapKey: amapKey || undefined,
      amapSecurityCode: amapSecurityCode || undefined,
    };
  }
}
