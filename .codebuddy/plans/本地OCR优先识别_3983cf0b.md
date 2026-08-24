---
name: 本地OCR优先识别
overview: 为拍照识别增加本地 OCR 引擎（Tesseract.js 中文），本地优先识别、提取价格后自动填表；本地识别不出价格时自动回退到现有云端 OpenRouter 识别，全程对用户透明。
todos:
  - id: add-dependency
    content: 添加 tesseract.js 依赖并编写本地 OCR 引擎 localOcr.ts（worker 单例、图片压缩、chi_sim 识别）
    status: completed
  - id: parse-text
    content: 实现本地文本解析器：从识别文本提取 name/price/unit/weight/weightUnit 并输出 OcrResult
    status: completed
    dependencies:
      - add-dependency
  - id: orchestrate
    content: 改造 ocr.ts recognizePrice 为本地优先+云端兜底，导出 extractWeightFromName，OcrResult 加 source
    status: completed
    dependencies:
      - parse-text
  - id: adapt-pages
    content: 更新 HomePage 与 CaptureView：本地识别始终可用、首装模型提示与文案调整
    status: completed
    dependencies:
      - orchestrate
  - id: verify-docs
    content: 构建与 lint 验证，更新 DEPLOY.md 本地识别说明并提交推送
    status: completed
    dependencies:
      - adapt-pages
---

## 产品概述

将「拍照识别 → 自动填写价格」改为**本地优先 + 云端兜底**：默认在浏览器内（以 iPhone Safari 为主）完成图片文字识别，用规则从识别文本中提取商品、单价、重量并自动回填表单；当本地无法提取有效价格时，自动回退到现有 OpenRouter 云端链路。全程无需用户额外操作，识别结果仍可人工核对修改后保存。

## 核心功能

- 本地 OCR：浏览器内 WASM 识别图片文字（支持中文价签/小票），首次使用联网下载语言模型并缓存，之后可离线识别
- 自动提取并回填：从识别文本中解析商品名、价格（单价/总价）、重量与单位，复用现有表单回填流程
- 云端自动兜底：本地识别不出价格时自动调用现有云端识别，不打断拍照识别体验
- 识别状态提示：识别中/首次下载模型/识别失败均有明确提示，失败可手动填写

## 技术栈

- 本地 OCR 引擎：tesseract.js（v5，纯 JS/WASM，支持中文 chi_sim），新增 npm 依赖
- 语言模型加载：langPath 默认走 jsDelivr CDN，tesseract.js v5 首次下载后缓存到 IndexedDB，二次识别离线可用（避免仓库膨胀约 15MB）；文档提供「拷贝 tessdata 到 public/tessdata/ 实现完全离线」的可选路径
- 现有栈不变：Vite + React + TS + Tailwind；云端链路（functions/api/ocr.js、requestViaWorker、parseOcrContent）保持原样作为兜底

## 实现方案

### 1. 本地 OCR 引擎封装（src/lib/localOcr.ts，NEW）

- worker 单例 + 懒加载：首次识别创建 `createWorker("chi_sim+eng")` 并复用，避免重复初始化；`logger` 输出进度供 loading 文案（防刷屏）
- 图片预处理：canvas 压缩（最长边约 1280px、JPEG 0.85），降低 iPhone Safari WASM 推理像素量，单次识别目标 2–5 秒
- 文本解析器：对多行识别文本用正则/启发式提取 `OcrResult`：
- 价格：`¥12.90`、`12.90元`、`单价9.9`、裸数字等模式；依据 `元/斤`、`¥/kg`、`单价` 判断"单价"，依据含重量判断"总价/规格"
- 重量：`500g`、`0.9kg`、`1.2斤`、`约700克` 等，映射 g/kg/jin
- 商品名：取首行非价格文本并清洗
- 提取到有效 price 才返回 `OcrResult`，否则返回 null（触发云端兜底）

### 2. 识别编排（src/lib/ocr.ts，MODIFY）

- `recognizePrice(file, cfg)` 改为：本地识别不再要求 `cfg.enabled`；本地失败或未提取到价格时，若云端可用（`cfg.enabled && (workerUrl || (endpoint && apiKey))`）走现有云端流程；两者均失败时抛出带明确原因的错误（沿用现有错误文案风格）
- 导出 `extractWeightFromName` 供 localOcr 复用（DRY）；`OcrResult` 增加可选 `source?: "local" | "cloud"` 字段（向后兼容）

### 3. 页面适配（HomePage.tsx / CaptureView.tsx，MODIFY）

- `ocrReady` 改为「本地识别始终可用」，不再因未配置云端而拦截拍照
- `handleFile` 首次识别前一次性提示"需下载识别模型（约 15MB）"；沿用现有 `ocrLoading` 状态
- CaptureView 文案更新为"本地识别，云端自动兜底"

### 4. 文档（DEPLOY.md，MODIFY）

- 补充本地识别说明：模型首装联网一次、之后 IndexedDB 缓存、可选完全离线本地化路径；云端仍为兜底，OCR_MODEL/OCR_FALLBACK_MODEL 逻辑不变

## 关键文件

- [NEW] `src/lib/localOcr.ts`：worker 单例、图片压缩、本地文本解析
- [MODIFY] `src/lib/ocr.ts`：recognizePrice 本地优先+云端兜底；导出 extractWeightFromName；OcrResult 加 source
- [MODIFY] `src/pages/HomePage.tsx`：ocrReady 语义、handleFile 编排与首装提示
- [MODIFY] `src/components/CaptureView.tsx`：提示/loading 文案
- [MODIFY] `src/types/index.ts`：OcrResult 可选 source 字段
- [MODIFY] `package.json`：新增 tesseract.js
- [MODIFY] `DEPLOY.md`：本地识别说明

## 实施注意

- 性能：worker 单例复用、图片压缩控制耗时；tesseract.js 主包约 1MB+，bundle 体积可控
- 兼容：OcrResult 仅加可选字段，RecordForm/数据库结构零改动
- 降级完整：本地失败 → 云端兜底 → 仍失败 toast 明确原因，可手动填写
- 验证：npm run build 通过、lint 无新增错误、iPhone Safari 真机冒烟（本地识别回填 + 手动触发云端兜底）