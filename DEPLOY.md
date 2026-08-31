# 部署指南（Cloudflare Pages）

本项目为「静态前端 + Serverless 函数」架构：前端由 Vite 构建为静态站点，
OCR 识别通过同域 `/api/ocr`（Cloudflare Pages Functions）代理到 OpenRouter，
数据云同步通过 `/api/sync` + Cloudflare D1 实现，
**所有付费密钥都只存在于服务端环境变量**。

## 一、密钥分布总览

| 配置 | 位置 | 说明 |
|---|---|---|
| OpenRouter API Key | 服务端环境变量 `OPENROUTER_API_KEY` | 必填，绝不进前端 |
| OpenRouter 模型名 | 服务端环境变量 `OCR_MODEL` | 可选，默认 `gpt-4o-mini` |
| OpenRouter 接口域名 | 服务端环境变量 `OPENROUTER_ENDPOINT` | 可选，默认 OpenRouter 官方地址 |
| 防滥用口令 | 服务端 `ACCESS_TOKEN` + 前端 `VITE_ACCESS_TOKEN` | 可选，前后端需一致 |
| 高德 Key | 前端构建变量 `VITE_AMAP_KEY` | 高德 Web JS API 必须在浏览器加载，靠域名白名单兜底 |
| 高德安全密钥 | 前端构建变量 `VITE_AMAP_SECURITY_CODE` | 同上 |

> 高德 Key 会进入前端 JS 包，这是高德 Web JS API 的机制，无法避免。
> 防护手段是「域名白名单 + 安全密钥」，见下文第三节，务必配置。

## 二、部署前准备

### 1. OpenRouter
- 在 https://openrouter.ai/keys 创建密钥（`sk-or-v1-...`），妥善保存。

### 2. 高德开放平台
- 在 https://console.amap.com/ 创建「Web 端(JS API)」Key。
- 如开启安全密钥机制，同时记录 `securityCode`。
- 准备好你将要使用的正式域名（如 `maicai.example.com`）。

## 三、高德域名白名单（必做）

进入高德控制台 → 应用管理 → 你的应用 → 「添加」或「设置」：

- **Key 平台**：Web 端(JS API)
- **域名白名单**：填写发布后的站点域名，例如
  - `https://maicai.example.com`
  - 开发调试时再加 `http://localhost:5173`（或实际 dev 端口）
  - 不要填 `*`，否则白名单失去意义

配好后，即使 Key 被从 JS 中提取，也**只能在你自己的域名下调用**。

## 四、Cloudflare Pages 部署步骤

### 1. 推送代码到 Git 仓库
本项目构建产物是 `dist/`，`functions/` 目录由 Pages 自动识别为 Functions。

首次发布前请先初始化仓库并确认忽略规则：

```bash
git init
# 确认 .gitignore 已包含：dist/  node_modules/  .env.local  public/ocr.config.json
git add . && git commit -m "init"
```

若项目尚未创建 `.gitignore`，至少需忽略 `public/ocr.config.json`、
`.env.local` 和 `dist/`，防止本地直连模式的真实密钥被提交。

### 2. 创建项目
Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git，
选择本仓库，框架预设选 **Vite**（或留空）：

| 配置项 | 值 |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |

### 3. 配置环境变量
项目设置 → Settings → Environment variables：

**服务端（Production + Preview 均需配置）：**
| 变量名 | 必填 | 说明 |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ | OpenRouter 密钥 |
| `OCR_MODEL` | 可选 | 主模型名，如 `openai/gpt-4o-mini`，默认 `gpt-4o-mini` |
| `OCR_FALLBACK_MODEL` | 可选 | 备选模型名；当主模型返回 429/503/504 时自动切换重试一次 |
| `OPENROUTER_ENDPOINT` | 可选 | 默认 `https://openrouter.ai/api/v1/chat/completions` |
| `ACCESS_TOKEN` | 可选 | 弱口令防刷，设置后前端必须带同名 `VITE_ACCESS_TOKEN` |

