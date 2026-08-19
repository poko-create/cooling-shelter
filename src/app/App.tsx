import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CloudSun, LocateFixed, Navigation, Route, Search, Snowflake, SunMedium, Trees, Waves, Wind } from "lucide-react";
import * as turf from "@turf/turf";
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
import type { AreaMode, Availability, AvailabilityStatus, Destination, HeatRisk, LatLng, RestSpot, RouteCandidate, RouteScore, Shelter, TreePoint, Poi } from "../types/domain";
import { fetchConvenienceStores } from "../services/places";
import { MapView } from "../features/map/MapView";

export function App() {
  const staffShelterId = getStaffShelterId();
  const [areaMode, setAreaMode] = useState<AreaMode>("demo");
  const [currentPosition, setCurrentPosition] = useState<LatLng>(DEMO_AREA_CENTER);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
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
  const [showConvenienceStores, setShowConvenienceStores] = useState(true);
  const [showParkSpots, setShowParkSpots] = useState(true);
  const [showWaterSpots, setShowWaterSpots] = useState(true);
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const mapCenter = areaMode === "demo" ? DEMO_AREA_CENTER : currentPosition;
  const routeScores = useMemo(() => scores.sort((a, b) => b.shadeScore - a.shadeScore), [scores]);
  const bestScore = routeScores[0] ?? null;
  const bestRoute = bestScore ? routes.find((route) => route.id === bestScore.routeId) ?? null : null;
  const shortestRoute = routes.find((route) => route.id === "shortest") ?? null;
  const routeRestSpots = bestRoute ? restSpotsNearRoute(bestRoute, restSpots) : restSpots;
  const buildingShadows = useMemo(() => getDemoBuildingShadows(), []);
  const [pois, setPois] = useState<Poi[]>([]);

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
        temperature: 29.0,
        humidity: 65,
        windSpeed: 2.0,
        apparentTemperature: 32.0,
        uvIndex: 6.0,
        wbgt: 29.1,
        observedAt: new Date().toISOString(),
        source: "WBGT取得失敗時のフォールバック"
      });
    });
  }, [mapCenter.lat, mapCenter.lng]);

  useEffect(() => {
    fetchConvenienceStores(mapCenter, 800).then(setPois).catch(() => setPois([]));
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
    setShowSearchSuggestions(false);
  }

  function handleSuggestionSelect(item: Shelter | RestSpot) {
    setQuery(item.name);
    setDestination({ label: item.name, position: item.position, kind: "search" });
    setSelectedShelter(null);
  }

  const searchSuggestions = useMemo(() => {
    if (!showSearchSuggestions) return [];
    return [...shelters, ...restSpots].sort((a, b) => {
      const da = turf.distance([mapCenter.lng, mapCenter.lat], [a.position.lng, a.position.lat], { units: "kilometers" });
      const db = turf.distance([mapCenter.lng, mapCenter.lat], [b.position.lng, b.position.lat], { units: "kilometers" });
      return da - db;
    });
  }, [showSearchSuggestions, mapCenter.lat, mapCenter.lng, shelters, restSpots]);

  async function handleStationSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!locationQuery.trim()) return;
    const result = await searchDestination(locationQuery, [...shelters, ...restSpots]);
    if (!result) {
      setMessage(`「${locationQuery}」が見つかりません`);
      return;
    }
    setCurrentPosition(result.position);
    setLocationQuery(result.label);
    setMessage(`現在地を「${result.label}」に設定しました`);
  }

  function handleShelterRoute(shelter: Shelter) {
    setDestination({
      label: shelter.name,
      position: shelter.position,
      kind: "shelter"
    });
    setSelectedShelter(null);
  }

  function handlePoiRoute(poi: Poi) {
    setDestination({
      label: poi.name,
      position: poi.position,
      kind: "search"
    });
    setSelectedPoi(null);
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
        <header className="space-y-3 border-b border-aqua-100/50 bg-white/70 px-4 py-4 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1 text-xs font-semibold text-aqua-600"><Snowflake size={12} /> 都知事杯オープンデータ・ハッカソン2026</p>
              <h1 className="text-2xl font-bold tracking-normal">涼道ナビ<span className="text-aqua-500">TOKYO</span></h1>
              <p className="text-xs text-glacial-400">
                {openDataSource === "open-data" ? "東京都オープンデータ接続中" : "デモデータ表示中"}
              </p>
            </div>
            <button
              className="flex min-h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-aqua-500 to-frost-500 px-3 text-sm font-semibold text-white shadow-frost"
              onClick={() => setAreaMode((mode) => (mode === "demo" ? "current" : "demo"))}
            >
              <LocateFixed size={18} />
              {areaMode === "demo" ? "江東区" : "現在地"}
            </button>
          </div>

          <div className="flex gap-1 rounded-2xl bg-aqua-50/80 p-1">
            <button
              className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition-all ${
                areaMode === "current" ? "bg-white text-aqua-600 shadow-frost" : "text-glacial-500"
              }`}
              onClick={() => setAreaMode("current")}
            >
              現在地モード
            </button>
            <button
              className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition-all ${
                areaMode === "demo" ? "bg-white text-aqua-600 shadow-frost" : "text-glacial-500"
              }`}
              onClick={() => setAreaMode("demo")}
            >
              デモ保証エリア
            </button>
          </div>

          {heatRisk && (
            <div className="rounded-2xl bg-amber-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-600" />
                  <p className="text-sm font-bold">熱中症リスク {heatRisk.level}</p>
                </div>
                <div className="text-right">
                  <strong className="block text-xl leading-none">{heatRisk.score}</strong>
                  <span className="text-[10px] text-slate-500">指標</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <WeatherCard icon={<CloudSun size={16} className="text-amber-500" />} label="気温" value={`${heatRisk.temperature.toFixed(1)}℃`} />
                <WeatherCard icon={<Wind size={16} className="text-sky-500" />} label="風速" value={`${heatRisk.windSpeed.toFixed(1)}m/s`} />
                <WeatherCard icon={<SunMedium size={16} className="text-orange-500" />} label="UV" value={`${heatRisk.uvIndex.toFixed(1)}`} />
                <WeatherCard icon={<AlertTriangle size={16} className="text-rose-500" />} label="体感" value={`${heatRisk.apparentTemperature.toFixed(1)}℃`} />
                <WeatherCard icon={<Waves size={16} className="text-cyan-500" />} label="湿度" value={`${heatRisk.humidity}%`} />
                <WeatherCard icon={<Route size={16} className="text-emerald-600" />} label="WBGT" value={`${heatRisk.wbgt.toFixed(1)}`} />
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{heatRisk.source}</p>
            </div>
          )}

          <form className="flex gap-2" onSubmit={handleStationSearch}>
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl border border-aqua-200/60 bg-white/70 px-3 backdrop-blur-sm">
              <Navigation size={18} className="text-aqua-400" />
              <input
                className="w-full bg-transparent text-base outline-none"
                placeholder="現在地（駅・コンビニ・建物など）"
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
              />
            </label>
            <button className="min-h-11 rounded-2xl bg-gradient-to-r from-aqua-500 to-frost-500 px-4 text-sm font-semibold text-white shadow-frost">設定</button>
          </form>

          <form className="relative flex gap-2" onSubmit={handleSearchSubmit}>
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl border border-aqua-200/60 bg-white/70 px-3 backdrop-blur-sm">
              <Search size={18} className="text-aqua-400" />
              <input
                className="w-full bg-transparent text-base outline-none"
                placeholder="クーリングシェルター・給水スポットを検索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
              />
            </label>
            <button className="min-h-11 rounded-2xl bg-ink px-4 text-sm font-semibold text-white">検索</button>
            {showSearchSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-aqua-100 bg-white shadow-frost">
                {searchSuggestions.map((item) => {
                  const dist = turf.distance([mapCenter.lng, mapCenter.lat], [item.position.lng, item.position.lat], { units: "kilometers" });
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-aqua-50"
                      onMouseDown={() => handleSuggestionSelect(item)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          {"type" in item && <div className="text-xs text-slate-500">{item.type === "park" ? "公園" : "給水スポット"}</div>}
                        </div>
                        <div className="ml-2 text-xs text-slate-400">{dist.toFixed(2)} km</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </form>

          <button
            className={`flex min-h-11 w-full items-center justify-between rounded-2xl border px-3 text-sm font-semibold transition-all ${
              showBuildingShade
                ? "border-glacial-700 bg-gradient-to-r from-glacial-800 to-glacial-900 text-white"
                : "border-glacial-200 bg-white/80 text-glacial-600 hover:border-aqua-200 hover:bg-aqua-50/50"
            }`}
            onClick={() => setShowBuildingShade((current) => !current)}
          >
            <span className="flex items-center gap-2">
              <Building2 size={18} />
              建物日陰の目安
            </span>
            <span>{showBuildingShade ? "表示中" : "非表示"}</span>
          </button>

          <button
            className={`flex min-h-11 w-full items-center justify-between rounded-md border px-3 text-sm font-semibold ${
              showConvenienceStores
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setShowConvenienceStores((current) => !current)}
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[10px] font-black text-orange-500">CV</span>
              コンビニ
            </span>
            <span>{showConvenienceStores ? "表示中" : "非表示"}</span>
          </button>

          <button
            className={`flex min-h-11 w-full items-center justify-between rounded-md border px-3 text-sm font-semibold ${
              showParkSpots
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setShowParkSpots((current) => !current)}
          >
            <span className="flex items-center gap-2">
              <Trees size={16} />
              公園
            </span>
            <span>{showParkSpots ? "表示中" : "非表示"}</span>
          </button>

          <button
            className={`flex min-h-11 w-full items-center justify-between rounded-md border px-3 text-sm font-semibold ${
              showWaterSpots
                ? "border-sky-500 bg-sky-500 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setShowWaterSpots((current) => !current)}
          >
            <span className="flex items-center gap-2">
              <Waves size={16} />
              給水スポット
            </span>
            <span>{showWaterSpots ? "表示中" : "非表示"}</span>
          </button>

          {showBuildingShade && (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              江東区デモ限定の参考レイヤーです。固定日時の建物高さ目安から日陰を面で描画しており、緑陰スコアにはまだ反映していません。
            </p>
          )}
        </header>

        {areaMode === "current" && shelters.length <= DATA_SPARSE_THRESHOLD && (
          <div className="mx-4 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
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
            convenienceStores={pois}
            onPoiSelect={setSelectedPoi}
            buildingShadows={buildingShadows}
            showBuildingShade={showBuildingShade}
            showConvenienceStores={showConvenienceStores}
            showParkSpots={showParkSpots}
            showWaterSpots={showWaterSpots}
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
        {selectedPoi && (
          <PoiSheet
            poi={selectedPoi}
            center={mapCenter}
            onClose={() => setSelectedPoi(null)}
            onRoute={() => handlePoiRoute(selectedPoi)}
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
      <span className="flex items-center gap-1"><Building2 size={14} /> 建物日陰</span>
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

function computeDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function PoiSheet({
  poi,
  center,
  onClose,
  onRoute
}: {
  poi: Poi;
  center: { lat: number; lng: number };
  onClose: () => void;
  onRoute: () => void;
}) {
  const distance = Math.round(computeDistanceMeters(center, poi.position));

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-[480px] rounded-t-lg bg-white p-4 shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{poi.name}</h2>
          <p className="text-sm text-slate-600">カテゴリ: {poi.category}</p>
        </div>
        <button className="min-h-11 rounded-md px-3 text-sm font-semibold text-slate-600" onClick={onClose}>閉じる</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Info label="距離" value={`${distance}m`} />
        <Info label="提供元" value={poi.source} />
      </div>
      <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-leaf font-bold text-white" onClick={onRoute}>
        <Navigation size={18} />
        ここへ向かう（ルート表示）
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

function WeatherCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-amber-100 bg-white/70 p-2 text-center shadow-sm">
      <div className="mb-1 flex justify-center">{icon}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="font-bold text-slate-800">{value}</div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}
