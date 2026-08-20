import { describe, expect, it, vi } from "vitest";
import { DEMO_AREA_BOUNDS } from "../src/config/area";
import { fetchConvenienceStores } from "../src/services/places";

describe("fetchConvenienceStores", () => {
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

    await expect(fetchConvenienceStores()).rejects.toThrow("Overpass convenience store request failed");
  });
});
