-- Cloudflare D1 数据库建表脚本（云同步）
-- 执行方式：
--   1. wrangler d1 create maicai-sync          # 创建数据库
--   2. wrangler d1 execute maicai-sync --file=schema.sql   # 建表
--   然后在 Pages 控制台 → Settings → Functions → D1 database bindings
--   绑定数据库，绑定变量名固定为 DB。

CREATE TABLE IF NOT EXISTS items (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,          -- 'record' | 'channel'
  data       TEXT,                   -- JSON 字符串（deleted=1 时可为空）
  updated_at INTEGER NOT NULL,       -- 变更时间戳（毫秒），用于增量拉取与冲突比较
  deleted    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_updated ON items (updated_at);
