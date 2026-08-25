/**
 * Cloudflare Pages Functions —— OCR 代理
 *
 * 作用：前端把图片 + 提示词发给本函数，由本函数使用服务端密钥调用
 * OpenRouter（OpenAI 兼容接口），密钥永不落入浏览器。
 *
 * 环境变量（Cloudflare Pages 控制台 → Settings → Environment variables 中配置）：
 *   OPENROUTER_API_KEY     必填，接口密钥
 *   OPENROUTER_ENDPOINT    可选，接口域名，默认 https://openrouter.ai/api/v1/chat/completions
 *   OCR_MODEL              可选，主识别模型名（需带供应商前缀，如 openai/gpt-4o-mini），默认 gpt-4o-mini
 *   OCR_FALLBACK_MODEL     可选，备选模型名；当主模型返回 429/503/504 时自动切换重试一次
 *   ACCESS_TOKEN           可选，弱口令防刷；设置后前端必须携带同名请求头 x-access-token
 *
 * 请求体：{ prompt, image, model?, fallbackModel?, endpoint? }，image 为 base64 data URL。
 * endpoint / model / fallbackModel 三个参数的优先级（从高到低）：
 *   请求体显式传入（前端 VITE_OCR_ENDPOINT / VITE_OCR_MODEL / VITE_OCR_FALLBACK_MODEL）
 *   > 服务端环境变量（OPENROUTER_ENDPOINT / OCR_MODEL / OCR_FALLBACK_MODEL）
 *   > 内置默认值。
 * 这使你可以不改代码就切换其它 OpenAI 兼容服务或模型。
 *
 * ⚠️ 安全提醒：endpoint 若由前端传入，服务端的 OPENROUTER_API_KEY 将随请求
 * 发送到该地址。请务必配置 ACCESS_TOKEN 弱口令防刷，且不要指向不受信任的地址。
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-access-token",
  "Access-Control-Max-Age": "86400",
};

// 浏览器跨域预检：本地 dev（localhost）直连云端代理时需要
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 可选弱口令校验，防止接口被随意抓包盗用
  if (env.ACCESS_TOKEN) {
    const token = request.headers.get("x-access-token") ?? "";
    if (token !== env.ACCESS_TOKEN) {
      return json({ error: "未授权访问" }, 403);
    }
  }

  if (!env.OPENROUTER_API_KEY) {
    return json({ error: "服务端未配置 OPENROUTER_API_KEY" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求体不是合法 JSON" }, 400);
  }

  const { prompt, image, model, fallbackModel, endpoint } = body ?? {};
  if (!prompt || !image) {
    return json({ error: "缺少 prompt / image 参数" }, 400);
  }

  // 优先级：请求体显式传入（前端 VITE_* 变量） > 服务端环境变量 > 内置默认
  const modelName = (model || env.OCR_MODEL || "gpt-4o-mini").trim();
  if (!modelName) {
    return json({ error: "服务端未配置 OCR_MODEL" }, 500);
  }
  const fallbackModelName = (fallbackModel || env.OCR_FALLBACK_MODEL || "").trim();

  const endpointUrl = (
    endpoint ||
    env.OPENROUTER_ENDPOINT ||
    "https://openrouter.ai/api/v1/chat/completions"
  ).trim();

  async function callModel(m) {
    const res = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: m,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });
    const text = await res.text();
    return { res, text };
  }

  let { res: upstream, text } = await callModel(modelName);

  // 主模型限流或服务不可用时，自动切换到备选模型重试一次
  if (
    fallbackModelName &&
    fallbackModelName !== modelName &&
    [429, 503, 504].includes(upstream.status)
  ) {
    ({ res: upstream, text } = await callModel(fallbackModelName));
  }

  // 原样透传上游响应（含状态码），前端按 OpenAI 兼容格式解析
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
