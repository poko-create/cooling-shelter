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
      const status = availability.get(shelter.id)?.status ?? "open";
      const marker = L.marker([shelter.position.lat, shelter.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="map-pin" style="background:${statusMarkerColors[status]}"><span>${statusShapes[status]}</span></div>`,
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
          html: `<div class="rest-pin ${isPark ? "rest-pin-park" : "rest-pin-water"}">${isPark ? "木" : "水"}</div>`,
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
  }, [availability, bestRoute, buildingShadows, center.lat, center.lng, convenienceStores, destination, onPoiSelect, onShelterSelect, restSpots, shelters, shortestRoute, showBuildingShade, showConvenienceStores, showParkSpots, showWaterSpots]);

  return <div ref={nodeRef} className="h-full min-h-[54vh] w-full" />;
}
