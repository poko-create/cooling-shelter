import * as turf from "@turf/turf";
import { ROUTE_BUFFER_METERS, SCORING_WEIGHTS } from "../config/scoring";
import { mockRestSpots, mockTrees } from "../data/mock/shelters";
import type { LatLng, RestSpot, RouteCandidate, RouteScore } from "../types/domain";

function distanceMeters(from: LatLng, to: LatLng) {
  return turf.distance([from.lng, from.lat], [to.lng, to.lat], { units: "kilometers" }) * 1000;
}

function interpolateRoute(start: LatLng, end: LatLng, bend: LatLng | null): LatLng[] {
  if (!bend) {
    return [start, midpoint(start, end, 0.33), midpoint(start, end, 0.66), end];
  }

  return [
    start,
    midpoint(start, bend, 0.5),
    bend,
    midpoint(bend, end, 0.5),
    end
  ];
}

function midpoint(start: LatLng, end: LatLng, ratio: number): LatLng {
  return {
    lat: start.lat + (end.lat - start.lat) * ratio,
    lng: start.lng + (end.lng - start.lng) * ratio
  };
}

function routeDistance(coordinates: LatLng[]) {
  return coordinates.slice(1).reduce((sum, point, index) => sum + distanceMeters(coordinates[index], point), 0);
}

export async function getRouteCandidates(start: LatLng, end: LatLng): Promise<RouteCandidate[]> {
  const shortest = interpolateRoute(start, end, null);
  const viaGreen = interpolateRoute(start, end, { lat: 35.6752, lng: 139.8112 });
  const viaWater = interpolateRoute(start, end, { lat: 35.6715, lng: 139.8196 });

  return [shortest, viaGreen, viaWater].map((coordinates, index) => {
    const distance = routeDistance(coordinates);
    return {
      id: index === 0 ? "shortest" : `cool-${index}`,
      label: index === 0 ? "最短ルート" : `涼しい候補${index}`,
      coordinates,
      distanceMeters: Math.round(distance),
      durationMinutes: Math.max(1, Math.round(distance / 75))
    };
  });
}

export function scoreRoutes(routes: RouteCandidate[]): RouteScore[] {
  const shortestMinutes = Math.min(...routes.map((route) => route.durationMinutes));
  const maxTreeCount = Math.max(1, ...routes.map((route) => countNearRoute(route, "trees")));
  const maxRestCount = Math.max(1, ...routes.map((route) => countNearRoute(route, "rest")));

  return routes.map((route) => {
    const treeCount = countNearRoute(route, "trees");
    const nearRest = restSpotsNearRoute(route);
    const parkCount = nearRest.filter((spot) => spot.type === "park").length;
    const waterCount = nearRest.filter((spot) => spot.type === "water").length;
    const extraMinutes = Math.max(0, route.durationMinutes - shortestMinutes);
    const treeScore = (treeCount / maxTreeCount) * 100;
    const parkScore = Math.min(100, parkCount * 50);
    const restScore = Math.min(100, (parkCount + waterCount) / maxRestCount * 100);
    const detourScore = Math.max(0, 100 - extraMinutes * 12);
    const shadeScore = Math.round(
      treeScore * SCORING_WEIGHTS.treeDensity +
        parkScore * SCORING_WEIGHTS.greenPark +
        restScore * SCORING_WEIGHTS.waterAndRest +
        detourScore * SCORING_WEIGHTS.shortDetour
    );

    return {
      routeId: route.id,
      shadeScore,
      treeCount,
      parkCount,
      waterCount,
      extraMinutes,
      reasons: buildReasons(route, treeCount, parkCount, waterCount, extraMinutes)
    };
  });
}

export function restSpotsNearRoute(route: RouteCandidate): RestSpot[] {
  const line = turf.lineString(route.coordinates.map((point) => [point.lng, point.lat]));
  return mockRestSpots.filter((spot) => {
    const point = turf.point([spot.position.lng, spot.position.lat]);
    const distance = turf.pointToLineDistance(point, line, { units: "meters" });
    return distance <= ROUTE_BUFFER_METERS * 4;
  });
}

function countNearRoute(route: RouteCandidate, target: "trees" | "rest") {
  const line = turf.lineString(route.coordinates.map((point) => [point.lng, point.lat]));
  const items = target === "trees" ? mockTrees : mockRestSpots;

  return items.filter((item) => {
    const point = turf.point([item.position.lng, item.position.lat]);
    return turf.pointToLineDistance(point, line, { units: "meters" }) <= ROUTE_BUFFER_METERS;
  }).length;
}

function buildReasons(
  route: RouteCandidate,
  treeCount: number,
  parkCount: number,
  waterCount: number,
  extraMinutes: number
) {
  const reasons = [
    `${route.label}はルート周辺の街路樹が${treeCount}本あります`,
    `最短ルートとの差分は約${extraMinutes}分です`
  ];

  if (parkCount > 0) reasons.push(`緑陰の多い公園を${parkCount}か所通ります`);
  if (waterCount > 0) reasons.push(`給水スポットが${waterCount}か所あります`);

  return reasons;
}
