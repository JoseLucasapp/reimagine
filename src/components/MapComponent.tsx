import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Site, getDealById, getBrandById, DealStage } from "@/data/mapRuntimeData";

// Fix default marker icon issue in Leaflet when bundled by Vite.
type LeafletDefaultIconPrototype = L.Icon.Default & { _getIconUrl?: () => string };
delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const stageHexColors: Record<DealStage, string> = {
  Prospecting: "#5a9ec4",
  LOI: "#c89520",
  Lease: "#E18739",
  Open: "#4a9b6e",
  Closed: "#6b7a85",
};

function createStageIcon(stage: DealStage, highlighted: boolean = false) {
  const color = stageHexColors[stage];
  const size = highlighted ? 16 : 12;
  const border = highlighted ? 3 : 2;
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: ${size}px; height: ${size}px;
      background: ${color};
      border: ${border}px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ${highlighted ? "transform: scale(1.4);" : ""}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface MapComponentProps {
  sites: Site[];
  highlightedSiteId?: string | null;
  onSiteHover?: (siteId: string | null) => void;
  onSiteClick?: (siteId: string) => void;
  className?: string;
}

export function MapComponent({ sites, highlightedSiteId, onSiteHover, onSiteClick, className }: MapComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([39.8283, -98.5795], 4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    sites.forEach((site) => {
      const deal = getDealById(site.dealId);
      const brand = deal ? getBrandById(deal.brandId) : null;
      const isHighlighted = highlightedSiteId === site.id;

      const marker = L.marker([site.lat, site.lng], {
        icon: createStageIcon(site.stage, isHighlighted),
      }).addTo(map);

      const popupHtml = `
        <div style="min-width:200px;padding:4px;">
          <p style="font-weight:600;font-size:14px;margin:0">${site.address}</p>
          <p style="font-size:12px;color:#666;margin:2px 0">${site.city}, ${site.state}</p>
          ${brand ? `<p style="font-size:12px;color:#666;margin:2px 0">${brand.name}</p>` : ""}
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;background:${stageHexColors[site.stage]}22;color:${stageHexColors[site.stage]};border:1px solid ${stageHexColors[site.stage]}44">${site.stage}</span>
          ${site.notes ? `<p style="font-size:12px;color:#666;margin-top:8px">${site.notes}</p>` : ""}
        </div>
      `;
      marker.bindPopup(popupHtml);

      marker.on("mouseover", () => onSiteHover?.(site.id));
      marker.on("mouseout", () => onSiteHover?.(null));
      marker.on("click", () => onSiteClick?.(site.id));

      markersRef.current.set(site.id, marker);
    });

    // Fit bounds
    if (sites.length > 0) {
      const bounds = L.latLngBounds(sites.map((s) => [s.lat, s.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [sites, highlightedSiteId, onSiteHover, onSiteClick]);

  return <div ref={containerRef} className={className || "w-full h-full"} style={{ minHeight: "400px" }} />;
}
