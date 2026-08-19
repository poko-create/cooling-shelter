export type LatLng = {
  lat: number;
  lng: number;
};

export type AreaMode = "current" | "demo";

export type AvailabilityStatus = "open" | "busy" | "full";

export type Shelter = {
  id: string;
  name: string;
  address: string;
  capacity: number;
  openHours: string;
  position: LatLng;
  source: string;
};

export type Availability = {
  shelterId: string;
  status: AvailabilityStatus;
  updatedAt: string;
};

export type TreePoint = {
  id: string;
  species: string;
  position: LatLng;
};

export type RestSpotType = "park" | "water" | "shelter";

export type RestSpot = {
  id: string;
  name: string;
  type: RestSpotType;
  position: LatLng;
  source: string;
};

export type Destination = {
  label: string;
  position: LatLng;
  kind: "search" | "tap" | "shelter";
};

export type RouteCandidate = {
  id: string;
  label: string;
  coordinates: LatLng[];
  distanceMeters: number;
  durationMinutes: number;
  source: "openrouteservice" | "demo-fallback";
};

export type RouteScore = {
  routeId: string;
  shadeScore: number;
  treeCount: number;
  treeDensityPerKm: number;
  buildingShadeMeters: number;
  buildingShadeRatio: number;
  parkCount: number;
  waterCount: number;
  extraMinutes: number;
  reasons: string[];
};

export type HeatRisk = {
  level: "注意" | "警戒" | "厳重警戒" | "危険";
  score: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  apparentTemperature: number;
  uvIndex: number;
  wbgt: number;
  observedAt: string;
  source: string;
};

export type BuildingShadow = {
  id: string;
  name: string;
  footprint: LatLng[];
  shadow: LatLng[];
  heightMeters: number;
  source: string;
};

export type Poi = {
  id: string;
  name: string;
  category: string;
  position: LatLng;
  source: string;
};
