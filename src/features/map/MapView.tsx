import { useEffect, useRef } from "react";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { statusLabels, statusMarkerColors, statusShapes } from "../../services/status";
import type { Availability, BuildingShadow, Destination, LatLng, RestSpot, RouteCandidate, Shelter, Poi } from "../../types/domain";

type Props = {
  center: LatLng;
  currentPosition: LatLng;
  zoom: number;
  shelters: Shelter[];
  availability: Map<string, Availability>;
  restSpots: RestSpot[];
  convenienceStores: Poi[];
  buildingShadows: BuildingShadow[];
  showBuildingShade: boolean;
  showShelters: boolean;
  showConvenienceStores: boolean;
  showParkSpots: boolean;
  showWaterSpots: boolean;
  destination: Destination | null;
  selectedMapTap: LatLng | null;
  bestRoute: RouteCandidate | null;
  shortestRoute: RouteCandidate | null;
  onShelterSelect: (shelter: Shelter) => void;
  onPoiSelect: (poi: Poi) => void;
  onRestSpotSelect: (spot: RestSpot) => void;
  onMapTap: (position: LatLng) => void;
};

export function MapView({
  center,
  currentPosition,
  zoom,
  shelters,
  availability,
  restSpots,
  convenienceStores,
  buildingShadows,
  showBuildingShade,
  showShelters,
  showConvenienceStores,
  showParkSpots,
  showWaterSpots,
  destination,
  selectedMapTap,
  bestRoute,
  shortestRoute,
  onShelterSelect,
  onPoiSelect,
  onRestSpotSelect,
  onMapTap
}: Props) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;

    const map = L.map(nodeRef.current, {
      zoomControl: false
    }).setView([center.lat, center.lng], zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    map.on("click", (event) => onMapTap({ lat: event.latlng.lat, lng: event.latlng.lng }));
    mapRef.current = map;
  }, []);

  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    layer.clearLayers();

    if (showBuildingShade) {
      buildingShadows.forEach((item) => {
        L.polygon(item.shadow.map((point) => [point.lat, point.lng]), {
          color: "#1e293b",
          fillColor: "#1e293b",
          fillOpacity: 0.36,
          opacity: 0.46,
          weight: 0
        }).bindTooltip(`${item.name} / ${item.source}`).addTo(layer);

        L.polygon(item.footprint.map((point) => [point.lat, point.lng]), {
          color: "#64748b",
          fillColor: "#cbd5e1",
          fillOpacity: 0.24,
          opacity: 0.6,
          weight: 1
        }).bindTooltip(`${item.name} / 建物高さ 約${item.heightMeters}m`).addTo(layer);
      });
    }

    L.marker([currentPosition.lat, currentPosition.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="current-location-marker" aria-label="現在地"><span class="current-location-beam"></span><span class="current-location-dot"></span></div>`,
        iconSize: [88, 88],
        iconAnchor: [44, 44]
      })
    }).bindTooltip("現在地").addTo(layer);

    shelters.forEach((shelter) => {
      if (!showShelters) return;
      const status = availability.get(shelter.id)?.status ?? "open";
      const marker = L.marker([shelter.position.lat, shelter.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="map-pin" style="background:${statusMarkerColors[status]}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      });

      marker.bindTooltip(`${shelter.name} / ${statusLabels[status]}`);
      marker.on("click", () => onShelterSelect(shelter));
      marker.addTo(layer);
    });

    restSpots.forEach((spot) => {
      const isPark = spot.type === "park";
      if (isPark && !showParkSpots) return;
      if (!isPark && !showWaterSpots) return;

      const marker = L.marker([spot.position.lat, spot.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="rest-pin ${isPark ? "rest-pin-park" : "rest-pin-water"}">${isPark
              ? `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/></svg>`
              : `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1C7 19 7 17 9.5 17c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`
            }</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      });
      marker.bindTooltip(`${spot.name} / ${spot.source}`);
      marker.on("click", () => onRestSpotSelect(spot));
      marker.addTo(layer);
    });

    if (showConvenienceStores) {
      (convenienceStores || []).forEach((p) => {
        const marker = L.marker([p.position.lat, p.position.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="conv-pin">CV</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        });
        marker.bindTooltip(`${p.name} / ${p.source}`);
        marker.on("click", () => onPoiSelect(p));
        marker.addTo(layer);
      });
    }

    if (shortestRoute) {
      L.polyline(shortestRoute.coordinates.map((point) => [point.lat, point.lng]), {
        color: "#146b43",
        weight: 7,
        opacity: 0.85,
        dashArray: "10 8"
      }).addTo(layer);
    }

    if (bestRoute) {
      L.polyline(bestRoute.coordinates.map((point) => [point.lat, point.lng]), {
        color: "#0ea5e9",
        weight: 5,
        opacity: 0.95,
        dashArray: "4 8"
      }).addTo(layer);
    }

    const destinationMarker = destination
      ? { label: destination.label, position: destination.position }
      : selectedMapTap
        ? { label: "地図で指定した場所", position: selectedMapTap }
        : null;

    if (destinationMarker) {
      L.marker([destinationMarker.position.lat, destinationMarker.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="destination-pin">目</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24]
        })
      }).bindTooltip(destinationMarker.label).addTo(layer);
    }
  }, [availability, bestRoute, buildingShadows, center.lat, center.lng, convenienceStores, currentPosition.lat, currentPosition.lng, destination, onPoiSelect, onRestSpotSelect, onShelterSelect, restSpots, selectedMapTap, shelters, shortestRoute, showBuildingShade, showConvenienceStores, showParkSpots, showShelters, showWaterSpots]);

  return (
    <div className="relative h-full min-h-[54vh] w-full">
      <div ref={nodeRef} className="h-full min-h-[54vh] w-full" />
      <button
        type="button"
        aria-label="現在地に戻る"
        className="absolute bottom-[5.9rem] right-[10px] z-[900] flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-lg transition hover:bg-blue-50"
        onClick={(event) => {
          event.stopPropagation();
          mapRef.current?.setView([currentPosition.lat, currentPosition.lng], Math.max(zoom, 16));
        }}
      >
        <LocateFixed size={17} />
      </button>
    </div>
  );
}
