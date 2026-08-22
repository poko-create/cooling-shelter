import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTrees } from "../src/data/mock/shelters";
import { filterGreenRestSpots, getRouteCandidates, scoreRoutes } from "../src/services/routes";
import type { BuildingShadow, Poi, RouteCandidate, Shelter } from "../src/types/domain";

describe("demo pedestrian fallback routes", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_ORS_API_KEY", "");
  });

  it("uses a pedestrian graph instead of a direct line for Koto demo routes", async () => {
    const routes = await getRouteCandidates(
      { lat: 35.6729, lng: 139.8174 },
      { lat: 35.6696, lng: 139.8334 }
    );

    expect(routes.length).toBe(3);
    expect(routes[0].source).toBe("demo-fallback");
    expect(routes[0].coordinates.length).toBeGreaterThan(4);
    expect(routes[0].coordinates).toContainEqual({ lat: 35.6699, lng: 139.8212 });
    expect(routes[0].coordinates).toContainEqual({ lat: 35.6687, lng: 139.8307 });
  });

  it("creates a green route through Kiba Park when requested by scoring candidates", async () => {
    const routes = await getRouteCandidates(
      { lat: 35.6729, lng: 139.8174 },
      { lat: 35.6802, lng: 139.8066 }
    );

    expect(routes.some((route) =>
      route.coordinates.some((point) => point.lat === 35.6765 && point.lng === 139.8077)
    )).toBe(true);
  });

  it("keeps fallback tree density nonzero around Ito-Yokado Kiba", async () => {
    const routes = await getRouteCandidates(
      { lat: 35.6729, lng: 139.8174 },
      { lat: 35.666383, lng: 139.803886 }
    );
    const scores = scoreRoutes(routes, mockTrees, []);

    expect(mockTrees.length).toBeGreaterThan(1000);
    expect(scores.some((score) => score.treeCount > 0 && score.treeDensityPerKm > 0)).toBe(true);
  });

  it("marks the shortest API route by distance even when it is not returned first", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://example.test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      features: [
        {
          geometry: { coordinates: [[139.81, 35.67], [139.82, 35.67], [139.83, 35.67]] },
          properties: { summary: { distance: 220, duration: 180 } }
        },
        {
          geometry: { coordinates: [[139.81, 35.67], [139.815, 35.67]] },
          properties: { summary: { distance: 110, duration: 90 } }
        }
      ]
    }), { status: 200 })));

    const routes = await getRouteCandidates(
      { lat: 35.67, lng: 139.81 },
      { lat: 35.67, lng: 139.815 }
    );

    expect(routes[0].id).toBe("shortest");
    expect(routes[0].distanceMeters).toBe(110);
    expect(routes[1].distanceMeters).toBe(220);
  });

  it("includes fallback trees beyond the Kiba demo core", () => {
    const ariakeAreaTrees = mockTrees.filter((tree) =>
      tree.position.lat >= 35.63 &&
      tree.position.lat <= 35.65 &&
      tree.position.lng >= 139.78 &&
      tree.position.lng <= 139.81
    );

    expect(mockTrees.length).toBeGreaterThan(9000);
    expect(ariakeAreaTrees.length).toBeGreaterThan(0);
  });

  it("filters green-score inputs to park and water spots only", () => {
    const items = [
      { id: "park-1", name: "公園", type: "park", position: { lat: 35.67, lng: 139.81 }, source: "test" },
      { id: "water-1", name: "給水", type: "water", position: { lat: 35.68, lng: 139.82 }, source: "test" },
      { id: "shelter-1", name: "避難所", type: "shelter", position: { lat: 35.69, lng: 139.83 }, source: "test" }
    ] as any;

    expect(filterGreenRestSpots(items)).toHaveLength(2);
    expect(filterGreenRestSpots(items).every((item) => item.type === "park" || item.type === "water")).toBe(true);
  });

  it("adds building shade overlap to route scores", () => {
    const routes: RouteCandidate[] = [
      {
        id: "sunny",
        label: "日なたルート",
        coordinates: [{ lat: 35.0, lng: 139.0 }, { lat: 35.0, lng: 139.002 }],
        distanceMeters: 180,
        durationMinutes: 3,
        source: "demo-fallback"
      },
      {
        id: "shady",
        label: "日陰ルート",
        coordinates: [{ lat: 35.001, lng: 139.0 }, { lat: 35.001, lng: 139.002 }],
        distanceMeters: 180,
        durationMinutes: 3,
        source: "demo-fallback"
      }
    ];
    const buildingShadows: BuildingShadow[] = [{
      id: "shade-1",
      name: "test shade",
      footprint: [],
      shadow: [
        { lat: 35.0008, lng: 138.9998 },
        { lat: 35.0012, lng: 138.9998 },
        { lat: 35.0012, lng: 139.0022 },
        { lat: 35.0008, lng: 139.0022 }
      ],
      heightMeters: 20,
      source: "test"
    }];

    const scores = scoreRoutes(routes, [], [], buildingShadows);
    const sunny = scores.find((score) => score.routeId === "sunny");
    const shady = scores.find((score) => score.routeId === "shady");

    expect(shady?.buildingShadeMeters).toBeGreaterThan(0);
    expect(shady?.buildingShadeRatio).toBeGreaterThan(0);
    expect(shady?.shadeScore).toBeGreaterThan(sunny?.shadeScore ?? 0);
  });

  it("scores building shade by route share instead of absolute shaded meters", () => {
    const routes: RouteCandidate[] = [
      {
        id: "short-shady",
        label: "短い日陰ルート",
        coordinates: [{ lat: 35.0, lng: 139.0 }, { lat: 35.0, lng: 139.001 }],
        distanceMeters: 90,
        durationMinutes: 2,
        source: "demo-fallback"
      },
      {
        id: "long-partial-shade",
        label: "長い一部日陰ルート",
        coordinates: [{ lat: 35.0, lng: 139.0 }, { lat: 35.0, lng: 139.004 }],
        distanceMeters: 360,
        durationMinutes: 5,
        source: "demo-fallback"
      }
    ];
    const buildingShadows: BuildingShadow[] = [{
      id: "shade-1",
      name: "test shade",
      footprint: [],
      shadow: [
        { lat: 34.9998, lng: 138.9998 },
        { lat: 35.0002, lng: 138.9998 },
        { lat: 35.0002, lng: 139.0012 },
        { lat: 34.9998, lng: 139.0012 }
      ],
      heightMeters: 20,
      source: "test"
    }];

    const scores = scoreRoutes(routes, [], [], buildingShadows);
    const shortShady = scores.find((score) => score.routeId === "short-shady");
    const longPartialShade = scores.find((score) => score.routeId === "long-partial-shade");

    expect(longPartialShade?.buildingShadeMeters).toBeGreaterThan(shortShady?.buildingShadeMeters ?? 0);
    expect(shortShady?.buildingShadeRatio).toBeGreaterThan(longPartialShade?.buildingShadeRatio ?? 0);
    expect(shortShady?.shadeScore).toBeGreaterThan(longPartialShade?.shadeScore ?? 0);
  });

  it("includes shelters and convenience stores in the water and rest score", () => {
    const routes: RouteCandidate[] = [
      {
        id: "plain",
        label: "通常ルート",
        coordinates: [{ lat: 35.006, lng: 139.0 }, { lat: 35.006, lng: 139.004 }],
        distanceMeters: 360,
        durationMinutes: 5,
        source: "demo-fallback"
      },
      {
        id: "rest-access",
        label: "休憩しやすいルート",
        coordinates: [{ lat: 35.001, lng: 139.0 }, { lat: 35.001, lng: 139.004 }],
        distanceMeters: 360,
        durationMinutes: 5,
        source: "demo-fallback"
      }
    ];
    const shelters: Shelter[] = [{
      id: "shelter-1",
      name: "シェルター",
      address: "test",
      capacity: 20,
      openHours: "9:00-17:00",
      position: { lat: 35.001, lng: 139.002 },
      source: "test"
    }];
    const convenienceStores: Poi[] = [{
      id: "convenience-1",
      name: "コンビニ",
      category: "convenience",
      position: { lat: 35.001, lng: 139.003 },
      source: "test"
    }];

    const scores = scoreRoutes(routes, [], [], [], shelters, convenienceStores);
    const plain = scores.find((score) => score.routeId === "plain");
    const restAccess = scores.find((score) => score.routeId === "rest-access");

    expect(restAccess?.shelterCount).toBe(1);
    expect(restAccess?.convenienceStoreCount).toBe(1);
    expect(restAccess?.shadeScore).toBeGreaterThan(plain?.shadeScore ?? 0);
    expect(restAccess?.reasons).toContain("ルート周辺50m以内にクーリングシェルターが1か所あります");
    expect(restAccess?.reasons).toContain("ルート周辺50m以内にコンビニが1か所あります");
  });
});
