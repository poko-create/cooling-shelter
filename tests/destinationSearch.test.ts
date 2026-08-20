import { afterEach, describe, expect, it, vi } from "vitest";
import { searchDestination, searchDestinationSuggestions } from "../src/services/destinationSearch";

describe("destination search", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("suggests demo station destinations without external geocoding", async () => {
    const suggestions = await searchDestinationSuggestions("東雲駅");

    expect(suggestions[0]).toMatchObject({
      label: "東雲駅",
      position: { lat: 35.64056, lng: 139.804 }
    });
  });

  it("suggests general facilities from Overpass results", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("overpass-api")) {
        return new Response(JSON.stringify({
          elements: [{
            id: 1,
            type: "node",
            lat: 35.668,
            lon: 139.807,
            tags: { name: "スターバックス コーヒー 木場イトーヨーカドー店" }
          }]
        }), { status: 200 });
      }

      return new Response(JSON.stringify([]), { status: 200 });
    }));

    const suggestions = await searchDestinationSuggestions("スターバックス", { lat: 35.6729, lng: 139.8174 });

    expect(suggestions[0]).toMatchObject({
      label: "スターバックス コーヒー 木場イトーヨーカドー店",
      position: { lat: 35.668, lng: 139.807 }
    });
  });

  it("searches common brand aliases for Japanese facility names", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("overpass-api")) {
        return new Response(JSON.stringify({
          elements: [{
            id: 1,
            type: "node",
            lat: 35.668,
            lon: 139.807,
            tags: { brand: "Starbucks" }
          }]
        }), { status: 200 });
      }

      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const suggestions = await searchDestinationSuggestions("スタバ", { lat: 35.6729, lng: 139.8174 });
    const overpassBody = fetchMock.mock.calls.find(([url]) => String(url).includes("overpass-api"))?.[1]?.body as string;

    expect(overpassBody).toContain("Starbucks");
    expect(overpassBody).toContain("スターバックス");
    expect(suggestions[0]).toMatchObject({
      label: "Starbucks",
      position: { lat: 35.668, lng: 139.807 }
    });
  });

  it("returns null when no destination is found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));

    await expect(searchDestination("存在しない施設名", [], { lat: 35.6729, lng: 139.8174 })).resolves.toBeNull();
  });
});
