import type { Availability, RestSpot, Shelter, TreePoint } from "../../types/domain";

export const mockShelters: Shelter[] = [
  {
    id: "koto-001",
    name: "江東区文化センター",
    address: "東京都江東区東陽4-11-3",
    capacity: 80,
    openHours: "9:00-21:00",
    position: { lat: 35.67067, lng: 139.81742 },
    source: "江東区 クーリングシェルター一覧（座標はデモ補完）"
  },
  {
    id: "koto-002",
    name: "深川北スポーツセンター",
    address: "東京都江東区平野3-2-20",
    capacity: 60,
    openHours: "9:00-22:00",
    position: { lat: 35.68018, lng: 139.80657 },
    source: "江東区 クーリングシェルター一覧（座標はデモ補完）"
  },
  {
    id: "koto-003",
    name: "江東図書館",
    address: "東京都江東区南砂6-7-52",
    capacity: 70,
    openHours: "9:00-20:00",
    position: { lat: 35.66961, lng: 139.83339 },
    source: "江東区 クーリングシェルター一覧（座標はデモ補完）"
  }
];

export const initialAvailability: Availability[] = [
  { shelterId: "koto-001", status: "open", updatedAt: new Date().toISOString() },
  { shelterId: "koto-002", status: "busy", updatedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString() },
  { shelterId: "koto-003", status: "full", updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() }
];

export const mockTrees: TreePoint[] = [
  { id: "tree-001", species: "ケヤキ", position: { lat: 35.6721, lng: 139.8167 } },
  { id: "tree-002", species: "イチョウ", position: { lat: 35.6728, lng: 139.8172 } },
  { id: "tree-003", species: "サクラ", position: { lat: 35.6735, lng: 139.8184 } },
  { id: "tree-004", species: "ケヤキ", position: { lat: 35.6741, lng: 139.8193 } },
  { id: "tree-005", species: "プラタナス", position: { lat: 35.6709, lng: 139.8202 } },
  { id: "tree-006", species: "イチョウ", position: { lat: 35.6699, lng: 139.8212 } },
  { id: "tree-007", species: "ケヤキ", position: { lat: 35.6762, lng: 139.8121 } },
  { id: "tree-008", species: "サクラ", position: { lat: 35.6784, lng: 139.8092 } }
];

export const mockRestSpots: RestSpot[] = [
  {
    id: "park-001",
    name: "木場公園",
    type: "park",
    position: { lat: 35.6765, lng: 139.8077 },
    source: "江東区 区立公園 / 街路樹近接による緑陰判定"
  },
  {
    id: "park-002",
    name: "洲崎川緑道公園",
    type: "park",
    position: { lat: 35.6678, lng: 139.8189 },
    source: "江東区 区立公園 / 街路樹近接による緑陰判定"
  },
  {
    id: "water-001",
    name: "Tokyowater Drinking Station 東陽",
    type: "water",
    position: { lat: 35.6715, lng: 139.8196 },
    source: "Tokyowater Drinking Station一覧（デモ抽出）"
  },
  {
    id: "water-002",
    name: "Tokyowater Drinking Station 木場",
    type: "water",
    position: { lat: 35.6751, lng: 139.8101 },
    source: "Tokyowater Drinking Station一覧（デモ抽出）"
  }
];
