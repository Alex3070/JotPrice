import type { OcrConfig, Unit } from "../types";

export interface OcrResult {
  name?: string;
  price?: number;
  unit?: Unit;
  /** 按规格出售时的总重量，例如 700g 的“700” */
  weight?: number;
  /** 重量单位，缺省按 unit 处理 */
  weightUnit?: Unit;
}

// 从商品名里兜底提取重量（如“鲜猪五花肉约700g” → 700g）。
function extractWeightFromName(
  name: string | undefined
): { weight: number; weightUnit: Unit } | null {
  if (!name) return null;
  const match = name.match(/(\d+(?:\.\d+)?)\s*(g|kg|斤)/i);
  if (!match) return null;
  const rawUnit = match[2].toLowerCase();
  const unitMap: Record<string, Unit> = { g: "g", kg: "kg", 斤: "jin" };
  const weightUnit = unitMap[rawUnit] ?? "g";
  const weight = parseFloat(match[1]);
  if (!isFinite(weight) || weight <= 0) return null;
  return { weight, weightUnit };
}

// 修复常见的不规范 JSON：未加引号的键名/字符串值、单引号、尾随逗号等。
function repairJson(text: string): string {
  let t = text.trim();
  t = t.replace(/,\s*([}\]])/g, "$1"); // 尾随逗号
  t = t.replace(/'/g, '"'); // 单引号 → 双引号
  t = t.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3'); // 键名加引号
  // 字符串值加引号（数字 / true / false / null 除外）
  t = t.replace(/:\s*([^",{}\[\]]+?)(\s*[,}])/g, (_, val: string, sep: string) => {
    const v = val.trim();
    if (
      v === "" ||
      /^-?\d+(\.\d+)?$/.test(v) ||
      /^(true|false|null)$/.test(v)
    ) {
      return `:${v}${sep}`;
    }
    return `:"${v}"${sep}`;
  });
  return t;
}

/** 模型回显字段模板的特征词（早期默认提示词里的示例占位符） */
const TEMPLATE_WORDS = [
  "商品名",
  "商品名称",
  "数字单价",
  "数字金额",
  "总重量",
  "重量数字",
  "总价",
  "购买渠道",
];

// 判断是否为“字段模板占位”结果，例如 {name: 商品名, price: 数字单价, unit: 'kg'|'jin'|'g'}
function isTemplateText(text: string): boolean {
  if (/["']?[A-Za-z]+["']?\s*\|\s*["']?[A-Za-z]+/.test(text)) return true; // 'kg'|'jin'|'g'
  return TEMPLATE_WORDS.some((w) => text.includes(w));
}

// 解析成功但值仍是占位符（如 name="商品名"、price="数字单价"、unit 含 |）
function looksLikeTemplate(result: OcrResult): boolean {
  const name = (result.name ?? "").trim();
  if (/^(商品名|商品名称)$/.test(name)) return true;
  if (typeof result.price === "string" && !isFinite(parseFloat(result.price))) {
    return true;
  }
  if (result.unit && String(result.unit).includes("|")) return true;
  if (result.weightUnit && String(result.weightUnit).includes("|")) return true;
  return false;
}

// 从接口返回的文本中提取 JSON 对象。
// 部分模型不严格遵循“只返回 JSON”，会附加解释性文字或 markdown 代码块，
// 这里依次尝试：去掉代码块 → 整体解析 → 括号配对截取第一个完整 JSON 对象。
function extractJson(text: string): string | null {
  const noFence = text
    .replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1")
    .trim();

  try {
    JSON.parse(noFence);
    return noFence;
  } catch {
    // 非纯 JSON，继续尝试括号配对提取
  }

  const start = noFence.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < noFence.length; i++) {
    const ch = noFence[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return noFence.slice(start, i + 1);
    }
  }
  return null;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 去掉 data:image/...;base64, 前缀
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// 把接口原始返回（OpenAI 兼容格式）解析为结构化结果。
// 兼容直连与代理两种来源。
interface OcrRawPayload {
  choices?: { message?: { content?: unknown } }[];
  content?: unknown;
}

function parseOcrContent(raw: unknown): OcrResult {
  const data = raw as OcrRawPayload | undefined;
  let content: unknown =
    data?.choices?.[0]?.message?.content ?? data?.content ?? "";
  // 部分兼容接口的 content 是分段数组（可能混有 text 对象），统一拼成字符串
  if (Array.isArray(content)) {
    content = content
      .map((p) =>
        typeof p === "string" ? p : typeof p?.text === "string" ? p.text : ""
      )
      .join("");
  }
  const text = String(content ?? "").trim();
  if (!text) {
    throw new Error("接口返回为空，未识别到内容");
  }

  const jsonText = extractJson(text);
  if (!jsonText) {
    throw new Error(
      `识别失败：接口未返回 JSON。返回内容为：「${text.slice(0, 120)}」` +
        `。请确认模型支持图片输入，并尽量在响应中只输出 JSON（部分平台需在模型/参数中开启 JSON 输出，或换用 gpt-4o-mini 等支持结构化输出的模型）。`
    );
  }

  // 模型偶尔会输出不规范 JSON（键/值未加引号、单引号、尾随逗号），先尝试直接解析，失败后再修复重试
  const repaired = repairJson(jsonText);
  let parsed: OcrResult | null = null;
  for (const candidate of [jsonText, repaired]) {
    try {
      parsed = JSON.parse(candidate) as OcrResult;
      break;
    } catch {
      // 继续尝试下一个候选
    }
  }

  if (!parsed) {
    if (isTemplateText(jsonText)) {
      throw new Error(
        `识别失败：模型只返回了字段模板，而不是从图片中识别出的具体数值（返回内容：${jsonText.slice(0, 120)}）。` +
          `这说明该模型未能真正读取图片内容，建议在「管理-拍照设置」中换用 gpt-4o-mini 等支持视觉输入的模型，并重新拍摄更清晰的图片。`
      );
    }
    throw new Error(
      `解析 JSON 失败：${jsonText.slice(0, 200)}` +
        `。请检查提示词与模型，确保返回合法的 JSON 对象。`
    );
  }

  // 修复后能解析成功，但值仍是占位符（如 name="商品名"、price="数字单价"），同样视为未识别
  if (looksLikeTemplate(parsed)) {
    throw new Error(
      `识别失败：模型只返回了字段模板（name="商品名"、price="数字单价" 这类占位内容），而不是实际识别值。` +
        `请确认所选模型支持图片输入（可换用 gpt-4o-mini 等视觉模型），并重新上传更清晰的图片。`
    );
  }

  // 兜底：模型若只给出总价和 unit，但没识别出 weight，
  // 则尝试从商品名里提取“约700g”这类规格，自动补全为按规格模式。
  if (
    parsed.price != null &&
    parsed.price > 0 &&
    (parsed.weight == null || parsed.weight <= 0)
  ) {
    const extracted = extractWeightFromName(parsed.name);
    if (extracted) {
      parsed.weight = extracted.weight;
      parsed.weightUnit = extracted.weightUnit;
    }
  }

  return parsed;
}

// 通过云端代理识别（密钥在服务端）
async function requestViaWorker(
  cfg: OcrConfig,
  dataUrl: string
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const accessToken = import.meta.env.VITE_ACCESS_TOKEN as string | undefined;
  if (accessToken) headers["x-access-token"] = accessToken;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let res: Response;
  try {
    res = await fetch(cfg.workerUrl!, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        // 模型名由服务端 OCR_MODEL 决定，前端不携带任何 OpenRouter 配置
        prompt: cfg.prompt,
        image: dataUrl,
      }),
    });
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
      throw new Error(
        `网络错误：无法访问识别代理 ${cfg.workerUrl}，请检查网络或代理地址是否配置正确。`
      );
    }
    throw new Error(`请求代理失败：${message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(
      `识别失败：HTTP ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ""}`
    );
  }
  return res.json();
}

// 直接调用用户配置的 OpenAI 兼容接口（本地开发 / 自配模式）
async function requestDirect(
  cfg: OcrConfig,
  dataUrl: string
): Promise<unknown> {
  if (!cfg.endpoint || !cfg.apiKey) {
    throw new Error("OCR 未配置：缺少接口地址或 API Key");
  }

  // 构建兼容 OpenAI 视觉接口的消息体。
  // 注意：不是所有 OpenAI 兼容接口都支持 response_format: { type: "json_object" }，
  // 所以这里默认不强制该字段，依靠 prompt 要求返回 JSON，兼容性更好。
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: cfg.prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  // 只有 OpenAI 官方接口才比较稳地支持 json_object；其它兼容接口容易报错。
  // 如果用户明确使用 OpenAI 域名，可保留该参数以提升稳定性。
  if (cfg.endpoint.includes("openai.com")) {
    body.response_format = { type: "json_object" };
  }

  // 请求头值只能是 ISO-8859-1 字符，若 API Key 含中文等非 ASCII 字符，
  // fetch 会直接抛 “String contains non ISO-8859-1 code point”，这里提前给出明确提示。
  if (!/^[\x20-\x7E]*$/.test(cfg.apiKey.trim())) {
    throw new Error(
      "API Key 包含非 ASCII 字符（如中文占位符“sk-请填写你的APIKey”），" +
        "无法作为请求头发送。请检查本地配置文件 public/ocr.config.json 或服务端环境变量中的 apiKey 是否为真实密钥。"
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await fetch(cfg.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    // 浏览器 fetch 抛错最常见的是 CORS 或网络不通
    if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
      throw new Error(
        `网络/CORS 错误：浏览器无法访问 ${cfg.endpoint}。` +
          `如果是 OpenAI 官方接口，建议在网络可访问环境下使用，或改走支持 CORS 的转发端点。`
      );
    }
    throw new Error(`请求失败：${message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const errData = await res.json();
      detail = JSON.stringify(errData);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(
      `识别失败：HTTP ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ""}`
    );
  }

  return res.json();
}

/** 识别图片价格信息：优先走云端代理，未配置代理时回退直连 */
export async function recognizePrice(
  file: File,
  cfg: OcrConfig
): Promise<OcrResult> {
  if (!cfg.enabled) {
    throw new Error("OCR 未配置");
  }
  const base64 = await toBase64(file);
  const dataUrl = `data:${file.type || "image/jpeg"};base64,${base64}`;

  const raw = cfg.workerUrl
    ? await requestViaWorker(cfg, dataUrl)
    : await requestDirect(cfg, dataUrl);

  return parseOcrContent(raw);
}
