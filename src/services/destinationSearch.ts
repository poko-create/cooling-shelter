import type { Destination, RestSpot, Shelter } from "../types/domain";

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
    label: "大手町駅",
    position: { lat: 35.6765, lng: 139.7641 },
    kind: "search"
  },
  {
    label: "東京駅",
    position: { lat: 35.6812, lng: 139.7671 },
    kind: "search"
  },
  {
    label: "丸の内駅",
    position: { lat: 35.6815, lng: 139.7746 },
    kind: "search"
  },
  {
    label: "日本橋駅",
    position: { lat: 35.6704, lng: 139.7760 },
    kind: "search"
  },
  {
    label: "東京都立深川高等学校",
    position: { lat: 35.6736, lng: 139.8031 },
    kind: "search"
  }
];

export async function searchDestination(
  query: string,
  localItems: Array<Shelter | RestSpot> = []
): Promise<Destination | null> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  // 完全一致を優先
  let localHit = localItems.find((item) => item.name.toLowerCase() === normalized);
  if (localHit) {
    return {
      label: localHit.name,
      position: localHit.position,
      kind: "search"
    };
  }

  let hit = demoResults.find((item) => item.label.toLowerCase() === normalized);
  if (hit) return hit;

  // 完全一致がなければ部分一致を探す
  localHit = localItems.find((item) => item.name.toLowerCase().includes(normalized));
  if (localHit) {
    return {
      label: localHit.name,
      position: localHit.position,
      kind: "search"
    };
  }

  hit = demoResults.find((item) => item.label.toLowerCase().includes(normalized));
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
