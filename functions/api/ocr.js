/**
 * Cloudflare Pages Functions —— OCR 代理
 *
 * 作用：前端把图片 + 提示词发给本函数，由本函数使用服务端密钥调用
 * OpenRouter（OpenAI 兼容接口），密钥永不落入浏览器。
 *
 * 环境变量（Cloudflare Pages 控制台 → Settings → Environment variables 中配置）：
 *   OPENROUTER_API_KEY     必填，OpenRouter 密钥
 *   OPENROUTER_ENDPOINT    可选，OpenRouter 接口域名，默认 https://openrouter.ai/api/v1/chat/completions
 *   OCR_MODEL              可选，主识别模型名（需带供应商前缀，如 openai/gpt-4o-mini），默认 gpt-4o-mini
 *   OCR_FALLBACK_MODEL     可选，备选模型名；当主模型返回 429/503/504 时自动切换重试一次
 *   ACCESS_TOKEN           可选，弱口令防刷；设置后前端必须携带同名请求头 x-access-token
 *
 * 请求体：{ prompt, image }，image 为 base64 data URL。
 * 模型名由服务端 OCR_MODEL / OCR_FALLBACK_MODEL 决定，前端无需感知任何 OpenRouter 配置。
 */
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

  const { prompt, image } = body ?? {};
  if (!prompt || !image) {
    return json({ error: "缺少 prompt / image 参数" }, 400);
  }

  // 模型名由服务端环境变量指定，前端请求无需携带
  const model = (env.OCR_MODEL || "gpt-4o-mini").trim();
  if (!model) {
    return json({ error: "服务端未配置 OCR_MODEL" }, 500);
  }
  const fallbackModel = (env.OCR_FALLBACK_MODEL || "").trim();

  const endpoint =
    env.OPENROUTER_ENDPOINT || "https://openrouter.ai/api/v1/chat/completions";

  async function callModel(m) {
    const res = await fetch(endpoint, {
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

  let { res: upstream, text } = await callModel(model);

  // 主模型限流或服务不可用时，自动切换到备选模型重试一次
  if (
    fallbackModel &&
    fallbackModel !== model &&
    [429, 503, 504].includes(upstream.status)
  ) {
    ({ res: upstream, text } = await callModel(fallbackModel));
  }

  // 原样透传上游响应（含状态码），前端按 OpenAI 兼容格式解析
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
