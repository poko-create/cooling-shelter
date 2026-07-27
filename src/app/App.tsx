import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, LocateFixed, MapPin, Navigation, Route, Search, Trees, Users, Waves } from "lucide-react";
import { DATA_SPARSE_THRESHOLD, DEFAULT_ZOOM, DEMO_AREA_CENTER, TOKYO_FALLBACK_CENTER } from "../config/area";
import { STALE_AVAILABILITY_HOURS } from "../config/scoring";
import { initialAvailability, mockRestSpots, mockShelters } from "../data/mock/shelters";
import { updateAvailability } from "../services/availabilityStore";
import { searchDestination } from "../services/destinationSearch";
import { getHeatRisk } from "../services/heatRisk";
import { getRouteCandidates, restSpotsNearRoute, scoreRoutes } from "../services/routes";
import { statusClasses, statusLabels, statusShapes } from "../services/status";
import type { AreaMode, Availability, AvailabilityStatus, Destination, HeatRisk, LatLng, RouteCandidate, RouteScore, Shelter } from "../types/domain";
import { MapView } from "../features/map/MapView";

export function App() {
  const staffShelterId = getStaffShelterId();
  const [areaMode, setAreaMode] = useState<AreaMode>("demo");
  const [currentPosition, setCurrentPosition] = useState<LatLng>(DEMO_AREA_CENTER);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [availability, setAvailability] = useState<Availability[]>(initialAvailability);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [routes, setRoutes] = useState<RouteCandidate[]>([]);
  const [scores, setScores] = useState<RouteScore[]>([]);
  const [heatRisk, setHeatRisk] = useState<HeatRisk | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const mapCenter = areaMode === "demo" ? DEMO_AREA_CENTER : currentPosition;
  const routeScores = useMemo(() => scores.sort((a, b) => b.shadeScore - a.shadeScore), [scores]);
  const bestScore = routeScores[0] ?? null;
  const bestRoute = bestScore ? routes.find((route) => route.id === bestScore.routeId) ?? null : null;
  const shortestRoute = routes.find((route) => route.id === "shortest") ?? null;
  const routeRestSpots = bestRoute ? restSpotsNearRoute(bestRoute) : mockRestSpots;

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      () => {
        setCurrentPosition(TOKYO_FALLBACK_CENTER);
        setMessage("位置情報を取得できないため、東京都心を現在地として表示しています。");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    getHeatRisk(mapCenter).then(setHeatRisk).catch(() => {
      setHeatRisk({
        level: "警戒",
        score: 68,
        wbgt: 29.1,
        observedAt: new Date().toISOString(),
        source: "WBGT取得失敗時のフォールバック"
      });
    });
  }, [mapCenter.lat, mapCenter.lng]);

  useEffect(() => {
    if (!destination) return;

    getRouteCandidates(mapCenter, destination.position).then((nextRoutes) => {
      setRoutes(nextRoutes);
      setScores(scoreRoutes(nextRoutes));
    });
  }, [destination, mapCenter.lat, mapCenter.lng]);

  const availabilityMap = useMemo(() => {
    return new Map(availability.map((item) => [item.shelterId, item]));
  }, [availability]);

  const staffShelter = staffShelterId ? mockShelters.find((item) => item.id === staffShelterId) ?? mockShelters[0] : null;

  function handleAvailabilityChange(shelterId: string, status: AvailabilityStatus) {
    const next = updateAvailability(availability, shelterId, status);
    setAvailability(next);
    setMessage(`空き状況を「${statusLabels[status]}」に更新しました`);
  }

  async function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = await searchDestination(query);
    if (!result) return;

    setDestination(result);
    setSelectedShelter(null);
  }

  function handleShelterRoute(shelter: Shelter) {
    setDestination({
      label: shelter.name,
      position: shelter.position,
      kind: "shelter"
    });
    setSelectedShelter(null);
  }

  if (staffShelter) {
    return (
      <StaffAvailabilityPage
        shelter={staffShelter}
        availability={availabilityMap.get(staffShelter.id)}
        onChange={(status) => handleAvailabilityChange(staffShelter.id, status)}
        message={message}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-200 text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-mist shadow-xl">
        <header className="space-y-3 border-b border-emerald-100 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-leaf">都知事杯オープンデータ・ハッカソン2026</p>
              <h1 className="text-2xl font-bold tracking-normal">涼道ナビTOKYO</h1>
            </div>
            <button
              className="flex min-h-11 items-center gap-2 rounded-md bg-leaf px-3 text-sm font-semibold text-white"
              onClick={() => setAreaMode((mode) => (mode === "demo" ? "current" : "demo"))}
            >
              <LocateFixed size={18} />
              {areaMode === "demo" ? "江東区" : "現在地"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-emerald-50 p-1">
            <button
              className={`min-h-11 rounded px-3 text-sm font-semibold ${areaMode === "current" ? "bg-white shadow-sm" : "text-slate-600"}`}
              onClick={() => setAreaMode("current")}
            >
              現在地モード
            </button>
            <button
              className={`min-h-11 rounded px-3 text-sm font-semibold ${areaMode === "demo" ? "bg-white shadow-sm" : "text-slate-600"}`}
              onClick={() => setAreaMode("demo")}
            >
              デモ保証エリア
            </button>
          </div>

          <form className="flex gap-2" onSubmit={handleSearchSubmit}>
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
              <Search size={18} className="text-slate-500" />
              <input
                className="w-full bg-transparent text-base outline-none"
                placeholder="住所・地名を検索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button className="min-h-11 rounded-md bg-ink px-4 text-sm font-semibold text-white">検索</button>
          </form>

          {heatRisk && (
            <div className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-600" />
                <div>
                  <p className="text-sm font-bold">熱中症リスク {heatRisk.level}</p>
                  <p className="text-xs text-slate-600">WBGT {heatRisk.wbgt} / {heatRisk.source}</p>
                </div>
              </div>
              <strong className="text-xl">{heatRisk.score}</strong>
            </div>
          )}
        </header>

        {areaMode === "current" && mockShelters.length <= DATA_SPARSE_THRESHOLD && (
          <div className="mx-4 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            このエリアはデータが少ない可能性があります。デモ対応エリア（江東区）もお試しください。
          </div>
        )}

        {message && (
          <div className="mx-4 mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
            {message}
          </div>
        )}

        <section className="min-h-[54vh] flex-1">
          <MapView
            center={mapCenter}
            zoom={DEFAULT_ZOOM}
            shelters={mockShelters}
            availability={availabilityMap}
            restSpots={routeRestSpots}
            destination={destination}
            bestRoute={bestRoute}
            shortestRoute={shortestRoute}
            onShelterSelect={setSelectedShelter}
            onMapTap={(position) => {
              setDestination({ label: "地図で指定した場所", position, kind: "tap" });
              setSelectedShelter(null);
            }}
          />
        </section>

        <Legend />

        {destination && bestRoute && bestScore && (
          <RoutePanel
            destination={destination}
            bestRoute={bestRoute}
            shortestRoute={shortestRoute}
            bestScore={bestScore}
          />
        )}

        {selectedShelter && (
          <ShelterSheet
            shelter={selectedShelter}
            availability={availabilityMap.get(selectedShelter.id)}
            onClose={() => setSelectedShelter(null)}
            onRoute={() => handleShelterRoute(selectedShelter)}
          />
        )}
      </div>
    </main>
  );
}

function getStaffShelterId() {
  const match = window.location.pathname.match(/^\/staff\/([^/]+)/);
  return match?.[1] ?? null;
}

function Legend() {
  return (
    <div className="grid grid-cols-3 gap-2 border-t border-emerald-100 bg-white px-4 py-3 text-xs">
      <span><span className="text-sky-600">●</span> 空き</span>
      <span><span className="text-warning">▲</span> やや混雑</span>
      <span><span className="text-slate-500">■</span> 満員</span>
      <span className="flex items-center gap-1"><Trees size={14} /> 公園</span>
      <span className="flex items-center gap-1"><Waves size={14} /> 給水</span>
      <span className="flex items-center gap-1"><Route size={14} /> ルート</span>
    </div>
  );
}

function ShelterSheet({
  shelter,
  availability,
  onClose,
  onRoute
}: {
  shelter: Shelter;
  availability?: Availability;
  onClose: () => void;
  onRoute: () => void;
}) {
  const status = availability?.status ?? "open";
  const stale = availability ? Date.now() - new Date(availability.updatedAt).getTime() > STALE_AVAILABILITY_HOURS * 60 * 60 * 1000 : false;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-[480px] rounded-t-lg bg-white p-4 shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{shelter.name}</h2>
          <p className="text-sm text-slate-600">{shelter.address}</p>
        </div>
        <button className="min-h-11 rounded-md px-3 text-sm font-semibold text-slate-600" onClick={onClose}>閉じる</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Info label="定員" value={`${shelter.capacity}人`} />
        <Info label="開放時間" value={shelter.openHours} />
        <Info label="空き状況" value={`${statusShapes[status]} ${statusLabels[status]}`} />
        <Info label="最終更新" value={availability ? formatTime(availability.updatedAt) : "未更新"} />
      </div>
      {stale && <p className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-900">情報が古い可能性があります。</p>}
      <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-leaf font-bold text-white" onClick={onRoute}>
        <Navigation size={18} />
        ここへ向かう（涼しいルートを見る）
      </button>
    </div>
  );
}

function RoutePanel({
  destination,
  bestRoute,
  shortestRoute,
  bestScore
}: {
  destination: Destination;
  bestRoute: RouteCandidate;
  shortestRoute: RouteCandidate | null;
  bestScore: RouteScore;
}) {
  return (
    <section className="space-y-3 border-t border-emerald-100 bg-white px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-leaf">目的地</p>
          <h2 className="text-lg font-bold">{destination.label}</h2>
        </div>
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-center">
          <p className="text-xs text-slate-600">緑陰スコア</p>
          <strong className="text-2xl text-leaf">{bestScore.shadeScore}</strong>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Info label="涼しいルート" value={`${bestRoute.durationMinutes}分 / ${Math.round(bestRoute.distanceMeters)}m`} />
        <Info label="最短ルート" value={shortestRoute ? `${shortestRoute.durationMinutes}分 / ${Math.round(shortestRoute.distanceMeters)}m` : "取得中"} />
      </div>
      {bestRoute.source === "demo-fallback" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          OpenRouteService未接続のため、デモ用の参考ルートを表示しています。実際の歩行可能経路にするには VITE_ORS_API_KEY または Worker 経由の ORS_API_KEY を設定してください。
        </p>
      )}
      <div className="rounded-md bg-mist p-3">
        <p className="mb-2 text-sm font-bold">このルートがおすすめの理由</p>
        <ul className="space-y-1 text-sm text-slate-700">
          {bestScore.reasons.map((reason) => <li key={reason}>・{reason}</li>)}
        </ul>
      </div>
    </section>
  );
}

function StaffAvailabilityPage({
  shelter,
  availability,
  onChange,
  message
}: {
  shelter: Shelter;
  availability?: Availability;
  onChange: (status: AvailabilityStatus) => void;
  message: string | null;
}) {
  const currentStatus = availability?.status ?? "open";

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-6 text-ink">
      <div className="mx-auto max-w-[480px] space-y-4 rounded-lg bg-white p-5 shadow-xl">
        <div>
          <p className="text-sm font-semibold text-leaf">施設スタッフ用</p>
          <h1 className="text-2xl font-bold">{shelter.name}</h1>
          <p className="text-sm text-slate-600">現在: {statusLabels[currentStatus]} / 最終更新 {availability ? formatTime(availability.updatedAt) : "未更新"}</p>
        </div>
        {message && <p className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">{message}</p>}
        <div className="grid gap-3">
          {(["open", "busy", "full"] as AvailabilityStatus[]).map((status) => (
            <button
              key={status}
              className={`min-h-14 rounded-md text-lg font-bold ${statusClasses[status]}`}
              onClick={() => onChange(status)}
            >
              {statusShapes[status]} {statusLabels[status]}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">デモ用の簡易更新画面です。本番では正式な認証と権限管理が必要です。</p>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}
