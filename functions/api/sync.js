/**
 * Cloudflare Pages Functions —— 数据云同步（D1）
 *
 * 前端 IndexedDB（records / channels）通过本接口与云端 D1 数据库增量同步：
 *   - GET  /api/sync?since=<ts>  拉取 since 之后的所有变更（增量）
 *   - POST /api/sync             推送本地变更（批量 upsert / 删除标记）
 *
 * 冲突策略：last-write-wins。每条数据带 updated_at，推送时若云端已有更新
 * 版本则跳过；拉取时以 updated_at 与本地比较，取较新者。
 *
 * 环境变量：
 *   ACCESS_TOKEN  可选，弱口令防刷；设置后前端必须携带同名请求头 x-access-token
 *
 * D1 绑定：env.DB（Pages 控制台 → Settings → Functions → D1 database bindings）
 * 建表 SQL 见项目根目录 schema.sql，需先在 D1 数据库上执行一次。
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-access-token",
  "Access-Control-Max-Age": "86400",
};

// 浏览器跨域预检：本地 dev（localhost）直连云端时也需要
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// 弱口令鉴权：返回 null 表示通过，否则返回错误提示文本
function unauthorized(env, request) {
  if (!env.ACCESS_TOKEN) return null;
  const token = request.headers.get("x-access-token") ?? "";
  return token === env.ACCESS_TOKEN ? null : "未授权访问";
}

/** 拉取增量变更：GET /api/sync?since=<epoch_ms> */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "服务端未绑定 D1 数据库" }, 500);
  const err = unauthorized(env, request);
  if (err) return json({ error: err }, 403);

  const url = new URL(request.url);
  const since = Math.max(0, Number(url.searchParams.get("since")) || 0);

  const { results } = await env.DB.prepare(
    "SELECT id, type, data, updated_at, deleted FROM items WHERE updated_at > ? ORDER BY updated_at ASC"
  )
    .bind(since)
    .all();

  const items = results.map((r) => ({
    id: r.id,
    type: r.type,
    data: r.data ? JSON.parse(r.data) : null,
    deleted: r.deleted === 1,
    updatedAt: r.updated_at,
  }));

  return json({ serverTime: Date.now(), items });
}

/** 推送本地变更：POST /api/sync  body: { items: [{ id, type, data?, deleted?, updatedAt }] } */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "服务端未绑定 D1 数据库" }, 500);
  const err = unauthorized(env, request);
  if (err) return json({ error: err }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求体不是合法 JSON" }, 400);
  }

  const changes = Array.isArray(body?.items) ? body.items : [];
  if (changes.length === 0) return json({ serverTime: Date.now(), saved: 0 });

  const stmt = env.DB.prepare(
    `INSERT INTO items (id, type, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET type = excluded.type, data = excluded.data,
       updated_at = excluded.updated_at, deleted = excluded.deleted`
  );

  let saved = 0;
  for (const c of changes) {
    const id = String(c?.id ?? "");
    const type = c?.type === "channel" ? "channel" : "record";
    const updatedAt = Number(c?.updatedAt) || 0;
    if (!id) continue;

    // LWW：云端已有更新版本则跳过本次推送
    const row = await env.DB.prepare("SELECT updated_at FROM items WHERE id = ?")
      .bind(id)
      .first();
    if (row && row.updated_at > updatedAt) continue;

    await stmt
      .bind(
        id,
        type,
        c?.data ? JSON.stringify(c.data) : null,
        updatedAt,
        c?.deleted ? 1 : 0
      )
      .run();
    saved++;
  }

  return json({ serverTime: Date.now(), saved });
}
