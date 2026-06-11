import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { buildAddressQuery, geocodeAddress } from "@/lib/geocoding";

interface LeafletSiteMapProps {
  lat: number;
  lng: number;
  label: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };

function hasValidCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

export function LeafletSiteMap({ lat, lng, label, address, city, state, zipCode }: LeafletSiteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerInstance = useRef<L.Marker | null>(null);
  const [resolved, setResolved] = useState(() => (hasValidCoordinates(lat, lng) ? { lat, lng } : null));
  const [geocoding, setGeocoding] = useState(false);
  const query = useMemo(() => buildAddressQuery([address, city, state, zipCode]), [address, city, state, zipCode]);

  useEffect(() => {
    if (hasValidCoordinates(lat, lng)) {
      setResolved({ lat, lng });
      return;
    }

    let active = true;
    if (!query) {
      setResolved(null);
      return () => {
        active = false;
      };
    }

    setGeocoding(true);
    void geocodeAddress(query).then((result) => {
      if (!active) return;
      setResolved(result);
      setGeocoding(false);
    });

    return () => {
      active = false;
    };
  }, [lat, lng, query]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const initial = resolved ?? DEFAULT_CENTER;
    const map = L.map(mapRef.current, {
      center: [initial.lat, initial.lng],
      zoom: resolved ? 15 : 4,
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap contributors © CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
      markerInstance.current = null;
    };
  }, [resolved]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !resolved) return;

    const orangeIcon = L.divIcon({
      className: "custom-map-pin",
      html: `<div style="width:20px;height:20px;background:#E18739;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(225,135,57,0.50);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    if (markerInstance.current) {
      markerInstance.current.setLatLng([resolved.lat, resolved.lng]).bindPopup(label);
    } else {
      markerInstance.current = L.marker([resolved.lat, resolved.lng], { icon: orangeIcon }).addTo(map).bindPopup(label);
    }
    map.setView([resolved.lat, resolved.lng], 15);
  }, [resolved, label]);

  return (
    <div className="relative overflow-hidden rounded-[10px]">
      <div ref={mapRef} style={{ height: 240, width: "100%", zIndex: 1 }} />
      {!resolved && (
        <div className="absolute inset-x-3 bottom-3 z-[2] rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(18,32,43,0.88)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
          {geocoding ? "Finding this address on the map..." : "Map location will appear after valid coordinates or a geocodable address is saved."}
        </div>
      )}
    </div>
  );
}
