import type { LatLng, Poi } from "../types/domain";

type OverpassElement = {
  type: string;
  id: number | string;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

// Fetch convenience stores around a point using the Overpass API
export async function fetchConvenienceStores(center: LatLng, radiusMeters = 800): Promise<Poi[]> {
  const query = `[
out:json][timeout:25];
(
  node["shop"="convenience"](around:${radiusMeters},${center.lat},${center.lng});
  way["shop"="convenience"](around:${radiusMeters},${center.lat},${center.lng});
  relation["shop"="convenience"](around:${radiusMeters},${center.lat},${center.lng});
);
out center;`;

  const url = "https://overpass-api.de/api/interpreter";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query
  });

  if (!res.ok) return [];

  const data = await res.json().catch(() => null) as OverpassResponse | null;
  const elements = data?.elements;
  if (!Array.isArray(elements)) return [];

  const pois: Poi[] = elements.map((el) => {
    const pos = el.type === "node"
      ? { lat: el.lat ?? 0, lng: el.lon ?? 0 }
      : { lat: el.center?.lat ?? 0, lng: el.center?.lon ?? 0 };
    const name = el.tags?.name ?? el.tags?.brand ?? "無名のコンビニ";

    return {
      id: `${el.type}/${el.id}`,
      name,
      category: el.tags?.shop ?? "convenience",
      position: pos,
      source: "overpass"
    } as Poi;
  }).filter((p: Poi) => p.position.lat !== 0 && p.position.lng !== 0);

  return pois;
}
