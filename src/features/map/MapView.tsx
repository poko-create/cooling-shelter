import { useEffect, useRef } from "react";
import L from "leaflet";
import { statusLabels, statusMarkerColors, statusShapes } from "../../services/status";
import type { Availability, BuildingShadow, Destination, LatLng, RestSpot, RouteCandidate, Shelter } from "../../types/domain";

type Props = {
  center: LatLng;
  zoom: number;
  shelters: Shelter[];
  availability: Map<string, Availability>;
  restSpots: RestSpot[];
  buildingShadows: BuildingShadow[];
  showBuildingShade: boolean;
  destination: Destination | null;
  bestRoute: RouteCandidate | null;
  shortestRoute: RouteCandidate | null;
  onShelterSelect: (shelter: Shelter) => void;
  onMapTap: (position: LatLng) => void;
};

const modernMarkerColors: Record<string, string> = {
  open: "#06b6d4",
  busy: "#fbbf24",
  full: "#94a3b8"
};

export function MapView({
  center,
  zoom,
  shelters,
  availability,
  restSpots,
  buildingShadows,
  showBuildingShade,
  destination,
  bestRoute,
  shortestRoute,
  onShelterSelect,
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

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
          color: "#0e7490",
          fillColor: "#0e7490",
          fillOpacity: 0.18,
          opacity: 0.25,
          weight: 0
        }).bindTooltip(`${item.name} / ${item.source}`).addTo(layer);

        L.polygon(item.footprint.map((point) => [point.lat, point.lng]), {
          color: "#94a3b8",
          fillColor: "#e2e8f0",
          fillOpacity: 0.2,
          opacity: 0.5,
          weight: 1
        }).bindTooltip(`${item.name} / 建物高さ 約${item.heightMeters}m`).addTo(layer);
      });
    }

    L.circleMarker([center.lat, center.lng], {
      radius: 8,
      color: "#0891b2",
      fillColor: "#06b6d4",
      fillOpacity: 0.9,
      weight: 2,
      opacity: 0.8
    }).bindTooltip("現在地").addTo(layer);

    shelters.forEach((shelter) => {
      const status = availability.get(shelter.id)?.status ?? "open";
      const color = modernMarkerColors[status];
      const marker = L.marker([shelter.position.lat, shelter.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="map-pin" style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%)"><span>${statusShapes[status]}</span></div>`,
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
      const gradient = isPark
        ? "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)"
        : "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)";
      L.marker([spot.position.lat, spot.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="rest-pin" style="background: ${gradient}">${isPark ? "木" : "水"}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).bindTooltip(`${spot.name} / ${spot.source}`).addTo(layer);
    });

    if (shortestRoute) {
      L.polyline(shortestRoute.coordinates.map((point) => [point.lat, point.lng]), {
        color: "#94a3b8",
        weight: 4,
        opacity: 0.6,
        dashArray: "10 6"
      }).addTo(layer);
    }

    if (bestRoute) {
      L.polyline(bestRoute.coordinates.map((point) => [point.lat, point.lng]), {
        color: "#06b6d4",
        weight: 6,
        opacity: 0.85
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
  }, [availability, bestRoute, buildingShadows, center.lat, center.lng, destination, onShelterSelect, restSpots, shelters, shortestRoute, showBuildingShade]);

  return <div ref={nodeRef} className="h-full min-h-[54vh] w-full rounded-none" />;
}
