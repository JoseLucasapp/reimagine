import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject } from "geojson";
import { dealBrands, type DealRecord } from "@/data/dealsData";
import { getSitesByDeal } from "@/data/mapRuntimeData";
import { resolveDealCoordinates, type CoordinatePrecision } from "@/lib/cityCoordinates";
import type { SavedTerritory, TerritoryBounds, TerritoryZip } from "@/data/territoryData";

type CityPin = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  precision: CoordinatePrecision;
  deals: DealRecord[];
};

export type DealCityMapResult = {
  pins: CityPin[];
  unmappedDeals: DealRecord[];
};

interface DealCityMapProps {
  deals: DealRecord[];
  className?: string;
  onComputed?: (result: DealCityMapResult) => void;
  territoryMode?: boolean;
  territoryZips?: TerritoryZip[];
  selectedZipCodes?: string[];
  savedTerritories?: SavedTerritory[];
  visibleTerritoryIds?: string[];
  onTerritoryViewportChange?: (bounds: TerritoryBounds) => void;
  onZipToggle?: (zipCode: string) => void;
}

const precisionColors: Record<CoordinatePrecision, string> = {
  site: "#059669",
  city: "#E18739",
  state: "#3B82F6",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createCityIcon(count: number, precision: CoordinatePrecision) {
  const color = precisionColors[precision];
  const size = count > 9 ? 34 : 30;
  return L.divIcon({
    className: "deal-city-marker",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};color:#fff;border:3px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:800;box-shadow:0 4px 14px rgba(15,23,42,0.28);
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createTerritoryLabelIcon(name: string, population: number) {
  const label = `${escapeHtml(name)} · ${population.toLocaleString()}`;
  return L.divIcon({
    className: "territory-label-marker",
    html: `<div style="
      background:#fff;color:#243c51;border:1px solid rgba(36,60,81,0.14);
      border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;
      box-shadow:0 8px 22px rgba(15,23,42,0.18);white-space:nowrap;
    ">${label}</div>`,
    iconSize: [160, 28],
    iconAnchor: [80, 14],
  });
}

export function buildDealCityPins(deals: DealRecord[]): DealCityMapResult {
  const grouped = new Map<string, CityPin>();
  const unmappedDeals: DealRecord[] = [];

  for (const deal of deals) {
    const resolved = resolveDealCoordinates(deal, getSitesByDeal(deal.id));
    if (!resolved.coordinates || !resolved.cityKey) {
      unmappedDeals.push(deal);
      continue;
    }

    const current = grouped.get(resolved.cityKey);
    if (current) {
      current.deals.push(deal);
      if (current.precision !== "site" && resolved.coordinates.precision === "site") {
        current.lat = resolved.coordinates.lat;
        current.lng = resolved.coordinates.lng;
        current.precision = "site";
      }
      continue;
    }

    grouped.set(resolved.cityKey, {
      key: resolved.cityKey,
      label: resolved.label,
      lat: resolved.coordinates.lat,
      lng: resolved.coordinates.lng,
      precision: resolved.coordinates.precision,
      deals: [deal],
    });
  }

  return {
    pins: [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label)),
    unmappedDeals,
  };
}

function popupHtml(pin: CityPin): string {
  const rows = pin.deals
    .map((deal) => {
      const brand = dealBrands.find((item) => item.id === deal.brandId);
      const name = deal.name || `${brand?.name ?? "Deal"} - ${deal.franchisee}`;
      return `
        <a href="/deals/${encodeURIComponent(deal.id)}" style="display:block;padding:8px 0;text-decoration:none;border-top:1px solid rgba(36,60,81,0.08);">
          <span style="display:block;font-size:13px;font-weight:700;color:#243c51;">${escapeHtml(name)}</span>
          <span style="display:block;font-size:12px;color:#64748b;margin-top:2px;">${escapeHtml(deal.franchisee || "Franchisee")} · ${escapeHtml(deal.status)}</span>
        </a>
      `;
    })
    .join("");

  return `
    <div style="min-width:240px;padding:4px;">
      <p style="font-size:14px;font-weight:800;margin:0;color:#111827;">${escapeHtml(pin.label)}</p>
      <p style="font-size:12px;color:#64748b;margin:2px 0 8px;">${pin.deals.length} deal${pin.deals.length === 1 ? "" : "s"} · ${pin.precision} coordinates</p>
      ${rows}
    </div>
  `;
}

function territoryCenter(zips: TerritoryZip[]): L.LatLngTuple {
  if (zips.length === 0) return [32.7767, -96.797];
  const totals = zips.reduce(
    (acc, zip) => ({ lat: acc.lat + zip.center[0], lng: acc.lng + zip.center[1] }),
    { lat: 0, lng: 0 },
  );
  return [totals.lat / zips.length, totals.lng / zips.length];
}

function layerHasBounds(layer: L.Layer): layer is L.Layer & { getBounds: () => L.LatLngBounds } {
  return typeof (layer as { getBounds?: unknown }).getBounds === "function";
}

export function DealCityMap({
  deals,
  className,
  onComputed,
  territoryMode = false,
  territoryZips = [],
  selectedZipCodes = [],
  savedTerritories = [],
  visibleTerritoryIds = [],
  onTerritoryViewportChange,
  onZipToggle,
}: DealCityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const savedTerritoryLayersRef = useRef<L.Layer[]>([]);
  const zipLayersRef = useRef<L.Layer[]>([]);
  const wasTerritoryModeRef = useRef(false);
  const hasFitSavedTerritoriesRef = useRef(false);
  const raisedTerritoryZoomRef = useRef(false);
  const result = useMemo(() => buildDealCityPins(deals), [deals]);

  useEffect(() => {
    onComputed?.(result);
  }, [onComputed, result]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    for (const pin of result.pins) {
      const marker = L.marker([pin.lat, pin.lng], {
        icon: createCityIcon(pin.deals.length, pin.precision),
      }).addTo(map);
      marker.bindPopup(popupHtml(pin));
      markersRef.current.push(marker);
    }

    if (result.pins.length > 0) {
      const bounds = L.latLngBounds(result.pins.map((pin) => [pin.lat, pin.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 9 });
    } else {
      map.setView([39.8283, -98.5795], 4);
    }
  }, [result]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    savedTerritoryLayersRef.current.forEach((layer) => layer.remove());
    savedTerritoryLayersRef.current = [];

    const zipByCode = new Map(territoryZips.map((zip) => [zip.zip, zip]));
    const visibleIds = new Set(visibleTerritoryIds);

    for (const territory of savedTerritories) {
      if (!visibleIds.has(territory.id)) continue;
      const zips = territory.zipCodes.map((zipCode) => zipByCode.get(zipCode)).filter(Boolean) as TerritoryZip[];
      if (zips.length === 0) continue;

      for (const zip of zips) {
        const layer = L.geoJSON(zip.geometry as GeoJsonObject, {
          style: {
            color: "#E18739",
            weight: 2,
            opacity: 0.78,
            fillColor: "#E18739",
            fillOpacity: 0.22,
          },
        }).addTo(map);
        layer.bindTooltip(`${territory.name} · ${zip.zip}`, { sticky: true });
        savedTerritoryLayersRef.current.push(layer);
      }

      const marker = L.marker(territoryCenter(zips), {
        interactive: false,
        icon: createTerritoryLabelIcon(territory.name, territory.population),
      }).addTo(map);
      savedTerritoryLayersRef.current.push(marker);
    }

    const visibleLayers = savedTerritoryLayersRef.current.filter(layerHasBounds);
    if (!territoryMode && !hasFitSavedTerritoriesRef.current && visibleLayers.length > 0) {
      const bounds = L.latLngBounds([]);
      visibleLayers.forEach((layer) => {
        bounds.extend(layer.getBounds());
      });
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
      hasFitSavedTerritoriesRef.current = true;
    }
  }, [savedTerritories, territoryMode, territoryZips, visibleTerritoryIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    zipLayersRef.current.forEach((layer) => layer.remove());
    zipLayersRef.current = [];

    const selected = new Set(selectedZipCodes);
    if (territoryMode) {
      for (const zip of territoryZips) {
        const isSelected = selected.has(zip.zip);
        const layer = L.geoJSON(zip.geometry as GeoJsonObject, {
          style: {
            color: isSelected ? "#243c51" : "#7bafc8",
            weight: isSelected ? 2.5 : 1.5,
            opacity: isSelected ? 0.9 : 0.48,
            fillColor: isSelected ? "#E18739" : "#7bafc8",
            fillOpacity: isSelected ? 0.3 : 0.1,
            dashArray: isSelected ? undefined : "5 5",
          },
          onEachFeature: () => undefined,
        }).addTo(map);
        layer.bindTooltip(`${zip.zip} · ${zip.label}`, { sticky: true });
        layer.on("click", () => onZipToggle?.(zip.zip));
        zipLayersRef.current.push(layer);
      }

      if (!wasTerritoryModeRef.current && territoryZips.length > 0) {
        const bounds = L.latLngBounds([]);
        zipLayersRef.current.filter(layerHasBounds).forEach((layer) => {
          bounds.extend(layer.getBounds());
        });
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    }

    wasTerritoryModeRef.current = territoryMode;
  }, [onZipToggle, selectedZipCodes, territoryMode, territoryZips]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !territoryMode || !onTerritoryViewportChange) return;

    const publishBounds = () => {
      if (!raisedTerritoryZoomRef.current && map.getZoom() < 6) {
        raisedTerritoryZoomRef.current = true;
        map.setZoomAround(map.getCenter(), 6);
        return;
      }

      const bounds = map.getBounds();
      onTerritoryViewportChange({
        north: bounds.getNorth(),
        east: bounds.getEast(),
        south: bounds.getSouth(),
        west: bounds.getWest(),
        zoom: map.getZoom(),
      });
    };

    map.on("moveend", publishBounds);
    publishBounds();

    return () => {
      map.off("moveend", publishBounds);
    };
  }, [onTerritoryViewportChange, territoryMode]);

  useEffect(() => {
    if (!territoryMode) raisedTerritoryZoomRef.current = false;
  }, [territoryMode]);

  return <div ref={containerRef} className={className || "w-full h-full"} style={{ minHeight: 420 }} />;
}
