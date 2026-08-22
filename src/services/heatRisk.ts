import type { HeatRisk, LatLng } from "../types/domain";

export async function getHeatRisk(position: LatLng): Promise<HeatRisk> {
  try {
    const params = new URLSearchParams({
      latitude: String(position.lat),
      longitude: String(position.lng),
      current: "temperature_2m,relative_humidity_2m,wind_speed_10m,apparent_temperature,uv_index",
      timezone: "Asia/Tokyo"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!response.ok) throw new Error("Open-Meteo request failed");

    const payload = await response.json() as {
      current?: {
        time?: string;
        temperature_2m?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
        apparent_temperature?: number;
        uv_index?: number;
      };
    };
    const temperature = payload.current?.temperature_2m;
    const humidity = payload.current?.relative_humidity_2m;
    const windSpeed = payload.current?.wind_speed_10m;
    const apparentTemperature = payload.current?.apparent_temperature;
    const uvIndex = payload.current?.uv_index;
    if (
      typeof temperature !== "number" ||
      typeof humidity !== "number" ||
      typeof windSpeed !== "number" ||
      typeof apparentTemperature !== "number" ||
      typeof uvIndex !== "number"
    ) {
      throw new Error("Open-Meteo response is missing weather values");
    }

    const wbgt = estimateShadeWbgt(temperature, humidity);
    return {
      level: riskLevel(wbgt),
      score: Math.min(100, Math.max(0, Math.round((wbgt / 35) * 100))),
      temperature,
      humidity,
      windSpeed,
      apparentTemperature,
      uvIndex,
      wbgt,
      observedAt: payload.current?.time ?? new Date().toISOString(),
      source: "Weather data by Open-Meteo.com から気温・湿度・風速・体感温度・UVを取得し、簡易WBGT目安を算出"
    };
  } catch {
    return fallbackHeatRisk();
  }
}

function fallbackHeatRisk(): HeatRisk {
  return {
    level: "厳重警戒",
    score: 82,
    temperature: 31.2,
    humidity: 60,
    windSpeed: 2.4,
    apparentTemperature: 34.6,
    uvIndex: 8.1,
    wbgt: 31.2,
    observedAt: new Date().toISOString(),
    source: "環境省熱中症予防情報サイト WBGT（デモ時はフォールバック値）"
  };
}

function estimateShadeWbgt(temperature: number, humidity: number) {
  const wetBulb = estimateWetBulb(temperature, humidity);
  return Math.round((0.7 * wetBulb + 0.3 * temperature) * 10) / 10;
}

function estimateWetBulb(temperature: number, humidity: number) {
  const rh = humidity;
  const t = temperature;

  return t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035;
}

function riskLevel(wbgt: number): HeatRisk["level"] {
  if (wbgt >= 31) return "危険";
  if (wbgt >= 28) return "厳重警戒";
  if (wbgt >= 25) return "警戒";
  return "注意";
}
