import type { Destination, LatLng, RestSpot, Shelter, Poi } from "../types/domain";

const demoResults: Destination[] = [
  {
    label: "木場公園",
    position: { lat: 35.6765, lng: 139.8077 },
    kind: "search"
  },
  {
    label: "江東区役所",
    position: { lat: 35.6729, lng: 139.8174 },
    kind: "search"
  },
  {
    label: "南砂町駅",
    position: { lat: 35.6687, lng: 139.8307 },
    kind: "search"
  },
  {
    label: "東雲駅",
    position: { lat: 35.64056, lng: 139.804 },
    kind: "search"
  }
];

export async function searchDestination(
  query: string,
  localItems: Array<Shelter | RestSpot | Poi> = [],
  center?: LatLng
): Promise<Destination | null> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const localHit = localItems.find((item) => item.name.toLowerCase().includes(normalized));
  if (localHit) {
    return {
      label: localHit.name,
      position: localHit.position,
      kind: "search"
    };
  }

  const hit = demoResults.find((item) => item.label.toLowerCase().includes(normalized));
  if (hit) return hit;

  const [poi] = center ? await searchOverpassPois(query, center, 1) : [];
  if (poi) return poi;

  const [nominatim] = await searchNominatim(query);
  if (nominatim) return nominatim;

  return {
    label: query.trim(),
    position: { lat: 35.6729, lng: 139.8174 },
    kind: "search"
  };
}

export async function searchDestinationSuggestions(query: string, center?: LatLng): Promise<Destination[]> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const localHits = demoResults.filter((item) => item.label.toLowerCase().includes(normalized));
  const [poiHits, nominatimHits] = await Promise.all([
    center ? searchOverpassPois(query, center, 6) : Promise.resolve([]),
    searchNominatim(query, 5)
  ]);
  const seen = new Set<string>();

  return [...localHits, ...poiHits, ...nominatimHits].filter((item) => {
    const key = `${item.label}-${item.position.lat.toFixed(5)}-${item.position.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

async function searchOverpassPois(query: string, center: LatLng, limit: number): Promise<Destination[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  try {
    const escaped = escapeOverpassRegex(normalized);
    const body = `[
out:json][timeout:12];
(
  node["name"~"${escaped}",i](around:5000,${center.lat},${center.lng});
  way["name"~"${escaped}",i](around:5000,${center.lat},${center.lng});
  relation["name"~"${escaped}",i](around:5000,${center.lat},${center.lng});
  node["brand"~"${escaped}",i](around:5000,${center.lat},${center.lng});
  way["brand"~"${escaped}",i](around:5000,${center.lat},${center.lng});
  relation["brand"~"${escaped}",i](around:5000,${center.lat},${center.lng});
);
out center ${limit * 2};`;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body
    });

    if (!response.ok) return [];

    const data = await response.json() as {
      elements?: Array<{
        id: number;
        type: string;
        lat?: number;
        lon?: number;
        center?: { lat?: number; lon?: number };
        tags?: { name?: string; brand?: string };
      }>;
    };

    return (data.elements ?? []).map((item): Destination | null => {
      const lat = item.lat ?? item.center?.lat;
      const lng = item.lon ?? item.center?.lon;
      const label = item.tags?.name ?? item.tags?.brand;
      if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return {
        label,
        position: { lat: lat as number, lng: lng as number },
        kind: "search"
      };
    }).filter((item): item is Destination => Boolean(item)).slice(0, limit);
  } catch {
    return [];
  }
}

function escapeOverpassRegex(value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|"]/g, "\\$&");
}

async function searchNominatim(query: string, limit = 1): Promise<Destination[]> {
  try {
    const params = new URLSearchParams({
      q: `${query} 東京`,
      format: "jsonv2",
      limit: String(limit),
      countrycodes: "jp",
      viewbox: "139.56,35.82,139.92,35.50",
      bounded: "1"
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) return [];

    const results = await response.json() as Array<{ display_name: string; lat: string; lon: string }>;

    return results.map((item): Destination => ({
      label: item.display_name,
      position: {
        lat: Number.parseFloat(item.lat),
        lng: Number.parseFloat(item.lon)
      },
      kind: "search"
    })).filter((item) =>
      Number.isFinite(item.position.lat) &&
      Number.isFinite(item.position.lng)
    );
  } catch {
    return [];
  }
}
