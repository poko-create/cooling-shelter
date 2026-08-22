import type { Poi } from "../types/domain";
import { DEMO_AREA_BOUNDS } from "../config/area";

const PLACES_API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export async function fetchConvenienceStores(options: { signal?: AbortSignal } = {}): Promise<Poi[]> {
  if (PLACES_API_BASE) {
    try {
      return await fetchConvenienceStoresFromApi(PLACES_API_BASE, options.signal);
    } catch {
      return fetchConvenienceStoresFromOverpass(options);
    }
  }

  return fetchConvenienceStoresFromOverpass(options);
}

async function fetchConvenienceStoresFromApi(apiBase: string, signal?: AbortSignal): Promise<Poi[]> {
  const res = await fetchWithTimeout(
    `${apiBase.replace(/\/$/, "")}/api/places/convenience`,
    { method: "GET" },
    7000,
    signal
  );

  if (!res.ok) throw new Error("Convenience store API request failed");

  const data = await res.json().catch(() => null) as { items?: unknown[] } | null;
  if (!data || !Array.isArray(data.items)) throw new Error("Convenience store API response is invalid");

  return dedupePois(data.items.map(normalizePoi).filter(Boolean) as Poi[]);
}

async function fetchConvenienceStoresFromOverpass(options: { signal?: AbortSignal } = {}): Promise<Poi[]> {
  const query = `[
out:json][timeout:25];
(
  node["shop"="convenience"](${DEMO_AREA_BOUNDS.minLat},${DEMO_AREA_BOUNDS.minLng},${DEMO_AREA_BOUNDS.maxLat},${DEMO_AREA_BOUNDS.maxLng});
  way["shop"="convenience"](${DEMO_AREA_BOUNDS.minLat},${DEMO_AREA_BOUNDS.minLng},${DEMO_AREA_BOUNDS.maxLat},${DEMO_AREA_BOUNDS.maxLng});
  relation["shop"="convenience"](${DEMO_AREA_BOUNDS.minLat},${DEMO_AREA_BOUNDS.minLng},${DEMO_AREA_BOUNDS.maxLat},${DEMO_AREA_BOUNDS.maxLng});
);
out center;`;

  const url = "https://overpass-api.de/api/interpreter";

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query
  }, 5000, options.signal);

  if (!res.ok) throw new Error("Overpass convenience store request failed");

  const data = await res.json().catch(() => null) as { elements?: unknown[] } | null;
  if (!data || !Array.isArray(data.elements)) throw new Error("Overpass convenience store response is invalid");

  const pois = data.elements.map(normalizeOverpassElement).filter(Boolean) as Poi[];

  return dedupePois(pois);
}

function normalizeOverpassElement(element: unknown): Poi | null {
  if (!element || typeof element !== "object") return null;
  const item = element as {
    id?: number | string;
    type?: string;
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
    tags?: { name?: string; brand?: string; shop?: string };
  };

  const lat = item.type === "node" ? item.lat : item.center?.lat;
  const lng = item.type === "node" ? item.lon : item.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number" || !item.id || !item.type) return null;

  return {
    id: `${item.type}/${item.id}`,
    name: item.tags?.name ?? item.tags?.brand ?? "無名のコンビニ",
    category: item.tags?.shop ?? "convenience",
    position: { lat, lng },
    source: "overpass"
  };
}

function normalizePoi(item: unknown): Poi | null {
  if (!item || typeof item !== "object") return null;
  const poi = item as Partial<Poi>;
  if (
    typeof poi.id !== "string" ||
    typeof poi.name !== "string" ||
    typeof poi.category !== "string" ||
    typeof poi.source !== "string" ||
    typeof poi.position?.lat !== "number" ||
    typeof poi.position?.lng !== "number"
  ) {
    return null;
  }

  return {
    id: poi.id,
    name: poi.name,
    category: poi.category,
    position: {
      lat: poi.position.lat,
      lng: poi.position.lng
    },
    source: poi.source
  };
}

function dedupePois(pois: Poi[]) {
  const seen = new Set<string>();
  return pois.filter((poi) => {
    const key = `${poi.name}-${poi.position.lat.toFixed(5)}-${poi.position.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: RequestInit,
  timeoutMs: number,
  parentSignal?: AbortSignal
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = globalThis.setTimeout(abort, timeoutMs);

  if (parentSignal?.aborted) controller.abort();
  parentSignal?.addEventListener("abort", abort, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abort);
  }
}
