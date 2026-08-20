import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CloudSun, LocateFixed, Navigation, Route, Search, Snowflake, SunMedium, Trees, Waves, Wind } from "lucide-react";
import * as turf from "@turf/turf";
import { DATA_SPARSE_THRESHOLD, DEFAULT_ZOOM, DEMO_AREA_CENTER, DEMO_CURRENT_POSITION, TOKYO_FALLBACK_CENTER } from "../config/area";
import { STALE_AVAILABILITY_HOURS } from "../config/scoring";
import { initialAvailability, mockRestSpots, mockShelters, mockTrees } from "../data/mock/shelters";
import { updateAvailability } from "../services/availabilityStore";
import { searchDestination, searchDestinationSuggestions } from "../services/destinationSearch";
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
  const [currentPosition, setCurrentPosition] = useState<LatLng>(DEMO_CURRENT_POSITION);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [selectedRestSpot, setSelectedRestSpot] = useState<RestSpot | null>(null);
  const [selectedMapTap, setSelectedMapTap] = useState<LatLng | null>(null);
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
  const [showShelters, setShowShelters] = useState(true);
  const [showConvenienceStores, setShowConvenienceStores] = useState(true);
  const [showParkSpots, setShowParkSpots] = useState(true);
  const [showWaterSpots, setShowWaterSpots] = useState(true);
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [heatRiskExpanded, setHeatRiskExpanded] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<Destination[]>([]);

  const [message, setMessage] = useState<string | null>(null);
  const mapCenter = areaMode === "demo" ? DEMO_CURRENT_POSITION : currentPosition;
  const mapViewCenter = areaMode === "demo" ? DEMO_AREA_CENTER : currentPosition;
  const routeScores = useMemo(() => [...scores].sort((a, b) => b.shadeScore - a.shadeScore), [scores]);
  const bestScore = routeScores.find((score) => score.routeId !== "shortest") ?? routeScores[0] ?? null;
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
    const timer = setTimeout(() => {
      fetchConvenienceStores(mapCenter, 800).then(setPois).catch(() => setPois([]));
    }, 1500);
    return () => clearTimeout(timer);
  }, [mapCenter.lat, mapCenter.lng]);

  useEffect(() => {
    if (!destination) return;

    getRouteCandidates(mapCenter, destination.position).then((nextRoutes) => {
      setRoutes(nextRoutes);
      setScores(scoreRoutes(nextRoutes, trees, restSpots, buildingShadows));
    });
  }, [buildingShadows, destination, mapCenter.lat, mapCenter.lng, restSpots, trees]);

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
    const result = await searchDestination(query, [...shelters, ...restSpots, ...pois], mapCenter);
    if (!result) return;
    setDestination(result);
    setSelectedShelter(null);
    setShowSearchSuggestions(false);
  }

  function handleSuggestionSelect(item: Shelter | RestSpot | Poi) {
    setQuery(item.name);
    setDestination({ label: item.name, position: item.position, kind: "search" });
    setSelectedShelter(null);
  }

  const searchSuggestions = useMemo(() => {
    if (!showSearchSuggestions) return [];
    const visibleShelters = showShelters ? shelters : [];
    const visibleRestSpots = restSpots.filter(spot =>
      (spot.type === 'park' && showParkSpots) ||
      (spot.type === 'water' && showWaterSpots)
    );
    const visiblePois = showConvenienceStores ? pois : [];
    return [...visibleShelters, ...visibleRestSpots, ...visiblePois].sort((a, b) => {
      const da = turf.distance([mapCenter.lng, mapCenter.lat], [a.position.lng, a.position.lat], { units: "kilometers" });
      const db = turf.distance([mapCenter.lng, mapCenter.lat], [b.position.lng, b.position.lat], { units: "kilometers" });
      return da - db;
    });
  }, [showSearchSuggestions, mapCenter.lat, mapCenter.lng, shelters, restSpots, pois, showShelters, showParkSpots, showWaterSpots, showConvenienceStores]);

  const locationSuggestions = useMemo(() => {
    if (!showLocationSuggestions) return [];
    const q = locationQuery.toLowerCase().trim();
    if (!q) return [];

    const visibleShelters = showShelters ? shelters : [];
    const visibleRestSpots = restSpots.filter(spot =>
      (spot.type === 'park' && showParkSpots) ||
      (spot.type === 'water' && showWaterSpots)
    );
    const visiblePois = showConvenienceStores ? pois : [];

    const allItems: Array<Shelter | RestSpot | Poi> = [...visibleShelters, ...visibleRestSpots, ...visiblePois];
    const filtered = allItems.filter(item => item.name.toLowerCase().includes(q));
    return filtered.sort((a, b) => {
      const da = turf.distance([mapCenter.lng, mapCenter.lat], [a.position.lng, a.position.lat], { units: "kilometers" });
      const db = turf.distance([mapCenter.lng, mapCenter.lat], [b.position.lng, b.position.lat], { units: "kilometers" });
      return da - db;
    }).slice(0, 12);
  }, [showLocationSuggestions, locationQuery, shelters, restSpots, pois, mapCenter.lat, mapCenter.lng, showShelters, showParkSpots, showWaterSpots, showConvenienceStores]);

  const combinedLocationSuggestions = useMemo(() => {
    return [...locationSuggestions, ...placeSuggestions].slice(0, 18);
  }, [locationSuggestions, placeSuggestions]);

  useEffect(() => {
    const q = locationQuery.trim();
    if (!showLocationSuggestions || q.length < 2) {
      setPlaceSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      searchDestinationSuggestions(q, mapCenter).then((items) => {
        if (!cancelled) setPlaceSuggestions(items);
      }).catch(() => {
        if (!cancelled) setPlaceSuggestions([]);
      });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locationQuery, mapCenter.lat, mapCenter.lng, showLocationSuggestions]);

  async function handleStationSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!locationQuery.trim()) return;
    const result = await searchDestination(locationQuery, [...shelters, ...restSpots, ...pois], mapCenter);
    if (!result) {
      setMessage(`「${locationQuery}」が見つかりません`);
      return;
    }
    setDestination({ label: result.label, position: result.position, kind: "search" });
    setShowLocationSuggestions(false);
    setSelectedShelter(null);
  }

  function handleLocationSuggestionSelect(item: Shelter | RestSpot | Poi | Destination) {
    const label = "label" in item ? item.label : item.name;
    setLocationQuery(label);
    setDestination({ label, position: item.position, kind: "search" });
    setShowLocationSuggestions(false);
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
    <main className="min-h-screen bg-gradient-to-br from-aqua-50 via-frost-50 to-ice-50">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-white/70 shadow-glass-lg backdrop-blur-sm">
        <header className="space-y-3 border-b border-aqua-200/60 px-4 py-4" style={{ background: 'linear-gradient(135deg, rgba(204,251,241,0.95) 0%, rgba(165,243,252,0.9) 40%, rgba(224,242,254,0.92) 100%)', backdropFilter: 'blur(20px) saturate(180%)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Snowflake size={12} className="text-aqua-600 animate-pulse-soft" />
                <p className="text-[10px] font-bold tracking-wider text-aqua-700 uppercase">都知事杯オープンデータ・ハッカソン2026</p>
              </div>
              <h1 className="text-[22px] font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-aqua-800 via-frost-700 to-aqua-700 bg-clip-text text-transparent">涼道ナビ</span>
                <span className="text-glacial-600 font-bold ml-0.5">TOKYO</span>
              </h1>
              <p className="text-[10px] text-glacial-600 mt-0.5 font-semibold">
                {openDataSource === "open-data" ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse-soft" />
                    東京都オープンデータ接続中
                  </span>
                ) : "デモデータ表示中"}
              </p>
            </div>
            <button
              className="flex min-h-10 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-aqua-700 to-frost-700 px-3.5 py-2 text-xs font-bold text-white shadow-frost transition-all hover:shadow-frost-lg hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => setAreaMode((mode) => (mode === "demo" ? "current" : "demo"))}
            >
              <LocateFixed size={15} />
              {areaMode === "demo" ? "江東区" : "現在地"}
            </button>
          </div>

          <div className="flex gap-1 rounded-2xl bg-aqua-200/40 p-1">
            <button
              className={`min-h-10 flex-1 rounded-xl px-3 text-xs font-bold transition-all duration-300 ${
                areaMode === "current"
                  ? "bg-white text-aqua-800 shadow-frost"
                  : "text-glacial-600 hover:text-glacial-800"
              }`}
              onClick={() => setAreaMode("current")}
            >
              現在地モード
            </button>
            <button
              className={`min-h-10 flex-1 rounded-xl px-3 text-xs font-bold transition-all duration-300 ${
                areaMode === "demo"
                  ? "bg-white text-aqua-800 shadow-frost"
                  : "text-glacial-600 hover:text-glacial-800"
              }`}
              onClick={() => setAreaMode("demo")}
            >
              デモ保証エリア
            </button>
          </div>

          {heatRisk && (
            <button
              type="button"
              className="w-full rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-orange-50/50 to-amber-50 p-3 text-left backdrop-blur-sm transition-all hover:shadow-frost-sm"
              onClick={() => setHeatRiskExpanded((v) => !v)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-900">熱中症リスク</p>
                    <p className="text-[10px] font-bold text-amber-600">{heatRisk.level}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <strong className="block text-xl font-extrabold leading-none text-amber-800">{heatRisk.score}</strong>
                    <span className="text-[9px] font-semibold text-amber-600">指標</span>
                  </div>
                  <span className="text-xs text-amber-500 transition-transform duration-300" style={{ transform: heatRiskExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </div>
              </div>
              {heatRiskExpanded && (
                <div className="mt-3 animate-fade-in">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <WeatherCard icon={<CloudSun size={15} className="text-amber-500" />} label="気温" value={`${heatRisk.temperature.toFixed(1)}℃`} />
                    <WeatherCard icon={<Wind size={15} className="text-ice-600" />} label="風速" value={`${heatRisk.windSpeed.toFixed(1)}m/s`} />
                    <WeatherCard icon={<SunMedium size={15} className="text-orange-500" />} label="UV" value={`${heatRisk.uvIndex.toFixed(1)}`} />
                    <WeatherCard icon={<AlertTriangle size={15} className="text-rose-500" />} label="体感" value={`${heatRisk.apparentTemperature.toFixed(1)}℃`} />
                    <WeatherCard icon={<Waves size={15} className="text-aqua-500" />} label="湿度" value={`${heatRisk.humidity}%`} />
                    <WeatherCard icon={<Route size={15} className="text-frost-700" />} label="WBGT" value={`${heatRisk.wbgt.toFixed(1)}`} />
                  </div>
                  <p className="mt-2 text-[9px] text-amber-600">{heatRisk.source}</p>
                </div>
              )}
            </button>
          )}

          <form className="relative" onSubmit={handleStationSearch}>
            <label className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl border border-aqua-300/50 bg-white/70 px-3.5 backdrop-blur-md transition-all focus-within:border-aqua-400 focus-within:bg-white/90 focus-within:shadow-frost-sm">
              <Navigation size={16} className="text-aqua-600 flex-shrink-0" />
              <input
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-glacial-500"
                placeholder="目的地を検索（駅・コンビニ・施設など）"
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                onFocus={() => setShowLocationSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
              />
            </label>
            {showLocationSuggestions && combinedLocationSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-aqua-200/50 bg-white/95 shadow-glass-lg backdrop-blur-xl animate-slide-down">
                {combinedLocationSuggestions.map((item) => {
                  const dist = turf.distance([mapCenter.lng, mapCenter.lat], [item.position.lng, item.position.lat], { units: "kilometers" });
                  const name = "label" in item ? item.label : item.name;
                  const typeLabel = "label" in item ? "駅・地名"
                    : "capacity" in item ? "クーリングシェルター"
                      : "type" in item ? (item.type === "park" ? "公園" : "給水スポット")
                        : "コンビニ";
                  return (
                    <button
                      key={"id" in item ? item.id : `${item.label}-${item.position.lat}-${item.position.lng}`}
                      type="button"
                      className="w-full border-b border-slate-200/60 px-3.5 py-2.5 text-left text-sm last:border-b-0 hover:bg-aqua-50 transition-colors"
                      onMouseDown={() => handleLocationSuggestionSelect(item)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-ink truncate">{name}</div>
                          <div className="text-[10px] text-glacial-500 font-medium">{typeLabel}</div>
                        </div>
                        <div className="text-[10px] font-semibold text-glacial-500 flex-shrink-0">{dist.toFixed(2)} km</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </form>

          <form className="relative" onSubmit={handleSearchSubmit}>
            <label className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl border border-aqua-300/50 bg-white/70 px-3.5 backdrop-blur-md transition-all focus-within:border-aqua-400 focus-within:bg-white/90 focus-within:shadow-frost-sm">
              <Search size={16} className="text-aqua-600 flex-shrink-0" />
              <input
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-glacial-500"
                placeholder="クーリングシェルター・給水スポットを検索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                readOnly
              />
            </label>
            {showSearchSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-aqua-200/50 bg-white/95 shadow-glass-lg backdrop-blur-xl animate-slide-down">
                {searchSuggestions.map((item) => {
                  const dist = turf.distance([mapCenter.lng, mapCenter.lat], [item.position.lng, item.position.lat], { units: "kilometers" });
                  let label = '';
                  if ('type' in item) {
                    label = item.type === 'park' ? '公園' : '給水スポット';
                  } else if ('category' in item) {
                    label = 'コンビニ';
                  } else {
                    label = 'クーリングシェルター';
                  }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full border-b border-slate-200/60 px-3.5 py-2.5 text-left text-sm last:border-b-0 hover:bg-aqua-50 transition-colors"
                      onMouseDown={() => handleSuggestionSelect(item)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-ink truncate">{item.name}</div>
                          <div className="text-[10px] text-glacial-500 font-medium">{label}</div>
                        </div>
                        <div className="text-[10px] font-semibold text-glacial-500 flex-shrink-0">{dist.toFixed(2)} km</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </form>

          {showBuildingShade && (
            <p className="rounded-xl bg-glacial-100/80 px-3 py-2 text-[10px] leading-relaxed text-glacial-600 border border-glacial-200/60">
              江東区デモ限定の参考レイヤーです。固定日時の建物高さ目安から日陰を面で描画し、ルートの緑陰スコアにも反映しています。
            </p>
          )}
        </header>

        {areaMode === "current" && shelters.length <= DATA_SPARSE_THRESHOLD && (
          <div className="mx-4 mt-3 animate-fade-in rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-50 to-orange-50/60 px-3 py-2.5 text-xs font-medium text-amber-900 backdrop-blur-sm">
            このエリアはデータが少ない可能性があります。デモ対応エリア（江東区）もお試しください。
          </div>
        )}

        {message && (
          <div className="mx-4 mt-3 animate-fade-in rounded-2xl bg-gradient-to-r from-aqua-700 via-frost-700 to-aqua-700 px-4 py-2.5 text-xs font-semibold text-white shadow-frost-lg">
            {message}
          </div>
        )}

        <section className="relative min-h-[54vh] flex-1">
          <div className="absolute top-2 left-2 right-2 z-[900] flex gap-1 rounded-2xl border border-white/60 bg-white/85 px-1.5 py-1.5 shadow-glass backdrop-blur-xl">
            <LayerToggle
              icon={<Building2 size={14} />}
              label="日陰"
              active={showBuildingShade}
              activeColor="bg-glacial-700"
              onClick={() => setShowBuildingShade((v) => !v)}
            />
            <LayerToggle
              icon={<Snowflake size={13} />}
              label="シェルター"
              active={showShelters}
              activeColor="bg-aqua-600"
              onClick={() => setShowShelters((v) => !v)}
            />
            <LayerToggle
              icon={<span className="text-[8px] font-black leading-none">CV</span>}
              label="コンビニ"
              active={showConvenienceStores}
              activeColor="bg-orange-500"
              onClick={() => setShowConvenienceStores((v) => !v)}
            />
            <LayerToggle
              icon={<Trees size={13} />}
              label="公園"
              active={showParkSpots}
              activeColor="bg-emerald-600"
              onClick={() => setShowParkSpots((v) => !v)}
            />
            <LayerToggle
              icon={<Waves size={13} />}
              label="給水"
              active={showWaterSpots}
              activeColor="bg-aqua-500"
              onClick={() => setShowWaterSpots((v) => !v)}
            />
          </div>
          <MapView
            center={mapViewCenter}
            currentPosition={mapCenter}
            zoom={DEFAULT_ZOOM}
            shelters={shelters}
            availability={availabilityMap}
            restSpots={routeRestSpots}
            convenienceStores={pois}
            buildingShadows={buildingShadows}
            showBuildingShade={showBuildingShade}
            showShelters={showShelters}
            showConvenienceStores={showConvenienceStores}
            showParkSpots={showParkSpots}
            showWaterSpots={showWaterSpots}
            destination={destination}
            selectedMapTap={selectedMapTap}
            bestRoute={bestRoute}
            shortestRoute={shortestRoute}
            onShelterSelect={setSelectedShelter}
            onPoiSelect={setSelectedPoi}
            onRestSpotSelect={setSelectedRestSpot}
            onMapTap={(position) => {
              setSelectedMapTap(position);
              setSelectedShelter(null);
              setSelectedPoi(null);
              setSelectedRestSpot(null);
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
        {selectedRestSpot && (
          <RestSpotSheet
            spot={selectedRestSpot}
            center={mapCenter}
            onClose={() => setSelectedRestSpot(null)}
            onRoute={() => {
              setDestination({ label: selectedRestSpot.name, position: selectedRestSpot.position, kind: "search" });
              setSelectedRestSpot(null);
            }}
          />
        )}
        {selectedMapTap && (
          <MapTapSheet
            position={selectedMapTap}
            onClose={() => setSelectedMapTap(null)}
            onRoute={() => {
              setDestination({ label: "地図で指定した場所", position: selectedMapTap, kind: "tap" });
              setSelectedMapTap(null);
            }}
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

function MapTapSheet({
  position,
  onClose,
  onRoute
}: {
  position: LatLng;
  onClose: () => void;
  onRoute: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-[480px] sheet animate-slide-up">
      <div className="sheet-handle" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink">地図で指定した場所</h2>
          <p className="mt-0.5 text-xs text-glacial-500 font-medium">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </p>
        </div>
        <button className="min-h-9 rounded-xl bg-glacial-100 px-3 py-1.5 text-xs font-bold text-glacial-700 transition-all hover:bg-glacial-200" onClick={onClose}>閉じる</button>
      </div>
      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-aqua-600 to-frost-600 text-sm font-bold text-white shadow-frost transition-all hover:shadow-frost-lg hover:scale-[1.01] active:scale-[0.99]"
        onClick={onRoute}
      >
        <Navigation size={17} />
        ここへ向かう（涼しいルートを見る）
      </button>
    </div>
  );
}

function Legend() {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-1 border-t border-aqua-200/40 bg-white/70 backdrop-blur-md px-4 py-2.5 text-[10px] font-semibold text-glacial-600">
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-aqua-600" /> 空き</span>
      <span className="flex items-center gap-1"><span className="h-0 w-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-warning" /> やや混雑</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-glacial-500" /> 満員</span>
      <span className="flex items-center gap-1"><Trees size={12} className="text-frost-600" /> 公園</span>
      <span className="flex items-center gap-1"><Waves size={12} className="text-aqua-600" /> 給水</span>
      <span className="flex items-center gap-1"><Building2 size={12} className="text-glacial-500" /> 建物日陰</span>
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
    <div className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-[480px] sheet animate-slide-up">
      <div className="sheet-handle" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink leading-tight">{shelter.name}</h2>
          <p className="mt-0.5 text-xs text-glacial-500">{shelter.address}</p>
        </div>
        <button className="min-h-9 rounded-xl bg-glacial-100 px-3 py-1.5 text-xs font-bold text-glacial-700 transition-all hover:bg-glacial-200 flex-shrink-0" onClick={onClose}>閉じる</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Info label="定員" value={`${shelter.capacity}人`} />
        <Info label="開放時間" value={shelter.openHours} />
        <Info label="空き状況" value={`${statusShapes[status]} ${statusLabels[status]}`} />
        <Info label="最終更新" value={availability ? formatTime(availability.updatedAt) : "未更新"} />
      </div>
      {stale && <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-[11px] font-medium text-amber-800 border border-amber-200/60">情報が古い可能性があります。</p>}
      <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-aqua-600 to-frost-600 text-sm font-bold text-white shadow-frost transition-all hover:shadow-frost-lg hover:scale-[1.01] active:scale-[0.99]" onClick={onRoute}>
        <Navigation size={17} />
        ここへ向かう（涼しいルートを見る）
      </button>
    </div>
  );
}

function computeDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
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

function RestSpotSheet({
  spot,
  center,
  onClose,
  onRoute
}: {
  spot: RestSpot;
  center: LatLng;
  onClose: () => void;
  onRoute: () => void;
}) {
  const distance = Math.round(computeDistanceMeters(center, spot.position));
  const typeLabel = spot.type === "park" ? "公園" : "給水スポット";
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-[480px] sheet animate-slide-up">
      <div className="sheet-handle" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink leading-tight">{spot.name}</h2>
          <p className="mt-0.5 text-xs text-glacial-500 font-medium">{typeLabel}</p>
        </div>
        <button className="min-h-9 rounded-xl bg-glacial-100 px-3 py-1.5 text-xs font-bold text-glacial-700 transition-all hover:bg-glacial-200 flex-shrink-0" onClick={onClose}>閉じる</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Info label="距離" value={`${distance}m`} />
        <Info label="提供元" value={spot.source} />
      </div>
      <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-frost-600 text-sm font-bold text-white shadow-frost transition-all hover:shadow-frost-lg hover:scale-[1.01] active:scale-[0.99]" onClick={onRoute}>
        <Navigation size={17} />
        ここへ向かう（涼しいルートを見る）
      </button>
    </div>
  );
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
    <div className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-[480px] sheet animate-slide-up">
      <div className="sheet-handle" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink leading-tight">{poi.name}</h2>
          <p className="mt-0.5 text-xs text-glacial-500 font-medium">カテゴリ: {poi.category}</p>
        </div>
        <button className="min-h-9 rounded-xl bg-glacial-100 px-3 py-1.5 text-xs font-bold text-glacial-700 transition-all hover:bg-glacial-200 flex-shrink-0" onClick={onClose}>閉じる</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Info label="距離" value={`${distance}m`} />
        <Info label="提供元" value={poi.source} />
      </div>
      <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-aqua-600 to-frost-600 text-sm font-bold text-white shadow-frost transition-all hover:shadow-frost-lg hover:scale-[1.01] active:scale-[0.99]" onClick={onRoute}>
        <Navigation size={17} />
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
    <section className="border-t border-aqua-200/40 bg-white/80 backdrop-blur-md px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-aqua-600 uppercase tracking-wider">目的地</p>
          <h2 className="text-base font-bold text-ink truncate">{destination.label}</h2>
        </div>
        <div className="flex-shrink-0 rounded-2xl bg-gradient-to-br from-aqua-50 to-frost-50 border border-aqua-200/50 px-3.5 py-2 text-center">
          <p className="text-[9px] font-semibold text-glacial-500">緑陰スコア</p>
          <strong className="text-xl font-extrabold bg-gradient-to-r from-aqua-700 to-frost-600 bg-clip-text text-transparent">{bestScore.shadeScore}</strong>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Info label="涼しいルート" value={`${bestRoute.durationMinutes}分 / ${Math.round(bestRoute.distanceMeters)}m`} />
        <Info label="最短ルート" value={shortestRoute ? `${shortestRoute.durationMinutes}分 / ${Math.round(shortestRoute.distanceMeters)}m` : "取得中"} />
      </div>
      {bestRoute.source === "demo-fallback" && (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] text-amber-800 border border-amber-200/60">
          OpenRouteService未接続のため、デモ用の参考ルートを表示しています。実際の歩行可能経路にするには VITE_ORS_API_KEY または Worker 経由の ORS_API_KEY を設定してください。
        </p>
      )}
      <div className="rounded-2xl bg-gradient-to-br from-aqua-50 to-frost-50 border border-aqua-200/40 p-3.5">
        <p className="mb-2 text-xs font-bold text-aqua-700">このルートがおすすめの理由</p>
        <ul className="space-y-1.5">
          {bestScore.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-xs text-glacial-700">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-aqua-500" />
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
    <main className="min-h-screen bg-gradient-to-br from-aqua-50 via-frost-50 to-ice-50 px-4 py-6 text-ink">
      <div className="mx-auto max-w-[480px] space-y-4 rounded-3xl bg-white/90 p-6 shadow-glass-lg backdrop-blur-xl">
        <div>
          <p className="text-xs font-bold text-aqua-600 uppercase tracking-wider">施設スタッフ用</p>
          <h1 className="mt-1 text-xl font-extrabold text-ink">{shelter.name}</h1>
          <p className="mt-1 text-xs text-glacial-500 font-medium">現在: {statusLabels[currentStatus]} / 最終更新 {availability ? formatTime(availability.updatedAt) : "未更新"}</p>
        </div>
        {message && (
          <div className="rounded-xl bg-gradient-to-r from-aqua-700 to-frost-700 px-3.5 py-2.5 text-xs font-semibold text-white shadow-frost">
            {message}
          </div>
        )}
        <div className="grid gap-3">
          {(["open", "busy", "full"] as AvailabilityStatus[]).map((status) => (
            <button
              key={status}
              className={`min-h-14 rounded-2xl text-base font-bold transition-all active:scale-[0.98] ${statusClasses[status]}`}
              onClick={() => onChange(status)}
            >
              {statusShapes[status]} {statusLabels[status]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-glacial-400 text-center">デモ用の簡易更新画面です。本番では正式な認証と権限管理が必要です。</p>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-card">
      <p className="text-[10px] font-semibold text-glacial-500 mb-0.5">{label}</p>
      <p className="text-xs font-bold text-ink">{value}</p>
    </div>
  );
}

function WeatherCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-amber-200/50 bg-white/70 p-2 text-center backdrop-blur-sm transition-all hover:bg-white/90">
      <div className="mb-1 flex justify-center">{icon}</div>
      <div className="text-[9px] font-semibold text-glacial-500">{label}</div>
      <div className="text-xs font-bold text-ink">{value}</div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function LayerToggle({
  icon,
  label,
  active,
  activeColor,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex flex-1 min-h-8 items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-bold transition-all duration-200 ${
        active
          ? `${activeColor} text-white shadow-sm`
          : "bg-aqua-50 text-aqua-700 hover:bg-aqua-100"
      }`}
      onClick={onClick}
      title={label}
    >
      {icon}
      <span className="hidden min-[380px]:inline leading-none">{label}</span>
    </button>
  );
}
