/**
 * 浏览器定位。
 * 先高精度定位，超时/不可用时自动降级为低精度重试。
 * 关键：浏览器只允许在“安全上下文”（HTTPS 或 localhost）中使用定位，
 * 否则即使浏览器已授权，也会立即以 PERMISSION_DENIED 拒绝。
 */
export async function getCurrentPosition(
  timeout = 8000
): Promise<{ lat: number; lng: number }> {
  // 非安全上下文（HTTP / 局域网 IP）→ 浏览器直接禁止定位
  if (!window.isSecureContext) {
    throw new Error(
      "当前页面不是 HTTPS 或 localhost，浏览器禁止定位。" +
        "请使用 https:// 或 http://localhost 打开页面后重试。"
    );
  }
  if (!("geolocation" in navigator)) {
    throw new Error("当前浏览器不支持定位");
  }

  const attempt = (opts: PositionOptions) =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        reject,
        opts
      );
    });

  try {
    return await attempt({
      enableHighAccuracy: true,
      timeout,
      maximumAge: 30000,
    });
  } catch (err) {
    const ge = err as GeolocationPositionError;
    // PERMISSION_DENIED：不是网络/精度问题，降级重试也无效，直接给出诊断
    if (ge?.code === 1) {
      throw new Error(
        "定位权限被拒绝。若你已授权浏览器定位，请逐一排查：\n" +
          "1) 页面必须是 https:// 或 http://localhost（浏览器安全要求）；\n" +
          "2) 系统级定位开关是否打开（Windows：设置→隐私→位置；macOS：系统设置→隐私与安全性→定位服务）；\n" +
          "3) Chrome 的定位依赖 Google 定位服务，网络受限时授权了也可能失败，可改用 Firefox/Edge 试试；\n" +
          "4) 若在应用内嵌浏览器/WebView 中打开，可能不支持定位，请改用系统浏览器。"
      );
    }
    // 超时/不可用：降级为低精度再试一次
    try {
      return await attempt({
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000,
      });
    } catch (err2) {
      const ge2 = err2 as GeolocationPositionError;
      const reason =
        ge2?.code === 2
          ? "暂时无法获取位置，请确认 GPS/网络已开启后重试"
          : ge2?.code === 3
            ? "定位超时，请重试"
            : "定位失败，请重试";
      throw new Error(reason);
    }
  }
}


