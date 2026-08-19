import { afterEach, describe, expect, it, vi } from "vitest";
import { searchDestinationSuggestions } from "../src/services/destinationSearch";

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
});
