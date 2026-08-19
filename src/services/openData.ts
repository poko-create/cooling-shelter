import { mockRestSpots, mockShelters, mockTrees } from "../data/mock/shelters";
import type { RestSpot, Shelter, TreePoint } from "../types/domain";
import { parseCsv, rowsToObjects } from "./csv";

const KOTO_BOUNDS = {
  minLat: 35.6,
  maxLat: 35.72,
  minLng: 139.76,
  maxLng: 139.86
};

const OPEN_DATA_API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

type OpenDataKind = "shelters" | "trees" | "parks" | "water";

export type OpenDataState = {
  shelters: Shelter[];
  trees: TreePoint[];
  restSpots: RestSpot[];
  source: "open-data" | "mock-fallback";
};

export async function loadOpenData(): Promise<OpenDataState> {
  try {
    const [shelters, trees, parks, water] = await Promise.all([
      loadShelters(),
      loadTrees(),
      loadParks(),
      loadWaterSpots()
    ]);

    return {
      shelters: shelters.length > 0 ? shelters : mockShelters,
      trees: trees.length > 0 ? trees : mockTrees,
      restSpots: [...parks, ...water].length > 0 ? [...parks, ...water] : mockRestSpots,
      source: shelters.length > 0 && trees.length > 0 && [...parks, ...water].length > 0
        ? "open-data"
        : "mock-fallback"
    };
  } catch {
    return {
      shelters: mockShelters,
      trees: mockTrees,
      restSpots: mockRestSpots,
      source: "mock-fallback"
    };
  }
}

async function loadShelters(): Promise<Shelter[]> {
  const rows = await fetchOpenDataRows("shelters");
  return rows
    .map((row, index): Shelter | null => {
      const lat = toNumber(row["緯度"]);
      const lng = toNumber(row["経度"]);
      if (!isInKotoBounds(lat, lng)) return null;

      return {
        id: `shelter-${index}-${row["施設名称"]}`,
        name: row["施設名称"] || "名称未設定",
        address: row["住所"] || "",
        capacity: extractCapacity(row["受入れ可能人数"]),
        openHours: row["開放可能日等（開館時間等）"] || "未設定",
        position: { lat, lng },
        source: "江東区 クーリングシェルター一覧"
      };
    })
    .filter((item): item is Shelter => Boolean(item))
    .slice(0, 80);
}

async function loadTrees(): Promise<TreePoint[]> {
  const rows = await fetchOpenDataRows("trees");
  return rows
    .map((row, index): TreePoint | null => {
      const lat = toNumber(row["緯度"]);
      const lng = toNumber(row["経度"]);
      if (!isInKotoBounds(lat, lng)) return null;

      return {
        id: `tree-${index}`,
        species: row["樹種"] || "樹種不明",
        position: { lat, lng }
      };
    })
    .filter((item): item is TreePoint => Boolean(item))
    .slice(0, 2500);
}

async function loadParks(): Promise<RestSpot[]> {
  const rows = await fetchOpenDataRows("parks");
  return rows
    .map((row, index): RestSpot | null => {
      const lat = toNumber(row["緯度"]);
      const lng = toNumber(row["経度"]);
      if (!isInKotoBounds(lat, lng)) return null;

      return {
        id: `park-${index}`,
        name: row["名称"] || "公園",
        type: "park",
        position: { lat, lng },
        source: "江東区 区立公園"
      };
    })
    .filter((item): item is RestSpot => Boolean(item))
    .slice(0, 300);
}

async function loadWaterSpots(): Promise<RestSpot[]> {
  const rows = await fetchOpenDataRows("water");
  return rows
    .map((row, index): RestSpot | null => {
      const lat = toNumber(row["緯度"]);
      const lng = toNumber(row["経度"]);
      if (!isInKotoBounds(lat, lng)) return null;

      return {
        id: `water-${index}`,
        name: row["施設名称"] || "給水スポット",
        type: "water",
        position: { lat, lng },
        source: "東京都水道局 Tokyowater Drinking Station一覧"
      };
    })
    .filter((item): item is RestSpot => Boolean(item))
    .slice(0, 300);
}

async function fetchOpenDataRows(kind: OpenDataKind) {
  const endpoint = OPEN_DATA_API_BASE
    ? `${OPEN_DATA_API_BASE.replace(/\/$/, "")}/api/open-data/${kind}`
    : `/api/open-data/${kind}`;

  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Failed to load ${kind}`);

  return rowsToObjects(parseCsv(await response.text()));
}

function toNumber(value: string | undefined) {
  return Number.parseFloat(value ?? "");
}

function isInKotoBounds(lat: number, lng: number) {
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= KOTO_BOUNDS.minLat &&
    lat <= KOTO_BOUNDS.maxLat &&
    lng >= KOTO_BOUNDS.minLng &&
    lng <= KOTO_BOUNDS.maxLng;
}

function extractCapacity(value: string) {
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}
