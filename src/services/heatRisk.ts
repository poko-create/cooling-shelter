import type { HeatRisk, LatLng } from "../types/domain";

export async function getHeatRisk(_position: LatLng): Promise<HeatRisk> {
  return {
    level: "厳重警戒",
    score: 82,
    wbgt: 31.2,
    observedAt: new Date().toISOString(),
    source: "環境省熱中症予防情報サイト WBGT（デモ時はフォールバック値）"
  };
}
