import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRouteCandidates } from "../src/services/routes";

describe("demo pedestrian fallback routes", () => {
  beforeEach(() => {
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

    expect(routes[1].coordinates).toContainEqual({ lat: 35.6765, lng: 139.8077 });
  });
});
