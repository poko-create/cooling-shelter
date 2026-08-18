import type { LatLng, Poi } from "../types/domain";

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

  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.elements)) return [];

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

  return pois;
}