**前端构建变量（会打进 JS 包）：**
| 变量名 | 必填 | 说明 |
|---|---|---|
| `VITE_AMAP_KEY` | ✅ | 高德 Key |
| `VITE_AMAP_SECURITY_CODE` | ✅ | 高德安全密钥 |
| `VITE_ACCESS_TOKEN` | 可选 | 与服务端 `ACCESS_TOKEN` 一致 |

> Cloudflare 的 `OPENROUTER_API_KEY` 等建议勾选 **Encrypt**，避免在控制台明文展示。
> 在「Builds & deployments → Production branch」选择正式分支（如 `main`）后，每次推送自动部署。

### 4. 创建 D1 数据库并绑定（云同步必做）

云同步需要 Cloudflare D1 数据库（免费 5GB）。两种方式任选：

**方式 A：命令行（推荐）**
```bash
npm i -D wrangler
npx wrangler login
npx wrangler d1 create maicai-sync        # 创建数据库，记下 database_id
npx wrangler d1 execute maicai-sync --file=schema.sql   # 建表
```

**方式 B：控制台**
- Dashboard → D1 → Create database（如 `maicai-sync`）
- 进入数据库 → Console，把 `schema.sql` 的内容粘贴执行

然后回到 Pages 项目：Settings → Functions → **D1 database bindings** →
Add binding，变量名固定填 **`DB`**，选择刚创建的 `maicai-sync`。

> 建议同时把生产环境的 D1 绑定也加到 Preview 环境（或保持同一份），
> 本地调试 `npx wrangler pages dev --d1 DB=maicai-sync` 可联调。

### 5. 绑定自定义域名（可选）
Pages 默认提供 `xxx.pages.dev` 域名，可直接使用；也可以在
Custom domains 中绑定自己的域名（需在 DNS 处添加 CNAME 记录）。

## 五、部署后验证清单

1. 打开站点，确认页面正常加载、PWA 可安装。
2. 「添加记录 → 拍照识别」：拍照后能正常识别出商品名/价格。
3. 「选择地点」：地图能加载、能搜索并选点。
4. 浏览器 DevTools → Network：检查 `/api/ocr` 请求返回 200 且不含密钥；
   确认 `openrouter.ai` 只出现在 **服务端发起的请求** 中（前端 Network 里不应直接出现）。
5. 访问 `https://你的域名/ocr.config.json`：应返回 404（确认真实密钥文件未被打包）。
6. 管理页 → 「云同步」→ 填写同步地址并保存 → 「立即同步」应提示成功；
   在另一台设备浏览器打开同一站点同步后，记录与渠道应互通。
   DevTools → Network 中 `/api/sync` 请求应返回 200。

## 六、安全注意事项

- **密钥一旦泄露必须作废重发**：OpenRouter 控制台 revoke、高德控制台重置 Key。
- 不要修改 `public/ocr.config.example.json` 填入真实密钥；`public/ocr.config.json`
  仅用于本地开发，发布前删除或确保不提交。
- 接口是公开的，`ACCESS_TOKEN` 只是弱口令，防止陌生人抓包白嫖 OCR 额度；
  如需更强保护可在 Cloudflare 侧配置 Rate Limiting / WAF。
- 前端 JS 中所有以 `VITE_` 开头的变量都会被任何访客看到，因此只放高德 Key
  这类「前端必须、且有白名单兜底」的配置。

## 七、本地开发

```bash
npm install
cp .env.example .env.local   # 按需填入 VITE_AMAP_KEY / VITE_AMAP_SECURITY_CODE
npm run dev                  # 打开 http://localhost:5173
```

两种模式：

- **直连模式**：复制 `public/ocr.config.example.json` 为 `public/ocr.config.json`，
  填写 `apiKey` / `model` 后本地直接请求 OpenRouter（不经过代理）。
  ⚠️ 此文件会被打包进 `dist/`，仅限本地调试，切勿提交真实密钥。
- **代理模式**：生产环境走同域 `/api/ocr`。本地调试 Functions 请用
  `npx wrangler pages dev` 启动（会同时提供静态资源与 Functions 路由），
  并将 `VITE_OCR_WORKER_URL` 指向本地地址或留空使用相对路径。
