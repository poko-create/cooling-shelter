import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, LocateFixed, Navigation, Route, Search, Snowflake, Trees, Waves } from "lucide-react";
import { DATA_SPARSE_THRESHOLD, DEFAULT_ZOOM, DEMO_AREA_CENTER, TOKYO_FALLBACK_CENTER } from "../config/area";
import { STALE_AVAILABILITY_HOURS } from "../config/scoring";
import { initialAvailability, mockRestSpots, mockShelters, mockTrees } from "../data/mock/shelters";
import { updateAvailability } from "../services/availabilityStore";
import { searchDestination } from "../services/destinationSearch";
import { getHeatRisk } from "../services/heatRisk";
import { loadOpenData } from "../services/openData";
import { getRouteCandidates, restSpotsNearRoute, scoreRoutes } from "../services/routes";
import { statusClasses, statusLabels, statusShapes } from "../services/status";
import { getDemoBuildingShadows } from "../services/buildingShade";
import type { AreaMode, Availability, AvailabilityStatus, Destination, HeatRisk, LatLng, RestSpot, RouteCandidate, RouteScore, Shelter, TreePoint } from "../types/domain";
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
  const [shelters, setShelters] = useState<Shelter[]>(mockShelters);
  const [restSpots, setRestSpots] = useState<RestSpot[]>(mockRestSpots);
  const [trees, setTrees] = useState<TreePoint[]>(mockTrees);
  const [openDataSource, setOpenDataSource] = useState<"open-data" | "mock-fallback">("mock-fallback");
  const [showBuildingShade, setShowBuildingShade] = useState(true);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const mapCenter = areaMode === "demo" ? DEMO_AREA_CENTER : currentPosition;
  const routeScores = useMemo(() => scores.sort((a, b) => b.shadeScore - a.shadeScore), [scores]);
  const bestScore = routeScores[0] ?? null;
  const bestRoute = bestScore ? routes.find((route) => route.id === bestScore.routeId) ?? null : null;
  const shortestRoute = routes.find((route) => route.id === "shortest") ?? null;
  const routeRestSpots = bestRoute ? restSpotsNearRoute(bestRoute, restSpots) : restSpots;
  const buildingShadows = useMemo(() => getDemoBuildingShadows(), []);

  useEffect(() => {
    loadOpenData().then((data) => {
      setShelters(data.shelters);
      setTrees(data.trees);
      setRestSpots(data.restSpots);
      setOpenDataSource(data.source);
      if (data.source === "open-data") {
        setMessage("東京都オープンデータを読み込みました。");
      } else {
        setMessage("オープンデータ取得に失敗したため、デモデータを表示しています。");
      }
    });
  }, []);

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
      setScores(scoreRoutes(nextRoutes, trees, restSpots));
    });
  }, [destination, mapCenter.lat, mapCenter.lng, restSpots, trees]);

  const availabilityMap = useMemo(() => {
    return new Map(availability.map((item) => [item.shelterId, item]));
  }, [availability]);

  const staffShelter = staffShelterId ? shelters.find((item) => item.id === staffShelterId) ?? shelters[0] : null;

  function handleAvailabilityChange(shelterId: string, status: AvailabilityStatus) {
    const next = updateAvailability(availability, shelterId, status);
    setAvailability(next);
    setMessage(`空き状況を「${statusLabels[status]}」に更新しました`);
  }

  async function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = await searchDestination(query, [...shelters, ...restSpots]);
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
    <main className="min-h-screen bg-gradient-to-br from-aqua-50 via-frost-50 to-aqua-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-white/60 shadow-glass backdrop-blur-sm">
        <header className="space-y-4 px-4 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="badge-cool">
                <Snowflake size={12} />
                都知事杯オープンデータ・ハッカソン2026
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">
                涼道ナビ<span className="text-aqua-500">TOKYO</span>
              </h1>
              <p className="text-xs text-glacial-400">
                {openDataSource === "open-data" ? "東京都オープンデータ接続中" : "デモデータ表示中"}
              </p>
            </div>
            <button
              className="btn-cool flex items-center gap-2 text-sm"
              onClick={() => setAreaMode((mode) => (mode === "demo" ? "current" : "demo"))}
            >
              <LocateFixed size={16} />
              {areaMode === "demo" ? "江東区" : "現在地"}
            </button>
          </div>

          <div className="flex gap-1 rounded-2xl bg-aqua-50/80 p-1">
            <button
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-300 ${
                areaMode === "current"
                  ? "bg-white text-aqua-600 shadow-frost"
                  : "text-glacial-400 hover:text-glacial-600"
              }`}
              onClick={() => setAreaMode("current")}
            >
              現在地モード
            </button>
            <button
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-300 ${
                areaMode === "demo"
                  ? "bg-white text-aqua-600 shadow-frost"
                  : "text-glacial-400 hover:text-glacial-600"
              }`}
              onClick={() => setAreaMode("demo")}
            >
              デモ保証エリア
            </button>
          </div>

          <form className="flex gap-2" onSubmit={handleSearchSubmit}>
            <div className="flex flex-1 items-center gap-2">
              <Search size={18} className="text-aqua-400" />
              <input
                className="input-frost flex-1"
                placeholder="住所・地名を検索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button className="btn-cool px-5 py-2.5 text-sm">検索</button>
          </form>

          {heatRisk && (
            <div className="card-frost flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">熱中症リスク {heatRisk.level}</p>
                  <p className="text-xs text-glacial-400">WBGT {heatRisk.wbgt} / {heatRisk.source}</p>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50">
                <strong className="text-xl font-bold text-amber-600">{heatRisk.score}</strong>
              </div>
            </div>
          )}

          <button
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-300 ${
              showBuildingShade
                ? "border-aqua-200 bg-gradient-to-r from-aqua-500 to-frost-500 text-white shadow-frost"
                : "border-glacial-200 bg-white/80 text-glacial-600 hover:border-aqua-200 hover:bg-aqua-50/50"
            }`}
            onClick={() => setShowBuildingShade((current) => !current)}
          >
            <span className="flex items-center gap-2">
              <Building2 size={18} />
              建物日陰の目安
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              showBuildingShade ? "bg-white/20 text-white" : "bg-glacial-100 text-glacial-500"
            }`}>
              {showBuildingShade ? "表示中" : "非表示"}
            </span>
          </button>

          {showBuildingShade && (
            <div className="rounded-2xl bg-aqua-50/60 px-4 py-3 text-xs leading-relaxed text-glacial-500">
              江東区デモ限定の参考レイヤーです。固定日時の建物高さ目安から日陰を面で描画しており、緑陰スコアにはまだ反映していません。
            </div>
          )}

          <div className="separator-cool" />
        </header>

        {areaMode === "current" && shelters.length <= DATA_SPARSE_THRESHOLD && (
          <div className="mx-4 animate-fade-in rounded-2xl border border-amber-200/50 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 text-sm text-amber-800">
            このエリアはデータが少ない可能性があります。デモ対応エリア（江東区）もお試しください。
          </div>
        )}

        {message && (
          <div className="mx-4 mt-3 animate-fade-in rounded-2xl bg-gradient-to-r from-glacial-800 to-glacial-900 px-4 py-3 text-sm text-white shadow-lg">
            {message}
          </div>
        )}

        <section className="min-h-[54vh] flex-1">
          <MapView
            center={mapCenter}
            zoom={DEFAULT_ZOOM}
            shelters={shelters}
            availability={availabilityMap}
            restSpots={routeRestSpots}
            buildingShadows={buildingShadows}
            showBuildingShade={showBuildingShade}
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
    <div className="grid grid-cols-3 gap-3 border-t border-aqua-100/50 bg-white/50 px-4 py-3 text-xs backdrop-blur-sm">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-aqua-500" />
        <span className="text-glacial-500">空き</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0 w-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-amber-400" />
        <span className="text-glacial-500">やや混雑</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-glacial-400" />
        <span className="text-glacial-500">満員</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Trees size={14} className="text-frost-500" />
        <span className="text-glacial-500">公園</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Waves size={14} className="text-aqua-400" />
        <span className="text-glacial-500">給水</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Building2 size={14} className="text-glacial-400" />
        <span className="text-glacial-500">建物日陰</span>
      </span>
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
    <div className="animate-slide-up fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-[480px] rounded-t-3xl bg-white/90 p-5 shadow-glass-lg backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-ink">{shelter.name}</h2>
          <p className="text-sm text-glacial-400">{shelter.address}</p>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-glacial-100 text-glacial-500 transition-colors hover:bg-glacial-200 hover:text-glacial-700"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Info label="定員" value={`${shelter.capacity}人`} />
        <Info label="開放時間" value={shelter.openHours} />
        <Info label="空き状況" value={`${statusShapes[status]} ${statusLabels[status]}`} />
        <Info label="最終更新" value={availability ? formatTime(availability.updatedAt) : "未更新"} />
      </div>
      {stale && (
        <div className="mt-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-sm text-amber-700">
          情報が古い可能性があります。
        </div>
      )}
      <button className="btn-cool mt-4 flex w-full items-center justify-center gap-2 py-3.5" onClick={onRoute}>
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
    <section className="animate-slide-up space-y-4 border-t border-aqua-100/50 bg-white/70 px-4 py-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="badge-cool w-fit">
            <Navigation size={12} />
            目的地
          </p>
          <h2 className="text-lg font-bold text-ink">{destination.label}</h2>
        </div>
        <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-aqua-50 to-frost-50 px-4 py-2.5">
          <p className="text-xs text-glacial-400">緑陰スコア</p>
          <strong className="text-2xl font-extrabold text-aqua-600">{bestScore.shadeScore}</strong>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Info label="涼しいルート" value={`${bestRoute.durationMinutes}分 / ${Math.round(bestRoute.distanceMeters)}m`} />
        <Info label="最短ルート" value={shortestRoute ? `${shortestRoute.durationMinutes}分 / ${Math.round(shortestRoute.distanceMeters)}m` : "取得中"} />
      </div>
      {bestRoute.source === "demo-fallback" && (
        <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-xs text-amber-700">
          OpenRouteService未接続のため、デモ用の参考ルートを表示しています。実際の歩行可能経路にするには VITE_ORS_API_KEY または Worker 経由の ORS_API_KEY を設定してください。
        </div>
      )}
      <div className="card-frost">
        <p className="mb-2 text-sm font-bold text-ink">このルートがおすすめの理由</p>
        <ul className="space-y-1 text-sm text-glacial-600">
          {bestScore.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5">
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-aqua-400" />
              {reason}
            </li>
          ))}
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
    <main className="min-h-screen bg-gradient-to-br from-aqua-50 via-frost-50 to-aqua-100 px-4 py-6">
      <div className="mx-auto max-w-[480px] space-y-5 rounded-3xl bg-white/80 p-6 shadow-glass backdrop-blur-xl">
        <div className="space-y-1">
          <p className="badge-cool w-fit">
            <Snowflake size={12} />
            施設スタッフ用
          </p>
          <h1 className="text-2xl font-extrabold text-ink">{shelter.name}</h1>
          <p className="text-sm text-glacial-400">
            現在: {statusLabels[currentStatus]} / 最終更新 {availability ? formatTime(availability.updatedAt) : "未更新"}
          </p>
        </div>
        {message && (
          <div className="rounded-2xl bg-gradient-to-r from-glacial-800 to-glacial-900 px-4 py-3 text-sm text-white shadow-lg">
            {message}
          </div>
        )}
        <div className="grid gap-3">
          {(["open", "busy", "full"] as AvailabilityStatus[]).map((status) => (
            <button
              key={status}
              className={`min-h-14 rounded-2xl text-lg font-bold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] ${statusClasses[status]}`}
              onClick={() => onChange(status)}
            >
              {statusShapes[status]} {statusLabels[status]}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-glacial-400">
          デモ用の簡易更新画面です。本番では正式な認証と権限管理が必要です。
        </p>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-aqua-50/60 p-3">
      <p className="text-xs text-glacial-400">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}
