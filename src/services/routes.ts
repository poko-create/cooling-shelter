import * as turf from "@turf/turf";
import { ROUTE_BUFFER_METERS, SCORING_WEIGHTS } from "../config/scoring";
import type { LatLng, RestSpot, RouteCandidate, RouteScore } from "../types/domain";
import type { TreePoint } from "../types/domain";

function distanceMeters(from: LatLng, to: LatLng) {
  return turf.distance([from.lng, from.lat], [to.lng, to.lat], { units: "kilometers" }) * 1000;
}

function routeDistance(coordinates: LatLng[]) {
  return coordinates.slice(1).reduce((sum, point, index) => sum + distanceMeters(coordinates[index], point), 0);
}

export async function getRouteCandidates(start: LatLng, end: LatLng): Promise<RouteCandidate[]> {
  const apiRoutes = await getOpenRouteServiceCandidates(start, end);
  if (apiRoutes.length > 0) return apiRoutes;

  const shortest = buildDemoPedestrianRoute(start, end);
  const viaGreen = buildDemoPedestrianRoute(start, end, "kiba-park");
  const viaWater = buildDemoPedestrianRoute(start, end, "toyo-water");

  return [shortest, viaGreen, viaWater].map((coordinates, index) => {
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
  restSpots: RestSpot[]
): RouteScore[] {
  const greenSpots = filterGreenRestSpots(restSpots);
  const shortestMinutes = Math.min(...routes.map((route) => route.durationMinutes));
  const maxTreeCount = Math.max(1, ...routes.map((route) => countNearRoute(route, trees)));
  const maxRestCount = Math.max(1, ...routes.map((route) => countNearRoute(route, greenSpots)));

  return routes.map((route) => {
    const treeCount = countNearRoute(route, trees);
    const nearRest = restSpotsNearRoute(route, greenSpots);
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
