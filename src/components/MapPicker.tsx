import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Locate,
  MapPin,
  Search,
} from "lucide-react";
import { loadAmap } from "../lib/amap";
import { getCurrentPosition } from "../lib/geo";

declare global {
  interface Window {
    AMap?: any;
  }
}

/** 默认地图中心（北京），仅用于无法定位且无初始点时的兜底 */
const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];

interface Props {
  amapKey: string;
  amapSecurityCode?: string;
  initialLat?: number;
  initialLng?: number;
  onConfirm: (p: { lat: number; lng: number; location: string }) => void;
  onCancel: () => void;
}

export default function MapPicker({
  amapKey,
  amapSecurityCode,
  initialLat,
  initialLng,
  onConfirm,
  onCancel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState("");
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const [kw, setKw] = useState("");
  const [pois, setPois] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        await loadAmap(amapKey, amapSecurityCode);
        if (disposed || !containerRef.current) return;
        const AMap = window.AMap;

        const map = new AMap.Map(containerRef.current, {
          zoom: 15,
          center:
            initialLat && initialLng
              ? [initialLng, initialLat]
              : DEFAULT_CENTER,
          resizeEnable: true,
        });
        mapRef.current = map;

        const marker = new AMap.Marker({ map });
        markerRef.current = marker;

        const geocoder = new AMap.Geocoder({ city: "全国", radius: 1000 });
        geocoderRef.current = geocoder;

        const setPoint = (lnglat: any) => {
          marker.setPosition(lnglat);
          const pos = { lat: lnglat.getLat(), lng: lnglat.getLng() };
          setSelected(pos);
          geocoder.getAddress(lnglat, (status: string, result: any) => {
            const addr = result?.regeocode?.formattedAddress;
            setLocation(
              addr || `坐标 ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
            );
          });
        };

        // 已有初始坐标：直接打点
        if (initialLat && initialLng) {
          setPoint(new AMap.LngLat(initialLng, initialLat));
        }

        // 点击地图选点
        map.on("click", (e: any) => setPoint(e.lnglat));

        setLoading(false);

        // 无初始点时，尝试自动定位到当前位置
        if (!(initialLat && initialLng)) {
          setLocating(true);
          try {
            const p = await getCurrentPosition();
            if (disposed) return;
            const lnglat = new AMap.LngLat(p.lng, p.lat);
            map.setCenter(lnglat);
            map.setZoom(16);
            setPoint(lnglat);
          } catch {
            // 定位失败不阻塞，用户可手动点击地图选点
          } finally {
            if (!disposed) setLocating(false);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "地图加载失败");
        setLoading(false);
      }
    })();

    return () => {
      disposed = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
    // 组件每次打开重新挂载，初始化只执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 手动定位到当前位置 */
  async function locateMe() {
    if (locating) return;
    setLocating(true);
    setError("");
    try {
      const p = await getCurrentPosition();
      const map = mapRef.current;
      const lnglat = new window.AMap.LngLat(p.lng, p.lat);
      map.setCenter(lnglat);
      map.setZoom(16);
      markerRef.current.setPosition(lnglat);
      const pos = { lat: p.lat, lng: p.lng };
      setSelected(pos);
      geocoderRef.current.getAddress(
        lnglat,
        (status: string, result: any) => {
          const addr = result?.regeocode?.formattedAddress;
          setLocation(
            addr || `坐标 ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
          );
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "定位失败");
    } finally {
      setLocating(false);
    }
  }

  /** 搜索地点 POI */
  function search() {
    const k = kw.trim();
    if (!k || searching) return;
    setSearching(true);
    const placeSearch = new window.AMap.PlaceSearch({
      city: "全国",
      pageSize: 6,
      pageIndex: 1,
    });
    placeSearch.search(k, (status: string, result: any) => {
      setSearching(false);
      setPois(
        status === "complete" && result?.poiList?.pois
          ? result.poiList.pois
          : []
      );
    });
  }

  /** 选中搜索结果：定位到该地点并打点 */
  function pickPoi(poi: any) {
    const map = mapRef.current;
    const lnglat = poi.location;
    map.setCenter(lnglat);
    map.setZoom(17);
    markerRef.current.setPosition(lnglat);
    const pos = { lat: lnglat.getLat(), lng: lnglat.getLng() };
    setSelected(pos);
    setLocation(poi.name + (poi.address ? `（${poi.address}）` : ""));
    setKw(poi.name);
    setPois([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* 顶栏 */}
      <div className="flex items-center gap-2 border-b border-ink/10 bg-white px-3 py-2.5">
        <button
          onClick={onCancel}
          className="btn-ghost shrink-0 px-2"
          aria-label="返回"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-base font-bold text-ink">选择地点</h1>
        <button
          onClick={locateMe}
          disabled={locating || !!error}
          className="btn-ghost shrink-0 px-2"
          title="定位到当前位置"
        >
          {locating ? (
            <Loader2 size={18} className="animate-spin text-brand-orange" />
          ) : (
            <Locate size={18} className="text-brand-orange" />
          )}
        </button>
      </div>

      {/* 搜索框与结果 */}
      <div className="border-b border-ink/10 bg-white px-3 py-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              className="input-base pl-9"
              placeholder="搜索地点，如：三里屯菜市场"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") search();
              }}
            />
          </div>
          <button
            onClick={search}
            disabled={searching}
            className="btn-ghost shrink-0 px-3"
          >
            {searching ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "搜索"
            )}
          </button>
        </div>
        {pois.length > 0 && (
          <ul className="mt-2 space-y-1">
            {pois.map((p, i) => (
              <li key={i}>
                <button
                  onClick={() => pickPoi(p)}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-orange-50"
                >
                  <span className="font-medium text-ink">{p.name}</span>
                  {p.address && (
                    <span className="ml-1 text-xs text-muted">
                      {p.address}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 地图 */}
      <div className="relative flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-muted">
            <Loader2 size={20} className="mr-2 animate-spin" /> 地图加载中…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 px-6 text-center">
            <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-red-500">
              {error}
            </p>
            <button onClick={onCancel} className="btn-ghost text-sm">
              返回
            </button>
          </div>
        )}
      </div>

      {/* 底部确认 */}
      <div className="border-t border-ink/10 bg-white px-4 py-3">
        <button
          onClick={() => selected && onConfirm({ ...selected, location })}
          disabled={!selected || !!error}
          className="btn-primary w-full"
        >
          <MapPin size={16} className="mr-1 inline" />
          {selected ? location || "正在解析地点…" : "点击地图选择地点"}
        </button>
      </div>
    </div>
  );
}
