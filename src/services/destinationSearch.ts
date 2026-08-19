import type { Destination, RestSpot, Shelter, Poi } from "../types/domain";

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
  }
];

export async function searchDestination(
  query: string,
  localItems: Array<Shelter | RestSpot | Poi> = []
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

  const nominatim = await searchNominatim(query);
  if (nominatim) return nominatim;

  return {
    label: query.trim(),
    position: { lat: 35.6729, lng: 139.8174 },
    kind: "search"
  };
}

async function searchNominatim(query: string): Promise<Destination | null> {
  try {
    const params = new URLSearchParams({
      q: `${query} 東京`,
      format: "jsonv2",
      limit: "1",
      countrycodes: "jp",
      viewbox: "139.56,35.82,139.92,35.50",
      bounded: "1"
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) return null;

    const [first] = await response.json() as Array<{ display_name: string; lat: string; lon: string }>;
    if (!first) return null;

    return {
      label: first.display_name,
      position: {
        lat: Number.parseFloat(first.lat),
        lng: Number.parseFloat(first.lon)
      },
      kind: "search"
    };
  } catch {
    return null;
  }
}
