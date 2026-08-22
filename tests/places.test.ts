import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_AREA_BOUNDS } from "../src/config/area";

describe("fetchConvenienceStores", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("queries convenience stores across the Koto demo bounds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [{
          type: "node",
          id: 1,
          lat: 35.67,
          lon: 139.82,
          tags: { name: "テストコンビニ", shop: "convenience" }
        }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchConvenienceStores } = await importPlaces();
    const stores = await fetchConvenienceStores();
    const body = fetchMock.mock.calls[0][1].body as string;

    expect(body).toContain(`node["shop"="convenience"](${DEMO_AREA_BOUNDS.minLat},${DEMO_AREA_BOUNDS.minLng},${DEMO_AREA_BOUNDS.maxLat},${DEMO_AREA_BOUNDS.maxLng})`);
    expect(stores).toEqual([{
      id: "node/1",
      name: "テストコンビニ",
      category: "convenience",
      position: { lat: 35.67, lng: 139.82 },
      source: "overpass"
    }]);
  });

  it("throws when Overpass fails so the app can keep fallback stores", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const { fetchConvenienceStores } = await importPlaces();
    await expect(fetchConvenienceStores()).rejects.toThrow("Overpass convenience store request failed");
  });

  it("uses the configured worker API before falling back to Overpass", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: "node/2",
          name: "APIコンビニ",
          category: "convenience",
          position: { lat: 35.68, lng: 139.82 },
          source: "overpass"
        }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchConvenienceStores: fetchFromConfiguredApi } = await importPlaces("https://api.example.test/");
    const stores = await fetchFromConfiguredApi();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/api/places/convenience");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET" });
    expect(stores).toEqual([{
      id: "node/2",
      name: "APIコンビニ",
      category: "convenience",
      position: { lat: 35.68, lng: 139.82 },
      source: "overpass"
    }]);
  });
});

async function importPlaces(apiBase = "") {
  vi.resetModules();
  vi.stubEnv("VITE_API_BASE_URL", apiBase);
  return import("../src/services/places");
}
