import { useEffect, useRef } from "react";
import L from "leaflet";
import { statusLabels, statusMarkerColors, statusShapes } from "../../services/status";
import type { Availability, BuildingShadow, Destination, LatLng, RestSpot, RouteCandidate, Shelter, Poi } from "../../types/domain";

type Props = {
  center: LatLng;
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
  bestRoute: RouteCandidate | null;
  shortestRoute: RouteCandidate | null;
  onShelterSelect: (shelter: Shelter) => void;
  onPoiSelect: (poi: Poi) => void;
  onMapTap: (position: LatLng) => void;
};

export function MapView({
  center,
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
  bestRoute,
  shortestRoute,
  onShelterSelect,
  onPoiSelect,
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

    L.circleMarker([center.lat, center.lng], {
      radius: 8,
      color: "#075985",
      fillColor: "#0ea5e9",
      fillOpacity: 0.9
    }).bindTooltip("現在地").addTo(layer);

    shelters.forEach((shelter) => {
      if (!showShelters) return;
      const status = availability.get(shelter.id)?.status ?? "open";
      const marker = L.marker([shelter.position.lat, shelter.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="map-pin" style="background:${statusMarkerColors[status]}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg></div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
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

      L.marker([spot.position.lat, spot.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="rest-pin ${isPark ? "rest-pin-park" : "rest-pin-water"}">${isPark
              ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/></svg>`
              : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1C7 19 7 17 9.5 17c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`
            }</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).bindTooltip(`${spot.name} / ${spot.source}`).addTo(layer);
    });

    if (showConvenienceStores) {
      (convenienceStores || []).forEach((p) => {
        const marker = L.marker([p.position.lat, p.position.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="conv-pin">CV</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        });
        marker.bindTooltip(`${p.name} / ${p.source}`);
        marker.on("click", () => onPoiSelect(p));
        marker.addTo(layer);
      });
    }

    if (shortestRoute) {
      L.polyline(shortestRoute.coordinates.map((point) => [point.lat, point.lng]), {
        color: "#334155",
        weight: 5,
        opacity: 0.7,
        dashArray: "8 8"
      }).addTo(layer);
    }

    if (bestRoute) {
      L.polyline(bestRoute.coordinates.map((point) => [point.lat, point.lng]), {
        color: "#146b43",
        weight: 6,
        opacity: 0.9
      }).addTo(layer);
    }

    if (destination) {
      L.marker([destination.position.lat, destination.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="destination-pin">目</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 34]
        })
      }).bindTooltip(destination.label).addTo(layer);
    }
  }, [availability, bestRoute, buildingShadows, center.lat, center.lng, convenienceStores, destination, onPoiSelect, onShelterSelect, restSpots, shelters, shortestRoute, showBuildingShade, showConvenienceStores, showParkSpots, showShelters, showWaterSpots]);

  return <div ref={nodeRef} className="h-full min-h-[54vh] w-full" />;
}
