import { describe, expect, it, vi } from "vitest";
import { getHeatRisk } from "../src/services/heatRisk";

describe("getHeatRisk", () => {
  it("returns current temperature alongside WBGT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          current: {
            time: "2026-08-16T12:00:00",
            temperature_2m: 32.4,
            relative_humidity_2m: 55,
            wind_speed_10m: 2.8,
            apparent_temperature: 35.1,
            uv_index: 7.2
          }
        })
      })
    );

    const result = await getHeatRisk({ lat: 35.67, lng: 139.81 });

    expect(result.temperature).toBe(32.4);
    expect(result.humidity).toBe(55);
    expect(result.windSpeed).toBe(2.8);
    expect(result.apparentTemperature).toBe(35.1);
    expect(result.uvIndex).toBe(7.2);
    expect(result.wbgt).toBeGreaterThan(0);
  });
});
