import type { Destination } from "../types/domain";

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

export async function searchDestination(query: string): Promise<Destination | null> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const hit = demoResults.find((item) => item.label.toLowerCase().includes(normalized));
  if (hit) return hit;

  return {
    label: query.trim(),
    position: { lat: 35.6729, lng: 139.8174 },
    kind: "search"
  };
}
