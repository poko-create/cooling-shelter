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

const queryAliases: Record<string, string[]> = {
  "スターバックス": ["Starbucks", "スターバックス コーヒー"],
  "スタバ": ["Starbucks", "スターバックス", "スターバックス コーヒー"],
  "マクドナルド": ["McDonald's", "McDonalds", "McDonald"],
  "マック": ["McDonald's", "McDonalds", "マクドナルド"],
  "セブンイレブン": ["7-Eleven", "セブン-イレブン", "セブン イレブン"],
  "セブン": ["7-Eleven", "セブン-イレブン"],
  "ファミマ": ["FamilyMart", "ファミリーマート"],
  "ファミリーマート": ["FamilyMart", "ファミマ"],
  "ローソン": ["Lawson", "ローソン"],
  "ドトール": ["Doutor", "ドトールコーヒー"],
  "タリーズ": ["Tully's", "Tullys", "タリーズコーヒー"]
};

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

  const terms = expandSearchTerms(query);
  const [poi] = center ? await searchOverpassPois(terms, center, 1) : [];
  if (poi) return poi;

  const [nominatim] = await searchNominatim(terms);
  if (nominatim) return nominatim;

  return null;
}

export async function searchDestinationSuggestions(
  query: string,
  center?: LatLng,
  options: { signal?: AbortSignal } = {}
): Promise<Destination[]> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const localHits = demoResults.filter((item) => item.label.toLowerCase().includes(normalized));
  const terms = expandSearchTerms(query);
  const poiHits = center ? await searchOverpassPois(terms, center, 6, options.signal, 3000) : [];
  const seen = new Set<string>();

  return [...localHits, ...poiHits].filter((item) => {
    const key = `${item.label}-${item.position.lat.toFixed(5)}-${item.position.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function expandSearchTerms(query: string) {
  const normalized = query.trim();
  if (!normalized) return [];
  const compact = normalized.replace(/\s+/g, "").toLowerCase();
  const aliases = queryAliases[compact] ?? [];
  return [normalized, ...aliases].filter((term, index, terms) =>
    term.length >= 2 &&
    terms.findIndex((candidate) => candidate.toLowerCase() === term.toLowerCase()) === index
  );
}

async function searchOverpassPois(
  queryOrTerms: string | string[],
  center: LatLng,
  limit: number,
  signal?: AbortSignal,
  radiusMeters = 5000
): Promise<Destination[]> {
  const terms = Array.isArray(queryOrTerms) ? queryOrTerms : expandSearchTerms(queryOrTerms);
  if (terms.length === 0) return [];

  try {
    const escaped = terms.map(escapeOverpassRegex).join("|");
    const body = `[
out:json][timeout:12];
(
  node["name"~"${escaped}",i](around:${radiusMeters},${center.lat},${center.lng});
  way["name"~"${escaped}",i](around:${radiusMeters},${center.lat},${center.lng});
  relation["name"~"${escaped}",i](around:${radiusMeters},${center.lat},${center.lng});
  node["brand"~"${escaped}",i](around:${radiusMeters},${center.lat},${center.lng});
  way["brand"~"${escaped}",i](around:${radiusMeters},${center.lat},${center.lng});
  relation["brand"~"${escaped}",i](around:${radiusMeters},${center.lat},${center.lng});
);
out center ${limit * 2};`;
    const response = await fetchWithTimeout("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body
    }, 5000, signal);

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

async function searchNominatim(queryOrTerms: string | string[], limit = 1): Promise<Destination[]> {
  const terms = Array.isArray(queryOrTerms) ? queryOrTerms : expandSearchTerms(queryOrTerms);
  const results: Destination[] = [];

  for (const term of terms) {
    try {
      const params = new URLSearchParams({
        q: `${term} 東京`,
        format: "jsonv2",
        limit: String(limit),
        countrycodes: "jp",
        viewbox: "139.56,35.82,139.92,35.50",
        bounded: "1"
      });
      const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          "Accept": "application/json"
        }
      }, 5000);

      if (!response.ok) continue;

      const items = await response.json() as Array<{ display_name: string; lat: string; lon: string }>;

      results.push(...items.map((item): Destination => ({
        label: item.display_name,
        position: {
          lat: Number.parseFloat(item.lat),
          lng: Number.parseFloat(item.lon)
        },
        kind: "search"
      })).filter((item) =>
        Number.isFinite(item.position.lat) &&
        Number.isFinite(item.position.lng)
      ));
    } catch {
      continue;
    }
    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}
