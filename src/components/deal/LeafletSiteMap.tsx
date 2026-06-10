import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LeafletSiteMapProps {
  lat?: number;
  lng?: number;
  label?: string;
}

export function LeafletSiteMap({ lat = 32.8198, lng = -96.7970, label = "McKinney Ave Location" }: LeafletSiteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "© OpenStreetMap contributors © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    const orangeIcon = L.divIcon({
      className: "custom-map-pin",
      html: `<div style="
        width: 20px; height: 20px;
        background: #E18739;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(225,135,57,0.50);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([lat, lng], { icon: orangeIcon })
      .addTo(map)
      .bindPopup(label);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [lat, lng, label]);

  return (
    <div
      ref={mapRef}
      style={{
        height: 240,
        width: "100%",
        borderRadius: 10,
        overflow: "hidden",
        zIndex: 1,
      }}
    />
  );
}
