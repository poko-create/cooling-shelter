import type { BuildingShadow, LatLng } from "../types/domain";
import plateauBuildings from "../data/plateau/kotoDemoBuildings.json";

const DEMO_SHADOW_TIME_LABEL = "2026-08-01 15:00";

export function getDemoBuildingShadows(): BuildingShadow[] {
  return plateauBuildings.buildings.map((building) => ({
    id: building.id,
    name: "PLATEAU建築物",
    footprint: building.footprint.map(([lng, lat]) => ({ lat, lng })),
    shadow: buildShadowPolygon(building.footprint, building.heightMeters),
    heightMeters: building.heightMeters,
    source: `${plateauBuildings.source}（${DEMO_SHADOW_TIME_LABEL}想定）`
  }));
}

function buildShadowPolygon(footprintLngLat: number[][], heightMeters: number): LatLng[] {
  const footprint = footprintLngLat.map(([lng, lat]) => ({ lat, lng }));
  const shadowLengthMeters = heightMeters / Math.tan(toRadians(34));
  const castBearingDegrees = 64;
  const shifted = footprint.map((point) => movePoint(point, shadowLengthMeters, castBearingDegrees));

  return convexHull([...footprint, ...shifted]);
}

function movePoint(point: LatLng, distanceMeters: number, bearingDegrees: number): LatLng {
  const bearing = toRadians(bearingDegrees);
  const latMeters = distanceMeters * Math.cos(bearing);
  const lngMeters = distanceMeters * Math.sin(bearing);

  return {
    lat: point.lat + latMeters / 111_320,
    lng: point.lng + lngMeters / (111_320 * Math.cos(toRadians(point.lat)))
  };
}

function convexHull(points: LatLng[]): LatLng[] {
  const sorted = [...points].sort((a, b) => a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng);
  if (sorted.length <= 3) return sorted;

  const lower: LatLng[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: LatLng[] = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function cross(origin: LatLng, a: LatLng, b: LatLng) {
  return (a.lng - origin.lng) * (b.lat - origin.lat) - (a.lat - origin.lat) * (b.lng - origin.lng);
}

function toRadians(degrees: number) {
  return degrees * Math.PI / 180;
}
