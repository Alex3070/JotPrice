export type Unit = "kg" | "jin" | "g";

export interface Channel {
  id: string;
  name: string;
  custom: boolean;
}

export interface PriceRecord {
  id: string;
  name: string;
  price: number;
  unit: Unit;
  pricePerJin: number;
  amount?: number;
  channelId: string;
  date: string;
  note?: string;
  /** 购买地点（菜市场/街道等），可定位或手动填写 */
  location?: string;
  /** 定位纬度 */
  lat?: number;
  /** 定位经度 */
  lng?: number;
  createdAt: number;
  /** 按规格购买（线上买菜常见），如：22.9 元 / 700g */
  spec?: {
    price: number; // 总价
    weight: number; // 总重量
    unit: Unit; // 重量单位 g / kg / 斤
  };
}

export interface OcrConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  /** 识别模型名。云端代理模式下由服务端 OCR_MODEL 决定，前端无需感知 */
  model: string;
  prompt: string;
  /**
   * 云端代理地址（Cloudflare Pages Functions / Worker）。
   * 设置后识别请求改走该代理，apiKey/endpoint 由服务端持有，客户端不再直连。
   */
  workerUrl?: string;
  /**
   * 云端代理模式下，前端显式指定的接口地址（由 VITE_OCR_ENDPOINT 注入）。
   * 设置后会随请求体传给服务端，覆盖服务端 OPENROUTER_ENDPOINT。
   * ⚠️ 服务端 key 将发送到该地址，务必同时配置 ACCESS_TOKEN 防刷。
   */
  workerEndpoint?: string;
  /** 云端代理模式下，前端显式指定的主模型（由 VITE_OCR_MODEL 注入），覆盖服务端 OCR_MODEL */
  workerModel?: string;
  /** 云端代理模式下，前端显式指定的备选模型（由 VITE_OCR_FALLBACK_MODEL 注入），覆盖服务端 OCR_FALLBACK_MODEL */
  workerFallbackModel?: string;
  /** 高德地图 Web 端(JS API) Key，用于“选择地点”地图选点 */
  amapKey?: string;
  /** 高德地图安全密钥（v2.0 安全机制，选填） */
  amapSecurityCode?: string;
}


