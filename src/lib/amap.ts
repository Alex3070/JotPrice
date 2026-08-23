/**
 * 动态加载高德地图 JS API v2.0。
 * 需要在高德开放平台（https://console.amap.com）申请「Web 端(JS API)」Key。
 * 若开启安全密钥（v2.0 安全机制），还需提供 securityJsCode。
 */
export function loadAmap(key: string, securityCode?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = window as unknown as { AMap?: unknown };
    if (win.AMap) {
      resolve();
      return;
    }
    if (securityCode?.trim()) {
      (window as unknown as Record<string, unknown>)._AMapSecurityConfig = {
        securityJsCode: securityCode.trim(),
      };
    }
    const script = document.createElement("script");
    script.src =
      `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}` +
      `&plugin=AMap.Geocoder,AMap.PlaceSearch,AMap.Scale`;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error(
          "高德地图 SDK 加载失败，请检查 Key 是否有效、是否配置了安全密钥，以及网络能否访问 webapi.amap.com"
        )
      );
    document.head.appendChild(script);
  });
}
