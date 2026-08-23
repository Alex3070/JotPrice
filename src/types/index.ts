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
  /** 高德地图 Web 端(JS API) Key，用于“选择地点”地图选点 */
  amapKey?: string;
  /** 高德地图安全密钥（v2.0 安全机制，选填） */
  amapSecurityCode?: string;
}


