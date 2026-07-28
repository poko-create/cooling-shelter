import fs from "node:fs/promises";
import path from "node:path";

const TILESET_URL =
  "https://assets.cms.plateau.reearth.io/assets/4d/ba6c87-3dd2-496e-8091-a1aa32bb83cc/13108_koto-ku_pref_2025_citygml_1_op_bldg_3dtiles_13108_koto-ku_lod1/tileset.json";
const TILESET_BASE = TILESET_URL.replace(/tileset\.json$/, "");
const OUTPUT = "src/data/plateau/kotoDemoBuildings.json";
const TARGET_BOUNDS = {
  minLng: 139.795,
  maxLng: 139.836,
  minLat: 35.668,
  maxLat: 35.681
};
const MAX_BUILDINGS = 700;

const tileset = await fetchJson(TILESET_URL);
const tileUrls = [];
collectTileUrls(tileset.root);

const buildingsById = new Map();
for (const url of tileUrls) {
  const buffer = Buffer.from(await (await fetch(url)).arrayBuffer());
  for (const building of parseB3dmBuildings(buffer)) {
    if (!intersects(building.bounds, TARGET_BOUNDS)) continue;
    if (!Number.isFinite(building.heightMeters) || building.heightMeters <= 0) continue;
    buildingsById.set(building.id, building);
  }
}

const buildings = [...buildingsById.values()]
  .sort((a, b) => b.heightMeters - a.heightMeters)
  .slice(0, MAX_BUILDINGS);

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(OUTPUT, `${JSON.stringify({
  source: "PLATEAU 3D都市モデル 建築物モデル（江東区）LOD1 2025",
  sourceUrl: TILESET_URL,
  bounds: TARGET_BOUNDS,
  generatedAt: new Date().toISOString(),
  buildings
}, null, 2)}\n`);

console.log(`Wrote ${buildings.length} buildings to ${OUTPUT}`);

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

function collectTileUrls(node) {
  if (!intersects(regionToBounds(node.boundingVolume?.region || node.content?.boundingVolume?.region), TARGET_BOUNDS)) {
    return;
  }
  if (node.content?.uri?.endsWith(".b3dm")) {
    tileUrls.push(new URL(node.content.uri, TILESET_BASE).toString());
  }
  for (const child of node.children ?? []) collectTileUrls(child);
}

function parseB3dmBuildings(buffer) {
  const featureTableJsonLength = buffer.readUInt32LE(12);
  const featureTableBinaryLength = buffer.readUInt32LE(16);
  const batchTableJsonLength = buffer.readUInt32LE(20);
  const batchTableBinaryLength = buffer.readUInt32LE(24);
  const featureTableStart = 28;
  const batchTableJsonStart = featureTableStart + featureTableJsonLength + featureTableBinaryLength;
  const batchTableBinaryStart = batchTableJsonStart + batchTableJsonLength;
  const featureTable = JSON.parse(buffer.subarray(featureTableStart, featureTableStart + featureTableJsonLength).toString());
  const batchTable = JSON.parse(buffer.subarray(batchTableJsonStart, batchTableJsonStart + batchTableJsonLength).toString());
  const batchTableBinary = buffer.subarray(batchTableBinaryStart, batchTableBinaryStart + batchTableBinaryLength);
  const length = featureTable.BATCH_LENGTH ?? 0;
  const xmins = readBatchArray(batchTable._xmin, batchTableBinary, length);
  const xmaxs = readBatchArray(batchTable._xmax, batchTableBinary, length);
  const ymins = readBatchArray(batchTable._ymin, batchTableBinary, length);
  const ymaxs = readBatchArray(batchTable._ymax, batchTableBinary, length);
  const heights = batchTable["bldg:measuredHeight"] ?? readBatchArray(batchTable._zmax, batchTableBinary, length);
  const ids = batchTable.gml_id ?? batchTable["uro:BuildingIDAttribute_uro:buildingID"] ?? [];

  return Array.from({ length }, (_, index) => {
    const bounds = {
      minLng: xmins[index],
      maxLng: xmaxs[index],
      minLat: ymins[index],
      maxLat: ymaxs[index]
    };

    return {
      id: String(ids[index] ?? `plateau-building-${index}`),
      heightMeters: Number(heights[index] ?? 12),
      bounds,
      footprint: [
        [bounds.minLng, bounds.maxLat],
        [bounds.maxLng, bounds.maxLat],
        [bounds.maxLng, bounds.minLat],
        [bounds.minLng, bounds.minLat]
      ]
    };
  });
}

function readBatchArray(descriptor, binary, length) {
  if (Array.isArray(descriptor)) return descriptor;
  const values = [];
  const offset = descriptor?.byteOffset ?? 0;
  const componentType = descriptor?.componentType ?? "DOUBLE";
  for (let index = 0; index < length; index += 1) {
    const byteOffset = offset + index * byteSize(componentType);
    values.push(readNumber(binary, byteOffset, componentType));
  }
  return values;
}

function readNumber(buffer, offset, componentType) {
  if (componentType === "DOUBLE") return buffer.readDoubleLE(offset);
  if (componentType === "FLOAT") return buffer.readFloatLE(offset);
  if (componentType === "UNSIGNED_INT") return buffer.readUInt32LE(offset);
  if (componentType === "INT") return buffer.readInt32LE(offset);
  if (componentType === "UNSIGNED_SHORT") return buffer.readUInt16LE(offset);
  if (componentType === "SHORT") return buffer.readInt16LE(offset);
  if (componentType === "UNSIGNED_BYTE") return buffer.readUInt8(offset);
  if (componentType === "BYTE") return buffer.readInt8(offset);
  return Number.NaN;
}

function byteSize(componentType) {
  if (componentType === "DOUBLE") return 8;
  if (componentType === "FLOAT" || componentType === "UNSIGNED_INT" || componentType === "INT") return 4;
  if (componentType === "UNSIGNED_SHORT" || componentType === "SHORT") return 2;
  return 1;
}

function regionToBounds(region) {
  if (!region) return TARGET_BOUNDS;
  const rad = 180 / Math.PI;
  return {
    minLng: region[0] * rad,
    minLat: region[1] * rad,
    maxLng: region[2] * rad,
    maxLat: region[3] * rad
  };
}

function intersects(a, b) {
  return !(a.maxLng < b.minLng || a.minLng > b.maxLng || a.maxLat < b.minLat || a.minLat > b.maxLat);
}
