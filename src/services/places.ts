import type { Poi } from "../types/domain";
import { DEMO_AREA_BOUNDS } from "../config/area";

export async function fetchConvenienceStores(options: { signal?: AbortSignal } = {}): Promise<Poi[]> {
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

  const pois: Poi[] = data.elements.map((el: any) => {
    const pos = el.type === "node" ? { lat: el.lat, lng: el.lon } : { lat: el.center?.lat ?? 0, lng: el.center?.lon ?? 0 };
    const name = el.tags?.name ?? el.tags?.brand ?? "無名のコンビニ";
    return {
      id: `${el.type}/${el.id}`,
      name,
      category: el.tags?.shop ?? "convenience",
      position: pos,
      source: "overpass"
    } as Poi;
  }).filter((p: Poi) => p.position.lat && p.position.lng);

  return dedupePois(pois);
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
