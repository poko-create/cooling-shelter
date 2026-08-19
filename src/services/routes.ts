import * as turf from "@turf/turf";
import { BUILDING_SHADE_SAMPLE_METERS, ROUTE_BUFFER_METERS, SCORING_WEIGHTS } from "../config/scoring";
import type { BuildingShadow, LatLng, RestSpot, RouteCandidate, RouteScore } from "../types/domain";
import type { TreePoint } from "../types/domain";

function distanceMeters(from: LatLng, to: LatLng) {
  return turf.distance([from.lng, from.lat], [to.lng, to.lat], { units: "kilometers" }) * 1000;
}

function routeDistance(coordinates: LatLng[]) {
  return coordinates.slice(1).reduce((sum, point, index) => sum + distanceMeters(coordinates[index], point), 0);
}

function uniqueRouteCandidates(routes: RouteCandidate[]) {
  const seen = new Set<string>();
  return routes.filter((route) => {
    const signature = routeSignature(route.coordinates);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function uniqueRouteCoordinates(routes: LatLng[][]) {
  const seen = new Set<string>();
  return routes.filter((coordinates) => {
    const signature = routeSignature(coordinates);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function routeSignature(coordinates: LatLng[]) {
  return coordinates.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join("|");
}

export async function getRouteCandidates(start: LatLng, end: LatLng): Promise<RouteCandidate[]> {
  const apiRoutes = await getOpenRouteServiceCandidates(start, end);
  if (apiRoutes.length > 0) return uniqueRouteCandidates(apiRoutes);

  const routeCoordinates = [
    buildDemoPedestrianRoute(start, end),
    ...demoWaypointCandidates.map((waypoint) => buildDemoPedestrianRoute(start, end, waypoint))
  ];

  return uniqueRouteCoordinates(routeCoordinates).slice(0, 3).map((coordinates, index) => {
    const distance = routeDistance(coordinates);
    return {
      id: index === 0 ? "shortest" : `cool-${index}`,
      label: index === 0 ? "最短ルート（デモ）" : `涼しい候補${index}（デモ）`,
      coordinates,
      distanceMeters: Math.round(distance),
      durationMinutes: Math.max(1, Math.round(distance / 75)),
      source: "demo-fallback"
    };
  });
}

async function getOpenRouteServiceCandidates(start: LatLng, end: LatLng): Promise<RouteCandidate[]> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const browserApiKey = import.meta.env.VITE_ORS_API_KEY as string | undefined;
  const body = JSON.stringify({
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ],
    preference: "recommended",
    instructions: false,
    alternative_routes: {
      target_count: 3,
      share_factor: 0.6,
      weight_factor: 1.4
    }
  });

  if (apiBaseUrl) {
    const workerRoutes = await fetchOpenRouteServiceRoutes(
      `${apiBaseUrl.replace(/\/$/, "")}/api/routes`,
      { "Content-Type": "application/json" },
      body
    );
    if (workerRoutes.length > 0) return workerRoutes;
  }

  if (browserApiKey) {
    return fetchOpenRouteServiceRoutes(
      "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
      {
        "Content-Type": "application/json",
        Authorization: browserApiKey
      },
      body
    );
  }

  return [];
}

async function fetchOpenRouteServiceRoutes(
  endpoint: string,
  headers: Record<string, string>,
  body: string
): Promise<RouteCandidate[]> {
  try {
    const response = await fetch(endpoint, { method: "POST", headers, body });
    if (!response.ok) return [];
    const geojson = await response.json() as OrsGeoJsonResponse;
    return geojson.features.map((feature, index) => {
      const coordinates = feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const distance = feature.properties.summary?.distance ?? routeDistance(coordinates);
      const durationSeconds = feature.properties.summary?.duration ?? distance / 1.25;

      return {
        id: index === 0 ? "shortest" : `ors-${index}`,
        label: index === 0 ? "最短ルート" : `候補ルート${index + 1}`,
        coordinates,
        distanceMeters: Math.round(distance),
        durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
        source: "openrouteservice"
      };
    });
  } catch {
    return [];
  }
}

type OrsGeoJsonResponse = {
  features: Array<{
    geometry: {
      coordinates: Array<[number, number]>;
    };
    properties: {
      summary?: {
        distance?: number;
        duration?: number;
      };
    };
  }>;
};

type DemoNodeId =
  | "kiba-park"
  | "kiba-east"
  | "kiba-bridge"
  | "toyo-west"
  | "toyo-center"
  | "toyo-water"
  | "koto-office"
  | "toyokita"
  | "sendaibori-west"
  | "sendaibori-east"
  | "minamisuna-west"
  | "minamisuna-station"
  | "koto-library";

type DemoNode = {
  id: DemoNodeId;
  position: LatLng;
  neighbors: DemoNodeId[];
};

const demoPedestrianGraph: Record<DemoNodeId, DemoNode> = {
  "kiba-park": {
    id: "kiba-park",
    position: { lat: 35.6765, lng: 139.8077 },
    neighbors: ["kiba-east", "toyokita"]
  },
  "kiba-east": {
    id: "kiba-east",
    position: { lat: 35.6752, lng: 139.8112 },
    neighbors: ["kiba-park", "kiba-bridge", "sendaibori-west"]
  },
  "kiba-bridge": {
    id: "kiba-bridge",
    position: { lat: 35.6738, lng: 139.8144 },
    neighbors: ["kiba-east", "toyo-west"]
  },
  "toyo-west": {
    id: "toyo-west",
    position: { lat: 35.6729, lng: 139.8161 },
    neighbors: ["kiba-bridge", "toyo-center"]
  },
  "toyo-center": {
    id: "toyo-center",
    position: { lat: 35.6729, lng: 139.8174 },
    neighbors: ["toyo-west", "toyo-water", "koto-office"]
  },
  "toyo-water": {
    id: "toyo-water",
    position: { lat: 35.6715, lng: 139.8196 },
    neighbors: ["toyo-center", "minamisuna-west"]
  },
  "koto-office": {
    id: "koto-office",
    position: { lat: 35.6707, lng: 139.8174 },
    neighbors: ["toyo-center", "minamisuna-west"]
  },
  toyokita: {
    id: "toyokita",
    position: { lat: 35.6802, lng: 139.8066 },
    neighbors: ["kiba-park", "sendaibori-west"]
  },
  "sendaibori-west": {
    id: "sendaibori-west",
    position: { lat: 35.6784, lng: 139.8121 },
    neighbors: ["toyokita", "kiba-east", "sendaibori-east"]
  },
  "sendaibori-east": {
    id: "sendaibori-east",
    position: { lat: 35.6751, lng: 139.8193 },
    neighbors: ["sendaibori-west", "toyo-water", "minamisuna-west"]
  },
  "minamisuna-west": {
    id: "minamisuna-west",
    position: { lat: 35.6699, lng: 139.8212 },
    neighbors: ["koto-office", "toyo-water", "sendaibori-east", "minamisuna-station"]
  },
  "minamisuna-station": {
    id: "minamisuna-station",
    position: { lat: 35.6687, lng: 139.8307 },
    neighbors: ["minamisuna-west", "koto-library"]
  },
  "koto-library": {
    id: "koto-library",
    position: { lat: 35.6696, lng: 139.8334 },
    neighbors: ["minamisuna-station"]
  }
};

function buildDemoPedestrianRoute(start: LatLng, end: LatLng, via?: DemoNodeId): LatLng[] {
  const startNode = nearestDemoNode(start);
  const endNode = nearestDemoNode(end);
  const nodePath = via
    ? mergeNodePaths(findNodePath(startNode, via), findNodePath(via, endNode))
    : findNodePath(startNode, endNode);

  return [
    start,
    ...nodePath.map((id) => demoPedestrianGraph[id].position),
    end
  ];
}

function nearestDemoNode(point: LatLng): DemoNodeId {
  return (Object.keys(demoPedestrianGraph) as DemoNodeId[]).reduce((nearest, candidate) => {
    const nearestDistance = distanceMeters(point, demoPedestrianGraph[nearest].position);
    const candidateDistance = distanceMeters(point, demoPedestrianGraph[candidate].position);
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, "toyo-center");
}

function findNodePath(start: DemoNodeId, end: DemoNodeId): DemoNodeId[] {
  const distances = new Map<DemoNodeId, number>();
  const previous = new Map<DemoNodeId, DemoNodeId | null>();
  const unvisited = new Set(Object.keys(demoPedestrianGraph) as DemoNodeId[]);

  unvisited.forEach((id) => {
    distances.set(id, id === start ? 0 : Number.POSITIVE_INFINITY);
    previous.set(id, null);
  });

  while (unvisited.size > 0) {
    const current = [...unvisited].sort(
      (a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity)
    )[0];

    if (!current || current === end) break;

    unvisited.delete(current);
    const currentDistance = distances.get(current) ?? Infinity;

    demoPedestrianGraph[current].neighbors.forEach((neighbor) => {
      if (!unvisited.has(neighbor)) return;

      const nextDistance = currentDistance + distanceMeters(
        demoPedestrianGraph[current].position,
        demoPedestrianGraph[neighbor].position
      );

      if (nextDistance < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, nextDistance);
        previous.set(neighbor, current);
      }
    });
  }

  const path: DemoNodeId[] = [];
  let cursor: DemoNodeId | null = end;

  while (cursor) {
    path.unshift(cursor);
    cursor = previous.get(cursor) ?? null;
  }

  return path[0] === start ? path : [start, end];
}

function mergeNodePaths(first: DemoNodeId[], second: DemoNodeId[]) {
  if (first.length === 0) return second;
  if (second.length === 0) return first;

  return first[first.length - 1] === second[0]
    ? [...first, ...second.slice(1)]
    : [...first, ...second];
}

export function filterGreenRestSpots(restSpots: RestSpot[]): RestSpot[] {
  return restSpots.filter((spot) => spot.type === "park" || spot.type === "water");
}

export function scoreRoutes(
  routes: RouteCandidate[],
  trees: TreePoint[],
  restSpots: RestSpot[],
  buildingShadows: BuildingShadow[] = []
): RouteScore[] {
  const greenSpots = filterGreenRestSpots(restSpots);
  const shortestMinutes = Math.min(...routes.map((route) => route.durationMinutes));
  const metricsByRoute = new Map(
    routes.map((route) => {
      const treeCount = countNearRoute(route, trees);
      const nearRest = restSpotsNearRoute(route, greenSpots);
      const parkCount = nearRest.filter((spot) => spot.type === "park").length;
      const waterCount = nearRest.filter((spot) => spot.type === "water").length;
      const routeKilometers = Math.max(0.1, route.distanceMeters / 1000);
      const buildingShadeMeters = routeBuildingShadeMeters(route, buildingShadows);

      return [route.id, {
        treeCount,
        treeDensityPerKm: treeCount / routeKilometers,
        buildingShadeMeters,
        buildingShadeRatio: Math.min(1, buildingShadeMeters / Math.max(1, route.distanceMeters)),
        parkCount,
        waterCount,
        restDensityPerKm: (parkCount + waterCount) / routeKilometers
      }];
    })
  );
  const maxTreeDensity = Math.max(0, ...[...metricsByRoute.values()].map((metrics) => metrics.treeDensityPerKm));
  const maxRestDensity = Math.max(0, ...[...metricsByRoute.values()].map((metrics) => metrics.restDensityPerKm));
  const maxBuildingShadeRatio = Math.max(0, ...[...metricsByRoute.values()].map((metrics) => metrics.buildingShadeRatio));
  const usesBuildingShade = maxBuildingShadeRatio > 0;
  const activeWeightTotal = usesBuildingShade
    ? Object.values(SCORING_WEIGHTS).reduce((sum, weight) => sum + weight, 0)
    : SCORING_WEIGHTS.treeDensity +
      SCORING_WEIGHTS.greenPark +
      SCORING_WEIGHTS.waterAndRest +
      SCORING_WEIGHTS.shortDetour;

  return routes.map((route) => {
    const metrics = metricsByRoute.get(route.id) ?? {
      treeCount: 0,
      treeDensityPerKm: 0,
      buildingShadeMeters: 0,
      buildingShadeRatio: 0,
      parkCount: 0,
      waterCount: 0,
      restDensityPerKm: 0
    };
    const extraMinutes = Math.max(0, route.durationMinutes - shortestMinutes);
    const treeScore = maxTreeDensity > 0 ? (metrics.treeDensityPerKm / maxTreeDensity) * 100 : 0;
    const buildingShadeScore = usesBuildingShade ? (metrics.buildingShadeRatio / maxBuildingShadeRatio) * 100 : 0;
    const parkScore = Math.min(100, metrics.parkCount * 50);
    const restScore = maxRestDensity > 0 ? (metrics.restDensityPerKm / maxRestDensity) * 100 : 0;
    const detourScore = Math.max(0, 100 - extraMinutes * 12);
    const shadeScore = Math.round(
      (
        treeScore * SCORING_WEIGHTS.treeDensity +
        (usesBuildingShade ? buildingShadeScore * SCORING_WEIGHTS.buildingShade : 0) +
        parkScore * SCORING_WEIGHTS.greenPark +
        restScore * SCORING_WEIGHTS.waterAndRest +
        detourScore * SCORING_WEIGHTS.shortDetour
      ) / activeWeightTotal
    );

    return {
      routeId: route.id,
      shadeScore,
      treeCount: metrics.treeCount,
      treeDensityPerKm: metrics.treeDensityPerKm,
      buildingShadeMeters: metrics.buildingShadeMeters,
      buildingShadeRatio: metrics.buildingShadeRatio,
      parkCount: metrics.parkCount,
      waterCount: metrics.waterCount,
      extraMinutes,
      reasons: buildReasons(route, metrics, extraMinutes)
    };
  });
}

const demoWaypointCandidates: DemoNodeId[] = [
  "kiba-park",
  "toyo-water",
  "sendaibori-east",
  "sendaibori-west",
  "koto-office"
];

export function restSpotsNearRoute(route: RouteCandidate, restSpots: RestSpot[]): RestSpot[] {
  const line = turf.lineString(route.coordinates.map((point) => [point.lng, point.lat]));
  return restSpots.filter((spot) => {
    const point = turf.point([spot.position.lng, spot.position.lat]);
    const distance = turf.pointToLineDistance(point, line, { units: "meters" });
    return distance <= ROUTE_BUFFER_METERS * 4;
  });
}

function countNearRoute(route: RouteCandidate, items: Array<TreePoint | RestSpot>) {
  const line = turf.lineString(route.coordinates.map((point) => [point.lng, point.lat]));

  return items.filter((item) => {
    const point = turf.point([item.position.lng, item.position.lat]);
    return turf.pointToLineDistance(point, line, { units: "meters" }) <= ROUTE_BUFFER_METERS;
  }).length;
}

function routeBuildingShadeMeters(route: RouteCandidate, buildingShadows: BuildingShadow[]) {
  if (buildingShadows.length === 0) return 0;

  const shadowPolygons = buildingShadows
    .filter((item) => item.shadow.length >= 3)
    .map((item) => {
      const ring = item.shadow.map((point) => [point.lng, point.lat]);
      return turf.polygon([[...ring, ring[0]]]);
    });

  if (shadowPolygons.length === 0) return 0;

  return route.coordinates.slice(1).reduce((shadeMeters, point, index) => {
    const start = route.coordinates[index];
    const segmentMeters = distanceMeters(start, point);
    const samples = Math.max(1, Math.ceil(segmentMeters / BUILDING_SHADE_SAMPLE_METERS));
    const sampleMeters = segmentMeters / samples;

    for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
      const ratio = (sampleIndex + 0.5) / samples;
      const sample = turf.point([
        start.lng + (point.lng - start.lng) * ratio,
        start.lat + (point.lat - start.lat) * ratio
      ]);
      if (shadowPolygons.some((polygon) => turf.booleanPointInPolygon(sample, polygon))) {
        shadeMeters += sampleMeters;
      }
    }

    return shadeMeters;
  }, 0);
}

function buildReasons(route: RouteCandidate, metrics: {
  treeCount: number;
  treeDensityPerKm: number;
  buildingShadeMeters: number;
  buildingShadeRatio: number;
  parkCount: number;
  waterCount: number;
}, extraMinutes: number) {
  const reasons = [
    `${route.label}はルート周辺の街路樹密度が約${metrics.treeDensityPerKm.toFixed(1)}本/kmです`,
    `建物日陰の目安と重なる区間が約${Math.round(metrics.buildingShadeMeters)}m（ルートの約${Math.round(metrics.buildingShadeRatio * 100)}%）あります`,
    `最短ルートとの差分は約${extraMinutes}分です`
  ];

  if (metrics.parkCount > 0) reasons.push(`緑陰の多い公園を${metrics.parkCount}か所通ります`);
  if (metrics.waterCount > 0) reasons.push(`給水スポットが${metrics.waterCount}か所あります`);

  return reasons;
}
