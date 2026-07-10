import { useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Search, Layers, X, Plus, Minus, Circle, Clock, Hash, Pentagon, Users,
  Save, FileBarChart2, Target, Download, MapPin as MapPinIcon, Eye, EyeOff, Grid3x3, Trash2,
} from "lucide-react";
import { MAP_LIGHT_STYLE, MAP_DARK_STYLE } from "@/lib/mapbox";
import "./mapiq.css";


// ---------- Types
export type MapIQLevel = 1 | 2 | 3;

export type MapIQPinData = {
  id: string;
  lngLat: [number, number];
  kind: "study" | "portfolio" | "deal" | "context";
  color?: string;
  label?: string;
  payload: Record<string, any>;
};

export type MapIQStat = { value: string; label: string };

export type MapIQDetail = {
  title: string;
  address: string;
  statusLabel?: string;
  statusColor?: string;
  photoUrl?: string;
  miniStats: { label: string; value: string }[];
  keyMetricsTitle: string;
  keyMetrics: { label: string; value: string }[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
};

export type MapIQAction = { label: string; primary?: boolean; onClick: () => void; icon?: React.ComponentType<any> };

export type MapIQTerritory = {
  id: string;
  name: string;
  zips: string[];
  population: number;
  centroid: [number, number];
  visible: boolean;
};

export type MapIQZipFeature = {
  zip: string;
  label: string;
  center: [number, number];
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
};

export type MapIQZipDemographics = {
  population: number | null;
  medianAge: number | null;
  medianHouseholdIncome: number | null;
  households: number | null;
  age25To44: number | null;
  age65Plus: number | null;
  ownerOccupied: number | null;
  renterOccupied: number | null;
};

export type MapIQHeaderStat = { label: string; value: number | string; color: string };

export type MapIQSelectionSummary = {
  zips: string[];
  totalPopulation: number;
  shapes: { id: string; tool: "radius" | "drive" | "polygon" | "pop"; label: string }[];
  hasSelection: boolean;
};

export type MapIQProps = {
  level: MapIQLevel;
  pins: MapIQPinData[];
  defaultCenter?: [number, number];
  defaultZoom?: number;
  contextBadge?: ReactNode;
  actions: MapIQAction[];
  showSavedViews?: boolean;
  showDrawTools?: boolean;
  fitPinsOnLoad?: boolean;
  enableTerritoryBuilder?: boolean;
  initialTerritories?: MapIQTerritory[];
  territoryZips?: MapIQZipFeature[];
  selectedZipCodes?: string[];
  zipPopulations?: Record<string, number | null>;
  zipDemographics?: Record<string, MapIQZipDemographics | null>;
  loadingZipCodes?: string[];
  territoryLoading?: boolean;
  territoryError?: string | null;
  savedTerritories?: MapIQTerritory[];
  territoryName?: string;
  targetPopulation?: number;
  onTerritoryNameChange?: (value: string) => void;
  onTargetPopulationChange?: (value: number) => void;
  onTerritoryViewportChange?: (bounds: { north: number; east: number; south: number; west: number; zoom?: number }) => void;
  onZipToggle?: (zipCode: string) => void;
  onTerritoryClear?: () => void;
  onTerritorySave?: (territory: { name: string; targetPopulation: number; zipCodes: string[]; population: number; centroid: [number, number] }) => void;
  onTerritoryVisibilityToggle?: (id: string) => void;
  onTerritoryDelete?: (id: string) => void;
  headerStats?: MapIQHeaderStat[];
  onSelectionChange?: (summary: MapIQSelectionSummary) => void;

  buildStats: (pin: MapIQPinData) => MapIQStat[];
  buildDetail: (pin: MapIQPinData) => MapIQDetail;
  siteList?: {
    rows: { id: string; status: string; statusColor: string; name: string; address: string; meta?: string; number?: number }[];
    tabs: string[];
  };
  searchSuggestions?: { label: string; sub: string; lngLat: [number, number] }[];
};

const DETAIL_PANEL_HEIGHT = 280;
const isDocumentDark = () => document.documentElement.classList.contains("dark");

function buildZipFeatureCollection(zips: MapIQZipFeature[], populations: Record<string, number | null> = {}) {
  return {
    type: "FeatureCollection" as const,
    features: zips.map((zip) => ({
      type: "Feature" as const,
      properties: {
        ZCTA5CE10: zip.zip,
        GEOID10: zip.zip,
        NAME: zip.label,
        population: populations[zip.zip] ?? null,
      },
      geometry: zip.geometry,
    })),
  };
}

// ---------- Helper components
function FloatingStatCards({ pin, stats }: { pin: MapIQPinData; stats: MapIQStat[] }) {
  return (
    <div className="mapiq-stats">
      {stats.map((s, i) => (
        <div key={i} className="mapiq-stat-card" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="v">{s.value}</div>
          <div className="l">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

const DRAW_TOOLS = [
  { key: "radius", icon: Circle, label: "radius" },
  { key: "drive", icon: Clock, label: "drive time" },
  { key: "zip", icon: Hash, label: "zip selector" },
  { key: "polygon", icon: Pentagon, label: "polygon" },
  { key: "pop", icon: Users, label: "population radius" },
] as const;

const RADIUS_MILE_OPTIONS = [1, 3, 5, 10, 15];
const DRIVE_MINUTE_OPTIONS = [5, 10, 15, 20, 30];
const POP_RADIUS_MILE_OPTIONS = [1, 3, 5, 10];
const EARTH_RADIUS_METERS = 6378137;
const METERS_PER_MILE = 1609.344;
type RadiusTool = "radius" | "drive" | "pop";

function isFiniteMetric(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatMetricNumber(value: number | null | undefined): string {
  return isFiniteMetric(value) ? Math.round(value).toLocaleString() : "—";
}

function formatMetricDecimal(value: number | null | undefined): string {
  return isFiniteMetric(value) ? value.toFixed(1) : "—";
}

function formatMetricCurrency(value: number | null | undefined): string {
  return isFiniteMetric(value) ? `$${Math.round(value).toLocaleString()}` : "—";
}

function formatMetricPercent(value: number | null | undefined): string {
  return isFiniteMetric(value) ? `${Math.round(value)}%` : "—";
}

function sumMetric(values: Array<number | null | undefined>): number | null {
  const total = values.reduce((sum, value) => sum + (isFiniteMetric(value) ? value : 0), 0);
  return total > 0 ? total : null;
}

function weightedAverageMetric(
  values: MapIQZipDemographics[],
  valueFor: (value: MapIQZipDemographics) => number | null,
  weightFor: (value: MapIQZipDemographics) => number | null,
): number | null {
  let weightedTotal = 0;
  let weightTotal = 0;
  values.forEach((value) => {
    const metric = valueFor(value);
    const weight = weightFor(value);
    if (!isFiniteMetric(metric) || !isFiniteMetric(weight) || weight <= 0) return;
    weightedTotal += metric * weight;
    weightTotal += weight;
  });
  return weightTotal > 0 ? weightedTotal / weightTotal : null;
}

function isRadiusTool(tool: string | null): tool is RadiusTool {
  return tool === "radius" || tool === "drive" || tool === "pop";
}

function clampLatitude(latitude: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

function mercatorScale(latitude: number): number {
  return Math.max(0.15, Math.cos((clampLatitude(latitude) * Math.PI) / 180));
}

function projectMercator(point: [number, number]): [number, number] {
  const lng = (point[0] * Math.PI) / 180;
  const lat = (clampLatitude(point[1]) * Math.PI) / 180;
  return [
    EARTH_RADIUS_METERS * lng,
    EARTH_RADIUS_METERS * Math.log(Math.tan(Math.PI / 4 + lat / 2)),
  ];
}

function unprojectMercator(point: [number, number]): [number, number] {
  return [
    (point[0] / EARTH_RADIUS_METERS) * (180 / Math.PI),
    (2 * Math.atan(Math.exp(point[1] / EARTH_RADIUS_METERS)) - Math.PI / 2) * (180 / Math.PI),
  ];
}

function mercatorDistanceMiles(a: [number, number], b: [number, number]): number {
  const [ax, ay] = projectMercator(a);
  const [bx, by] = projectMercator(b);
  const projectedMeters = Math.hypot(bx - ax, by - ay);
  return (projectedMeters * mercatorScale(a[1])) / METERS_PER_MILE;
}

function formatMiles(value: number): string {
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function driveMinutesFromRadiusMiles(radiusMiles: number): number {
  return Math.max(1, Math.round(radiusMiles * 3));
}

// ---------- Main
export function MapIQCanvas(props: MapIQProps) {
  const {
    level, pins, defaultCenter = [-96.7970, 32.8198], defaultZoom = 11,
    contextBadge, actions, showSavedViews, buildStats, buildDetail, siteList, searchSuggestions = [],
    showDrawTools = false,
    fitPinsOnLoad,
    enableTerritoryBuilder = false,
    initialTerritories = [],
    territoryZips = [],
    selectedZipCodes,
    zipPopulations: controlledZipPopulations,
    zipDemographics: controlledZipDemographics,
    loadingZipCodes = [],
    territoryLoading = false,
    territoryError = null,
    savedTerritories: controlledSavedTerritories,
    territoryName: controlledTerritoryName,
    targetPopulation: controlledTargetPopulation,
    onTerritoryNameChange,
    onTargetPopulationChange,
    onTerritoryViewportChange,
    onZipToggle,
    onTerritoryClear,
    onTerritorySave,
    onTerritoryVisibilityToggle,
    onTerritoryDelete,
    headerStats,
    onSelectionChange,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentStyleRef = useRef<string | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bottomState, setBottomState] = useState<"closed" | "mid" | "full">("closed");
  const [statsAnchor, setStatsAnchor] = useState<{ x: number; y: number } | null>(null);
  const [isDarkMap, setIsDarkMap] = useState(isDocumentDark);

  const [layerOpen, setLayerOpen] = useState(false);
  const [siteListOpen, setSiteListOpen] = useState(false);

  // Keep the left side overlays closed whenever the bottom detail panel is open.
  useEffect(() => {
    if (bottomState !== "closed") {
      setLayerOpen(false);
      setSiteListOpen(false);
    }
  }, [bottomState]);

  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(3);
  const [driveMinutes, setDriveMinutes] = useState(15);
  const [populationRadiusMiles, setPopulationRadiusMiles] = useState(5);

  const [search, setSearch] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const [siteListTab, setSiteListTab] = useState<string>("All");

  // ---- Draw shapes state
  type DrawShape = {
    id: string;
    tool: RadiusTool | "polygon";
    feature: any;               // GeoJSON Feature (Polygon)
    labelPoint: [number, number];
    labelText: string;
    color: string;
  };
  const [drawShapes, setDrawShapes] = useState<DrawShape[]>([]);
  const drawShapesRef = useRef<DrawShape[]>([]);
  const shapeLabelMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [polygonInProgress, setPolygonInProgress] = useState<[number, number][]>([]);
  const polygonInProgressRef = useRef<[number, number][]>([]);
  const activeToolRef = useRef<string | null>(null);
  const radiusMilesRef = useRef(radiusMiles);
  const driveMinutesRef = useRef(driveMinutes);
  const populationRadiusMilesRef = useRef(populationRadiusMiles);
  const radiusDragRef = useRef<{ tool: RadiusTool; center: [number, number]; moved: boolean } | null>(null);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { radiusMilesRef.current = radiusMiles; }, [radiusMiles]);
  useEffect(() => { driveMinutesRef.current = driveMinutes; }, [driveMinutes]);
  useEffect(() => { populationRadiusMilesRef.current = populationRadiusMiles; }, [populationRadiusMiles]);
  useEffect(() => { drawShapesRef.current = drawShapes; }, [drawShapes]);
  useEffect(() => { polygonInProgressRef.current = polygonInProgress; }, [polygonInProgress]);

  // ---- Save View state
  type SavedView = { id: string; name: string; center: [number, number]; zoom: number; date: string };
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const raw = localStorage.getItem("mapiq-saved-views");
      return raw ? (JSON.parse(raw) as SavedView[]) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem("mapiq-saved-views", JSON.stringify(savedViews)); } catch {}
  }, [savedViews]);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");

  // ---- Territory Builder state
  const territoryReady = useRef(false);
  const territoryLabelsRef = useRef<Record<string, maplibregl.Marker>>({});
  const hoveredZipRef = useRef<string | null>(null);
  const [territoryActive, setTerritoryActive] = useState(false);
  const [savedTerritories, setSavedTerritories] = useState<MapIQTerritory[]>(initialTerritories);
  const [selectedZips, setSelectedZips] = useState<string[]>([]);
  const selectedZipsRef = useRef<string[]>([]);
  const [zipPopulations, setZipPopulations] = useState<Record<string, number>>({});
  const [territoryName, setTerritoryName] = useState("");
  const [targetPopulation, setTargetPopulation] = useState(100000);
  const [editingTarget, setEditingTarget] = useState(false);
  const [displayPop, setDisplayPop] = useState(0);
  const activeSelectedZips = selectedZipCodes ?? selectedZips;
  const activeZipPopulations = controlledZipPopulations ?? zipPopulations;
  const activeZipDemographics = controlledZipDemographics ?? {};
  const activeSavedTerritories = controlledSavedTerritories ?? savedTerritories;
  const activeTerritoryName = controlledTerritoryName ?? territoryName;
  const activeTargetPopulation = controlledTargetPopulation ?? targetPopulation;

  const getZipPopulation = useCallback((zip: string) => {
    return activeZipDemographics[zip]?.population ?? activeZipPopulations[zip] ?? 0;
  }, [activeZipDemographics, activeZipPopulations]);

  useEffect(() => {
    selectedZipsRef.current = activeSelectedZips;
  }, [activeSelectedZips]);

  const toggleZipSelection = useCallback((zip: string) => {
    if (!zip) return;
    if (onZipToggle) {
      onZipToggle(zip);
      return;
    }
    const current = selectedZipsRef.current;
    if (current.includes(zip)) {
      const next = current.filter((z) => z !== zip);
      selectedZipsRef.current = next;
      setSelectedZips(next);
      return;
    }

    const next = [...current, zip];
    selectedZipsRef.current = next;
    setSelectedZips(next);
  }, [onZipToggle]);

  const setZipHover = useCallback((zip: string | null) => {
    const map = mapRef.current;
    if (hoveredZipRef.current === zip) return;
    hoveredZipRef.current = zip;
    if (!map || !map.isStyleLoaded()) return;
    const filter = ["==", ["get", "ZCTA5CE10"], zip ?? ""] as any;
    try {
      if (map.getLayer("zip-hover-fill")) map.setFilter("zip-hover-fill", filter);
      if (map.getLayer("zip-hover-line")) map.setFilter("zip-hover-line", filter);
    } catch {}
  }, []);

  const ensureTerritoryLayers = useCallback((map: maplibregl.Map) => {
    if (!enableTerritoryBuilder || !map.isStyleLoaded()) return;
    try {
      if (!map.getSource("zip-codes")) {
        map.addSource("zip-codes", {
          type: "geojson",
          data: buildZipFeatureCollection(territoryZips, activeZipPopulations),
        });
      }
      if (!map.getLayer("zip-fills")) {
        map.addLayer({
          id: "zip-fills", type: "fill", source: "zip-codes",
          paint: { "fill-color": "rgba(36,60,81,0)", "fill-opacity": 1 },
        });
      }
      if (!map.getLayer("zip-outlines")) {
        map.addLayer({
          id: "zip-outlines", type: "line", source: "zip-codes",
          paint: { "line-color": "rgba(36,60,81,0)", "line-width": 1, "line-opacity": 1 },
        });
      }
      if (!map.getLayer("zip-hover-fill")) {
        map.addLayer({
          id: "zip-hover-fill", type: "fill", source: "zip-codes",
          filter: ["==", ["get", "ZCTA5CE10"], ""] as any,
          paint: {
            "fill-color": isDocumentDark()
              ? "rgba(91,164,217,0.22)" : "rgba(91,164,217,0.18)",
            "fill-opacity": 1,
          },
        });
      }
      if (!map.getLayer("zip-hover-line")) {
        map.addLayer({
          id: "zip-hover-line", type: "line", source: "zip-codes",
          filter: ["==", ["get", "ZCTA5CE10"], ""] as any,
          paint: {
            "line-color": isDocumentDark() ? "#7DC4F2" : "#2478B5",
            "line-width": 2,
          },
        });
      }
      if (!map.getLayer("territory-fills")) {
        map.addLayer({
          id: "territory-fills", type: "fill", source: "zip-codes",
          filter: ["in", ["get", "ZCTA5CE10"], ["literal", [] as string[]]] as any,
          paint: {
            "fill-color": isDocumentDark()
              ? "rgba(225,135,57,0.30)" : "rgba(225,135,57,0.20)",
            "fill-opacity": 1,
          },
        });
      }
      if (!map.getLayer("territory-outlines")) {
        map.addLayer({
          id: "territory-outlines", type: "line", source: "zip-codes",
          filter: ["in", ["get", "ZCTA5CE10"], ["literal", [] as string[]]] as any,
          paint: { "line-color": "rgba(225,135,57,0.90)", "line-width": 2 },
        });
      }
      territoryReady.current = true;
    } catch (err) {
      console.warn("Territory layer init failed", err);
    }
  }, [activeZipPopulations, enableTerritoryBuilder, territoryZips]);

  // Bind (or rebind) click/hover listeners on the zip-fills layer.
  // Must be called after ensureTerritoryLayers whenever the style is (re)loaded.
  const zipListenersBoundRef = useRef(false);
  const bindZipListeners = useCallback((map: maplibregl.Map) => {
    if (!enableTerritoryBuilder) return;
    const onEnter = () => {
      if (territoryActiveRef.current) map.getCanvas().style.cursor = "pointer";
    };
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (!territoryActiveRef.current) {
        setZipHover(null);
        map.getCanvas().style.cursor = "";
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      const zip = e.features?.[0]?.properties?.ZCTA5CE10 as string | undefined;
      setZipHover(zip ?? null);
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      setZipHover(null);
    };
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (!territoryActiveRef.current || !e.features?.length) return;
      e.preventDefault();
      (e.originalEvent as MouseEvent & { __mapiqZipHandled?: boolean }).__mapiqZipHandled = true;
      const zip = e.features[0].properties?.ZCTA5CE10 as string;
      toggleZipSelection(zip);
    };
    // MapLibre keeps layer-scoped listeners keyed by layerId; after setStyle
    // the layer is recreated so we must re-attach.
    map.on("mouseenter", "zip-fills", onEnter);
    map.on("mousemove", "zip-fills", onMove);
    map.on("mouseleave", "zip-fills", onLeave);
    map.on("click", "zip-fills", onClick);
    zipListenersBoundRef.current = true;
  }, [enableTerritoryBuilder, setZipHover, toggleZipSelection]);

  // ---- Draw shape helpers
  const makeCirclePolygon = (center: [number, number], radiusMiles: number, steps = 64) => {
    const centerMercator = projectMercator(center);
    const projectedRadiusMeters = (radiusMiles * METERS_PER_MILE) / mercatorScale(center[1]);
    const coords: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      coords.push(unprojectMercator([
        centerMercator[0] + projectedRadiusMeters * Math.cos(a),
        centerMercator[1] + projectedRadiusMeters * Math.sin(a),
      ]));
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
  };

  const SHAPE_COLORS: Record<string, string> = {
    radius: "#E18739",
    drive: "#5BA4D9",
    polygon: "#243C51",
    pop: "#8B5CF6",
  };

  const ensureShapeLayers = useCallback((map: maplibregl.Map) => {
    if (!map.isStyleLoaded()) return;
    try {
      if (!map.getSource("mapiq-shapes")) {
        map.addSource("mapiq-shapes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      }
      if (!map.getLayer("mapiq-shapes-fill")) {
        map.addLayer({
          id: "mapiq-shapes-fill", type: "fill", source: "mapiq-shapes",
          paint: { "fill-color": ["coalesce", ["get", "color"], "#E18739"], "fill-opacity": 0.18 },
        });
      }
      if (!map.getLayer("mapiq-shapes-line")) {
        map.addLayer({
          id: "mapiq-shapes-line", type: "line", source: "mapiq-shapes",
          paint: { "line-color": ["coalesce", ["get", "color"], "#E18739"], "line-width": 2 },
        });
      }
      if (!map.getSource("mapiq-radius-preview")) {
        map.addSource("mapiq-radius-preview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      }
      if (!map.getLayer("mapiq-radius-preview-fill")) {
        map.addLayer({
          id: "mapiq-radius-preview-fill", type: "fill", source: "mapiq-radius-preview",
          paint: { "fill-color": ["coalesce", ["get", "color"], "#E18739"], "fill-opacity": 0.14 },
        });
      }
      if (!map.getLayer("mapiq-radius-preview-line")) {
        map.addLayer({
          id: "mapiq-radius-preview-line", type: "line", source: "mapiq-radius-preview",
          paint: {
            "line-color": ["coalesce", ["get", "color"], "#E18739"],
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      }
      if (!map.getSource("mapiq-poly-preview")) {
        map.addSource("mapiq-poly-preview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      }
      if (!map.getLayer("mapiq-poly-preview-line")) {
        map.addLayer({
          id: "mapiq-poly-preview-line", type: "line", source: "mapiq-poly-preview",
          paint: { "line-color": "#243C51", "line-width": 2, "line-dasharray": [2, 2] },
        });
      }
    } catch (err) { console.warn("shape layer init failed", err); }
  }, []);

  const updateShapesSource = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("mapiq-shapes") as any;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: drawShapesRef.current.map((s) => ({
        ...s.feature,
        properties: { ...s.feature.properties, color: s.color, id: s.id },
      })),
    });
    // labels
    shapeLabelMarkersRef.current.forEach((m) => m.remove());
    shapeLabelMarkersRef.current = [];
    drawShapesRef.current.forEach((s) => {
      const el = document.createElement("div");
      el.className = "mapiq-shape-label";
      el.style.background = s.color;
      el.textContent = s.labelText;
      const marker = new maplibregl.Marker({ element: el }).setLngLat(s.labelPoint).addTo(map);
      shapeLabelMarkersRef.current.push(marker);
    });
  }, []);

  const updateRadiusPreview = useCallback((feature: any | null, color = "#E18739") => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("mapiq-radius-preview") as any;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: feature ? [{ ...feature, properties: { ...feature.properties, color } }] : [],
    });
  }, []);

  const defaultRadiusForTool = (tool: RadiusTool): number => {
    if (tool === "drive") return Math.max(1, driveMinutesRef.current / 3);
    if (tool === "pop") return populationRadiusMilesRef.current;
    return radiusMilesRef.current;
  };

  const makeRadiusShape = (tool: RadiusTool, center: [number, number], radiusMilesValue: number): DrawShape => {
    const radius = Math.max(0.1, radiusMilesValue);
    const labelText =
      tool === "drive"
        ? `${driveMinutesFromRadiusMiles(radius)} min drive time`
        : tool === "pop"
          ? `${formatMiles(radius)} mi population radius`
          : `${formatMiles(radius)} mi radius`;

    return {
      id: `shape-${Date.now()}`,
      tool,
      feature: makeCirclePolygon(center, radius),
      labelPoint: center,
      labelText,
      color: SHAPE_COLORS[tool] || "#E18739",
    };
  };

  const commitRadiusShape = useCallback((tool: RadiusTool, center: [number, number], radiusMilesValue: number) => {
    const shape = makeRadiusShape(tool, center, radiusMilesValue);
    drawShapesRef.current = [...drawShapesRef.current, shape];
    setDrawShapes(drawShapesRef.current);
    updateRadiusPreview(null);
    updateShapesSource();
    activeToolRef.current = null;
    setActiveTool(null);
  }, [makeRadiusShape, updateRadiusPreview, updateShapesSource]);

  const updatePolyPreview = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      ensureShapeLayers(map);
      const src = map.getSource("mapiq-poly-preview") as any;
      if (!src) return;
      const pts = polygonInProgressRef.current;
      src.setData({
        type: "FeatureCollection",
        features: pts.length >= 2 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: pts }, properties: {} }] : [],
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
  }, [ensureShapeLayers]);

  const focusPinAboveDetailPanel = useCallback((pin: MapIQPinData, desiredZoom = 12) => {
    const map = mapRef.current;
    if (!map) return;
    const mapHeight = map.getContainer().clientHeight || 0;
    const visibleMapHeight = Math.max(240, mapHeight - DETAIL_PANEL_HEIGHT);
    const targetY = Math.min(visibleMapHeight - 60, Math.max(220, visibleMapHeight * 0.55));
    const offsetY = targetY - (mapHeight / 2);

    map.flyTo({
      center: pin.lngLat,
      zoom: Math.max(map.getZoom(), desiredZoom),
      offset: [0, offsetY],
      duration: 700,
      essential: true,
    });
  }, []);


  const selectedPin = useMemo(
    () => (selectedId ? pins.find((p) => p.id === selectedId) ?? null : null),
    [selectedId, pins],
  );

  // Map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initialStyle = isDocumentDark() ? MAP_DARK_STYLE : MAP_LIGHT_STYLE;
    currentStyleRef.current = initialStyle;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: defaultCenter,
      zoom: defaultZoom,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      if (pins.length > 1 && (fitPinsOnLoad ?? level !== 1)) {
        const bounds = new maplibregl.LngLatBounds();
        pins.forEach((p) => bounds.extend(p.lngLat));
        map.fitBounds(bounds, { padding: 120, maxZoom: 13, duration: 0 });
      }

      // ---- Territory Builder: load zip boundary source & layers
      if (enableTerritoryBuilder) {
        try {
          ensureTerritoryLayers(map);
          bindZipListeners(map);
        } catch (err) {
          console.warn("Territory layer init failed", err);
        }
      }

      // ---- Draw shape layers + click handler
      ensureShapeLayers(map);
      updateShapesSource();

      const finishRadiusDrag = (lngLat: [number, number]) => {
        const draft = radiusDragRef.current;
        if (!draft) return;
        const draggedRadius = mercatorDistanceMiles(draft.center, lngLat);
        const radius = draft.moved && draggedRadius >= 0.05
          ? draggedRadius
          : defaultRadiusForTool(draft.tool);
        radiusDragRef.current = null;
        try { map.dragPan.enable(); } catch {}
        commitRadiusShape(draft.tool, draft.center, radius);
      };

      map.on("mousedown", (e) => {
        const tool = activeToolRef.current;
        if (!isRadiusTool(tool)) return;
        const originalEvent = e.originalEvent as MouseEvent | undefined;
        if (typeof originalEvent?.button === "number" && originalEvent.button !== 0) return;

        e.preventDefault();
        const center: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        radiusDragRef.current = { tool, center, moved: false };
        try { map.dragPan.disable(); } catch {}
        window.addEventListener("mouseup", (event) => {
          if (!radiusDragRef.current) return;
          const rect = map.getCanvas().getBoundingClientRect();
          const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
          const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
          const lngLat = map.unproject([x, y]);
          finishRadiusDrag([lngLat.lng, lngLat.lat]);
        }, { once: true });
      });

      map.on("mousemove", (e) => {
        const draft = radiusDragRef.current;
        if (!draft) return;
        const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const radius = Math.max(0.1, mercatorDistanceMiles(draft.center, cursor));
        if (radius >= 0.05) draft.moved = true;
        updateRadiusPreview(makeCirclePolygon(draft.center, radius), SHAPE_COLORS[draft.tool]);
      });

      map.on("mouseup", (e) => {
        finishRadiusDrag([e.lngLat.lng, e.lngLat.lat]);
      });

      map.on("click", (e) => {
        const tool = activeToolRef.current;
        if (!tool) return;
        if (tool === "zip") {
          if (!territoryActiveRef.current) return;
          if ((e.originalEvent as MouseEvent & { __mapiqZipHandled?: boolean }).__mapiqZipHandled) return;
          const zipFeatures = map.queryRenderedFeatures(e.point, { layers: ["zip-fills"] });
          const zip = zipFeatures[0]?.properties?.ZCTA5CE10 as string | undefined;
          if (zip) toggleZipSelection(zip);
          return;
        }
        const originalEvent = e.originalEvent as MouseEvent | undefined;
        if (originalEvent?.detail && originalEvent.detail > 1) return;
        const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        if (tool === "polygon") {
          const next = [...polygonInProgressRef.current, lngLat];
          polygonInProgressRef.current = next;
          setPolygonInProgress(next);
          updatePolyPreview();
          return;
        }

        if (!isRadiusTool(tool)) return;
        commitRadiusShape(tool, lngLat, defaultRadiusForTool(tool));
      });

      map.on("dblclick", (e) => {
        if (activeToolRef.current !== "polygon") return;
        e.preventDefault();
        const pts = polygonInProgressRef.current;
        if (pts.length < 3) { polygonInProgressRef.current = []; setPolygonInProgress([]); updatePolyPreview(); return; }
        const ring = [...pts, pts[0]];
        const centroid: [number, number] = [
          pts.reduce((s, p) => s + p[0], 0) / pts.length,
          pts.reduce((s, p) => s + p[1], 0) / pts.length,
        ];
        const shape: DrawShape = {
          id: `shape-${Date.now()}`,
          tool: "polygon",
          feature: { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} },
          labelPoint: centroid,
          labelText: "Custom area",
          color: SHAPE_COLORS.polygon,
        };
        drawShapesRef.current = [...drawShapesRef.current, shape];
        setDrawShapes(drawShapesRef.current);
        updateShapesSource();
        polygonInProgressRef.current = [];
        setPolygonInProgress([]);
        updatePolyPreview();
        setActiveTool(null);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkMap(root.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || pins.length === 0) return;
    if (!(fitPinsOnLoad ?? level !== 1)) return;
    if (pins.length === 1) {
      map.flyTo({ center: pins[0].lngLat, zoom: Math.max(defaultZoom, 9), duration: 500 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    pins.forEach((pin) => bounds.extend(pin.lngLat));
    map.fitBounds(bounds, { padding: 120, maxZoom: 13, duration: 500 });
  }, [defaultZoom, fitPinsOnLoad, level, pins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextStyle = isDarkMap ? MAP_DARK_STYLE : MAP_LIGHT_STYLE;
    if (currentStyleRef.current === nextStyle) return;
    const restoreCustomLayers = () => {
      ensureTerritoryLayers(map);
      // Re-attach layer-scoped event handlers destroyed by setStyle
      if (enableTerritoryBuilder) bindZipListeners(map);
      const visibleZips = activeSavedTerritories.filter((t) => t.visible).flatMap((t) => t.zips);
      try {
        if (map.getLayer("zip-outlines")) {
          map.setPaintProperty("zip-outlines", "line-color", territoryActive ? "rgba(36,60,81,0.20)" : "rgba(36,60,81,0)");
        }
        if (map.getLayer("zip-fills")) {
          map.setPaintProperty("zip-fills", "fill-color", territoryActive ? [
            "case",
            ["in", ["get", "ZCTA5CE10"], ["literal", activeSelectedZips]] as any,
            "rgba(225,135,57,0.25)",
            "rgba(36,60,81,0)",
          ] as any : "rgba(36,60,81,0)");
        }
        if (map.getLayer("territory-fills")) {
          map.setFilter("territory-fills", ["in", ["get", "ZCTA5CE10"], ["literal", visibleZips]] as any);
        }
        if (map.getLayer("territory-outlines")) {
          map.setFilter("territory-outlines", ["in", ["get", "ZCTA5CE10"], ["literal", visibleZips]] as any);
        }
      } catch {}
      ensureShapeLayers(map);
      updateShapesSource();
      updatePolyPreview();
    };

    map.once("style.load", restoreCustomLayers);
    currentStyleRef.current = nextStyle;
    territoryReady.current = false;
    map.setStyle(nextStyle);
    return () => { map.off("style.load", restoreCustomLayers); };
  }, [activeSavedTerritories, activeSelectedZips, bindZipListeners, enableTerritoryBuilder, ensureTerritoryLayers, isDarkMap, territoryActive, ensureShapeLayers, updateShapesSource, updatePolyPreview]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enableTerritoryBuilder) return;
    const apply = () => {
      ensureTerritoryLayers(map);
      const source = map.getSource("zip-codes") as { setData?: (data: unknown) => void } | undefined;
      source?.setData?.(buildZipFeatureCollection(territoryZips, activeZipPopulations));
    };
    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
    return () => { map.off("idle", apply); };
  }, [activeZipPopulations, enableTerritoryBuilder, ensureTerritoryLayers, territoryZips]);

  const territoryActiveRef = useRef(false);
  useEffect(() => { territoryActiveRef.current = territoryActive; }, [territoryActive]);
  useEffect(() => {
    if (!territoryActive) setZipHover(null);
  }, [setZipHover, territoryActive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enableTerritoryBuilder || !territoryActive || !onTerritoryViewportChange) return;
    const emitViewport = () => {
      const bounds = map.getBounds();
      onTerritoryViewportChange({
        north: bounds.getNorth(),
        east: bounds.getEast(),
        south: bounds.getSouth(),
        west: bounds.getWest(),
        zoom: map.getZoom(),
      });
    };
    emitViewport();
    map.on("moveend", emitViewport);
    map.on("zoomend", emitViewport);
    return () => {
      map.off("moveend", emitViewport);
      map.off("zoomend", emitViewport);
    };
  }, [enableTerritoryBuilder, onTerritoryViewportChange, territoryActive]);

  // Re-position stat-card anchor when map moves
  const updateAnchor = useCallback(() => {
    if (!mapRef.current || !selectedPin) { setStatsAnchor(null); return; }
    const rootRect = containerRef.current?.getBoundingClientRect();
    const markerEl = markersRef.current[selectedPin.id]?.getElement();
    const pinEl = markerEl?.querySelector<HTMLElement>(".mapiq-pin") ?? markerEl;
    if (rootRect && pinEl) {
      const pinRect = pinEl.getBoundingClientRect();
      setStatsAnchor({
        x: pinRect.left - rootRect.left + pinRect.width / 2,
        y: pinRect.top - rootRect.top,
      });
      return;
    }
    const p = mapRef.current.project(selectedPin.lngLat);
    setStatsAnchor({ x: p.x, y: p.y - 16 });
  }, [selectedPin]);

  useEffect(() => {
    if (!mapRef.current) return;
    updateAnchor();
    const m = mapRef.current;
    m.on("move", updateAnchor);
    m.on("zoom", updateAnchor);
    return () => {
      m.off("move", updateAnchor);
      m.off("zoom", updateAnchor);
    };
  }, [updateAnchor]);

  // Render markers
  useEffect(() => {
    if (!mapRef.current) return;
    // remove stale
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const element = m.getElement();
      const usesLegacyMarkerShell = element.classList.contains("mapiq-marker-shell");
      const missingInnerShell = !element.querySelector(".mapiq-marker-shell");
      if (!pins.find((p) => p.id === id) || usesLegacyMarkerShell || missingInnerShell) {
        m.remove();
        delete markersRef.current[id];
      }
    });
    pins.forEach((pin) => {
      if (markersRef.current[pin.id]) {
        const anchor = markersRef.current[pin.id].getElement();
        const shell = anchor.querySelector<HTMLElement>(".mapiq-marker-shell") ?? anchor;
        shell.classList.toggle("selected", pin.id === selectedId);
        const pinEl = shell.querySelector<HTMLElement>(".mapiq-pin") ?? shell;
        pinEl.className = `mapiq-pin ${pin.kind}${pin.id === selectedId ? " selected" : ""}`;
        pinEl.style.background = pin.color || "";
        const labelEl = pinEl.querySelector<HTMLElement>(".mapiq-pin-label");
        if (labelEl) labelEl.textContent = pin.label || "";
        markersRef.current[pin.id].setLngLat(pin.lngLat);
        return;
      }

      const anchor = document.createElement("div");
      anchor.className = "mapiq-marker-anchor";

      const shell = document.createElement("div");
      shell.className = "mapiq-marker-shell";
      if (pin.id === selectedId) shell.classList.add("selected");

      const el = document.createElement("div");
      el.className = `mapiq-pin ${pin.kind}${pin.id === selectedId ? " selected" : ""}`;
      if (pin.color) el.style.background = pin.color;

      const label = document.createElement("span");
      label.className = "mapiq-pin-label";
      label.textContent = pin.label || "";
      el.appendChild(label);

      if (pin.kind !== "context") {
        const pulse = document.createElement("div");
        pulse.className = "mapiq-pin-pulse";
        el.appendChild(pulse);
        shell.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedId(pin.id);
          setBottomState("mid");
          focusPinAboveDetailPanel(pin);
        });
      }

      shell.appendChild(el);
      anchor.appendChild(shell);
      const marker = new maplibregl.Marker({ element: anchor, anchor: "center" }).setLngLat(pin.lngLat).addTo(mapRef.current!);
      markersRef.current[pin.id] = marker;
    });
  }, [focusPinAboveDetailPanel, pins, selectedId]);

  // Tool toast (skip zip when territory builder is enabled — panel drives the flow)
  useEffect(() => {
    if (!activeTool) { setToast(null); return; }
    if (activeTool === "zip" && enableTerritoryBuilder) {
      setToast("Click zip codes to build your territory");
      return;
    }
    const tool = DRAW_TOOLS.find((t) => t.key === activeTool);
    if (tool) {
      setToast(isRadiusTool(activeTool)
        ? `Click or drag on the map to draw your ${tool.label}`
        : `Click on the map to draw your ${tool.label}`);
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [activeTool, enableTerritoryBuilder]);

  // Cursor + Escape-to-cancel while a draw tool is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    const isDraw = activeTool && ["radius", "drive", "polygon", "pop"].includes(activeTool);
    canvas.style.cursor = isDraw ? "crosshair" : "";

    // Disable native double-click zoom while polygon tool is active so
    // double-clicking to finish a polygon doesn't zoom the map.
    if (activeTool === "polygon") {
      try { map.doubleClickZoom.disable(); } catch {}
    } else {
      try { map.doubleClickZoom.enable(); } catch {}
    }

    if (activeTool !== "polygon" && polygonInProgressRef.current.length > 0) {
      polygonInProgressRef.current = [];
      setPolygonInProgress([]);
      updatePolyPreview();
    }
    if (!isRadiusTool(activeTool) && radiusDragRef.current) {
      radiusDragRef.current = null;
      updateRadiusPreview(null);
      try { map.dragPan.enable(); } catch {}
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        polygonInProgressRef.current = [];
        setPolygonInProgress([]);
        radiusDragRef.current = null;
        updateRadiusPreview(null);
        updatePolyPreview();
        try { map.dragPan.enable(); } catch {}
        setActiveTool(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      canvas.style.cursor = "";
      radiusDragRef.current = null;
      updateRadiusPreview(null);
      try { map.doubleClickZoom.enable(); } catch {}
      try { map.dragPan.enable(); } catch {}
    };
  }, [activeTool, updatePolyPreview, updateRadiusPreview]);

  // Keep draw overlays in sync even if a click lands before custom sources/layers finish restoring.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const syncDrawLayers = () => {
      ensureShapeLayers(map);
      updateShapesSource();
      updatePolyPreview();
    };
    if (map.isStyleLoaded()) syncDrawLayers();
    else map.once("idle", syncDrawLayers);
    return () => { map.off("idle", syncDrawLayers); };
  }, [drawShapes, polygonInProgress, ensureShapeLayers, updateShapesSource, updatePolyPreview]);

  const clearAllShapes = () => {
    drawShapesRef.current = [];
    setDrawShapes([]);
    polygonInProgressRef.current = [];
    setPolygonInProgress([]);
    radiusDragRef.current = null;
    activeToolRef.current = null;
    updateShapesSource();
    updateRadiusPreview(null);
    updatePolyPreview();
    setActiveTool(null);
  };

  const cancelActiveDrawing = () => {
    polygonInProgressRef.current = [];
    setPolygonInProgress([]);
    radiusDragRef.current = null;
    activeToolRef.current = null;
    try { mapRef.current?.dragPan.enable(); } catch {}
    updateRadiusPreview(null);
    updatePolyPreview();
    setActiveTool(null);
  };

  const finishPolygonDrawing = () => {
    if (activeToolRef.current !== "polygon") return;
    const pts = polygonInProgressRef.current;
    if (pts.length < 3) {
      setToast("Add at least 3 points to finish polygon");
      setTimeout(() => setToast(null), 2200);
      return;
    }
    const ring = [...pts, pts[0]];
    const centroid: [number, number] = [
      pts.reduce((s, p) => s + p[0], 0) / pts.length,
      pts.reduce((s, p) => s + p[1], 0) / pts.length,
    ];
    const shape: DrawShape = {
      id: `shape-${Date.now()}`,
      tool: "polygon",
      feature: { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} },
      labelPoint: centroid,
      labelText: "Custom area",
      color: SHAPE_COLORS.polygon,
    };
    drawShapesRef.current = [...drawShapesRef.current, shape];
    setDrawShapes(drawShapesRef.current);
    polygonInProgressRef.current = [];
    setPolygonInProgress([]);
    updateShapesSource();
    updatePolyPreview();
    setActiveTool(null);
  };

  // ---- Save View helpers
  const openSaveView = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setSaveViewName(`View ${savedViews.length + 1}`);
    setSaveViewOpen(true);
    // stash center/zoom in state via closure at save time
  };
  const confirmSaveView = () => {
    const map = mapRef.current;
    if (!map || !saveViewName.trim()) return;
    const c = map.getCenter();
    const view: SavedView = {
      id: `v-${Date.now()}`,
      name: saveViewName.trim(),
      center: [c.lng, c.lat],
      zoom: map.getZoom(),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
    setSavedViews((prev) => [view, ...prev]);
    setSaveViewOpen(false);
    setSaveViewName("");
    setToast(`View saved — ${view.name}`);
    setTimeout(() => setToast(null), 2500);
  };
  const flyToSavedView = (v: SavedView) => {
    mapRef.current?.flyTo({ center: v.center, zoom: v.zoom, duration: 800 });
  };
  const deleteSavedView = (id: string) => setSavedViews((prev) => prev.filter((v) => v.id !== id));

  // ---- Territory Builder helpers
  const computeCentroid = (map: maplibregl.Map, zips: string[]): [number, number] => {
    const feats = map.querySourceFeatures("zip-codes", {
      filter: ["in", ["get", "ZCTA5CE10"], ["literal", zips]] as any,
    });
    let sx = 0, sy = 0, n = 0;
    const visit = (c: any) => {
      if (typeof c[0] === "number" && typeof c[1] === "number") {
        sx += c[0]; sy += c[1]; n++;
      } else if (Array.isArray(c)) c.forEach(visit);
    };
    feats.forEach((f: any) => visit(f.geometry.coordinates));
    return n ? [sx / n, sy / n] : [-96.797, 32.8198];
  };

  // Activate/deactivate territory mode based on active draw tool.
  useEffect(() => {
    if (!enableTerritoryBuilder) return;
    setTerritoryActive(activeTool === "zip");
  }, [activeTool, enableTerritoryBuilder]);

  // Emit selection summary to parent (for report modal, etc.)
  useEffect(() => {
    if (!onSelectionChange) return;
    const totalPopulation = activeSelectedZips.reduce((s, z) => s + getZipPopulation(z), 0);
    const shapes = drawShapes.map((s) => ({ id: s.id, tool: s.tool, label: s.labelText }));
    onSelectionChange({
      zips: activeSelectedZips,
      totalPopulation,
      shapes,
      hasSelection: activeSelectedZips.length > 0 || drawShapes.length > 0,
    });
  }, [activeSelectedZips, drawShapes, getZipPopulation, onSelectionChange]);

  // Show/hide zip boundaries + selected fills as selection state changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !territoryReady.current) return;
    const apply = () => {
      if (!map.isStyleLoaded()) { map.once("idle", apply); return; }
      try {
        if (territoryActive) {
          map.setPaintProperty("zip-outlines", "line-color", "rgba(36,60,81,0.20)");
          map.setPaintProperty("zip-fills", "fill-color", [
            "case",
            ["in", ["get", "ZCTA5CE10"], ["literal", activeSelectedZips]] as any,
            "rgba(225,135,57,0.25)",
            "rgba(36,60,81,0)",
          ] as any);
        } else {
          map.setPaintProperty("zip-outlines", "line-color", "rgba(36,60,81,0)");
          map.setPaintProperty("zip-fills", "fill-color", "rgba(36,60,81,0)");
        }
      } catch (err) { console.warn("territory paint update failed", err); }
    };
    apply();
  }, [activeSelectedZips, territoryActive]);

  // Update saved territory overlay + labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !territoryReady.current) return;
    const visibleZips = activeSavedTerritories.filter((t) => t.visible).flatMap((t) => t.zips);
    try {
      map.setFilter("territory-fills", ["in", ["get", "ZCTA5CE10"], ["literal", visibleZips]] as any);
      map.setFilter("territory-outlines", ["in", ["get", "ZCTA5CE10"], ["literal", visibleZips]] as any);
    } catch {}
    // labels
    Object.entries(territoryLabelsRef.current).forEach(([id, m]) => {
      if (!activeSavedTerritories.find((t) => t.id === id && t.visible)) {
        m.remove(); delete territoryLabelsRef.current[id];
      }
    });
    activeSavedTerritories.filter((t) => t.visible).forEach((t) => {
      if (territoryLabelsRef.current[t.id]) {
        territoryLabelsRef.current[t.id].setLngLat(t.centroid);
        return;
      }
      const el = document.createElement("div");
      el.className = "mapiq-territory-label";
      el.textContent = t.name;
      const marker = new maplibregl.Marker({ element: el }).setLngLat(t.centroid).addTo(map);
      territoryLabelsRef.current[t.id] = marker;
    });
  }, [activeSavedTerritories]);

  // Population count-up animation
  const totalPop = useMemo(
    () => activeSelectedZips.reduce((sum, z) => sum + getZipPopulation(z), 0),
    [activeSelectedZips, getZipPopulation],
  );
  const demographicSummary = useMemo(() => {
    const selectedDemographics = activeSelectedZips
      .map((zip) => activeZipDemographics[zip])
      .filter((value): value is MapIQZipDemographics => Boolean(value));
    const households = sumMetric(selectedDemographics.map((value) => value.households));
    const age25To44 = sumMetric(selectedDemographics.map((value) => value.age25To44));
    const age65Plus = sumMetric(selectedDemographics.map((value) => value.age65Plus));
    const ownerOccupied = sumMetric(selectedDemographics.map((value) => value.ownerOccupied));
    const renterOccupied = sumMetric(selectedDemographics.map((value) => value.renterOccupied));
    const occupiedHousing = (ownerOccupied ?? 0) + (renterOccupied ?? 0);
    return {
      medianAge: weightedAverageMetric(
        selectedDemographics,
        (value) => value.medianAge,
        (value) => value.population,
      ),
      medianHouseholdIncome: weightedAverageMetric(
        selectedDemographics,
        (value) => value.medianHouseholdIncome,
        (value) => value.households ?? value.population,
      ),
      households,
      age25To44Percent: totalPop > 0 && age25To44 != null ? (age25To44 / totalPop) * 100 : null,
      age65PlusPercent: totalPop > 0 && age65Plus != null ? (age65Plus / totalPop) * 100 : null,
      renterPercent: occupiedHousing > 0 && renterOccupied != null ? (renterOccupied / occupiedHousing) * 100 : null,
    };
  }, [activeSelectedZips, activeZipDemographics, totalPop]);
  useEffect(() => {
    const start = displayPop;
    const end = totalPop;
    const duration = 600;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setDisplayPop(Math.round(start + (end - start) * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPop]);

  const targetPct = Math.min(100, activeTargetPopulation ? (totalPop / activeTargetPopulation) * 100 : 0);
  const targetReached = totalPop >= activeTargetPopulation && activeTargetPopulation > 0;

  const removeSelectedZip = (zip: string) => {
    if (onZipToggle) {
      onZipToggle(zip);
      return;
    }
    const next = selectedZipsRef.current.filter((z) => z !== zip);
    selectedZipsRef.current = next;
    setSelectedZips(next);
  };
  const clearSelection = () => {
    if (onTerritoryClear) {
      onTerritoryClear();
      return;
    }
    selectedZipsRef.current = [];
    setSelectedZips([]);
  };

  const handleToolToggle = (tool: string) => {
    setLayerOpen(false);
    setSiteListOpen(false);
    if (bottomState !== "closed") {
      setBottomState("closed");
      setSelectedId(null);
    }
    setActiveTool((current) => (current === tool ? null : tool));
  };

  const saveTerritory = () => {
    const map = mapRef.current;
    if (!map || !activeTerritoryName.trim() || activeSelectedZips.length === 0) return;
    const centroid = computeCentroid(map, activeSelectedZips);
    if (onTerritorySave) {
      onTerritorySave({
        name: activeTerritoryName.trim(),
        targetPopulation: activeTargetPopulation,
        zipCodes: [...activeSelectedZips],
        population: totalPop,
        centroid,
      });
      setToast(`Territory saved — ${activeTerritoryName.trim()}`);
      setTimeout(() => setToast(null), 2500);
      setActiveTool(null);
      return;
    }
    const territory: MapIQTerritory = {
      id: `t-${Date.now()}`,
      name: activeTerritoryName.trim(),
      zips: [...activeSelectedZips],
      population: totalPop,
      centroid,
      visible: true,
    };
    setSavedTerritories((prev) => [...prev, territory]);
    setToast(`Territory saved — ${territory.name}`);
    setTimeout(() => setToast(null), 2500);
    // reset builder
    setTerritoryName("");
    clearSelection();
    setActiveTool(null);
  };
  const toggleTerritoryVisible = (id: string) => {
    if (onTerritoryVisibilityToggle) {
      onTerritoryVisibilityToggle(id);
      return;
    }
    setSavedTerritories((prev) => prev.map((t) => (t.id === id ? { ...t, visible: !t.visible } : t)));
  };
  const deleteTerritory = (id: string) => {
    if (onTerritoryDelete) {
      onTerritoryDelete(id);
      return;
    }
    setSavedTerritories((prev) => prev.filter((t) => t.id !== id));
  };


  const handleSearchSelect = (s: { lngLat: [number, number]; label: string }) => {
    setSearch(s.label);
    setShowAutocomplete(false);
    mapRef.current?.flyTo({ center: s.lngLat, zoom: 14, duration: 800 });
  };

  const filteredSuggestions = searchSuggestions.filter((s) =>
    search.length > 0 && s.label.toLowerCase().includes(search.toLowerCase()),
  );

  const detail = selectedPin ? buildDetail(selectedPin) : null;
  const stats = selectedPin ? buildStats(selectedPin) : [];

  const filteredRows = useMemo(() => {
    if (!siteList) return [];
    if (siteListTab === "All") return siteList.rows;
    return siteList.rows.filter((r) => r.status === siteListTab);
  }, [siteList, siteListTab]);
  const hasLayerPanel = Boolean(showSavedViews || enableTerritoryBuilder);
  const activeRadiusOptions =
    activeTool === "drive" ? DRIVE_MINUTE_OPTIONS :
    activeTool === "pop" ? POP_RADIUS_MILE_OPTIONS :
    RADIUS_MILE_OPTIONS;
  const activeRadiusValue =
    activeTool === "drive" ? driveMinutes :
    activeTool === "pop" ? populationRadiusMiles :
    radiusMiles;
  const activeRadiusUnit = activeTool === "drive" ? "min" : "mi";
  const activeRadiusTitle =
    activeTool === "drive" ? "Drive time" :
    activeTool === "pop" ? "Population radius" :
    "Radius draw";
  const activeRadiusCopy =
    activeTool === "drive"
      ? "Click once for the selected estimate, or drag from the center to size it."
      : activeTool === "pop"
        ? "Click once for the selected radius, or drag from the center to size it."
        : "Click once for the selected radius, or drag from the center to size it.";
  const isRadiusLikeTool = isRadiusTool(activeTool);
  const setActiveRadiusValue = (value: number) => {
    if (activeTool === "drive") setDriveMinutes(value);
    else if (activeTool === "pop") setPopulationRadiusMiles(value);
    else setRadiusMiles(value);
  };

  return (
    <div className="mapiq-root">
      <div ref={containerRef} className="mapiq-canvas" />

      {/* Top bar */}
      <div className="mapiq-topbar">
        <div className="mapiq-search">
          <Search size={16} className="mapiq-search-icon" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowAutocomplete(true); }}
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
            placeholder="Search market or address..."
          />
          {showAutocomplete && filteredSuggestions.length > 0 && (
            <div className="mapiq-autocomplete">
              {filteredSuggestions.slice(0, 6).map((s, i) => (
                <button key={i} onMouseDown={() => handleSearchSelect(s)}>
                  <div className="row-1">{s.label}</div>
                  <div className="row-2">{s.sub}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {contextBadge}

        {headerStats && headerStats.length > 0 && (
          <div className="mapiq-header-stats">
            {headerStats.map((s, i) => (
              <span key={i} className="mapiq-header-stat">
                <span className="dot" style={{ background: s.color }} />
                <span className="v">{s.value}</span>
                <span className="l">{s.label}</span>
              </span>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 8 }}>
          {actions.map((a, i) => {
            const Icon = a.icon;
            const handleClick = () => {
              if (a.label === "Save view") { openSaveView(); return; }
              a.onClick();
            };
            return (
              <button key={i} className={`mapiq-action-btn${a.primary ? " primary" : ""}`} onClick={handleClick}>
                {Icon && <Icon size={14} />}
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {hasLayerPanel && (
        <button
          className="mapiq-layer-toggle"
          onClick={() => {
            // If the bottom detail panel is open, close it first so the two overlays never overlap.
            if (bottomState !== "closed") {
              setBottomState("closed");
              setSelectedId(null);
            }
            setLayerOpen((v) => !v);
          }}
          aria-label="Toggle layers"
        >
          <Layers size={18} />
        </button>
      )}


      {/* Site list (Level 2/3) */}
      {siteList && (
        <div className={`mapiq-sitelist${siteListOpen ? " open" : ""}`}>
          <div className="mapiq-sitelist-tabs">
            {siteList.tabs.map((t) => (
              <button key={t} className={siteListTab === t ? "active" : ""} onClick={() => setSiteListTab(t)}>{t}</button>
            ))}
          </div>
          <div className="mapiq-sitelist-rows">
            {filteredRows.map((r) => (
              <div key={r.id} className="mapiq-sitelist-row" onClick={() => {
                const pin = pins.find((p) => p.id === r.id);
                if (pin) {
                  setSelectedId(pin.id);
                  setBottomState("mid");
                  focusPinAboveDetailPanel(pin, 13);
                }
              }}>
                {r.number !== undefined ? (
                  <div className="num" style={{ background: r.statusColor }}>{r.number}</div>
                ) : (
                  <div className="mapiq-status-dot" style={{ background: r.statusColor }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="name">{r.name}</div>
                  <div className="addr">{r.address}{r.meta ? ` · ${r.meta}` : ""}</div>
                </div>
              </div>
            ))}
            {filteredRows.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: "#6B7280" }}>No sites in this filter.</div>
            )}
          </div>
        </div>
      )}

      {siteList && (
        <button
          className="mapiq-layer-toggle"
          style={{ top: "calc(50% + 56px)" }}
          onClick={() => {
            if (bottomState !== "closed") {
              setBottomState("closed");
              setSelectedId(null);
            }
            setSiteListOpen((v) => !v);
          }}
          aria-label="Toggle site list"
        >
          <MapPinIcon size={18} />
        </button>
      )}


      {/* Layer panel */}
      {hasLayerPanel && (
        <div className={`mapiq-layer-panel${layerOpen ? " open" : ""}`}>
        <div className="mapiq-layer-panel-header">
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1B2326" }}>Layers</div>
          <button onClick={() => setLayerOpen(false)} style={{ background: "transparent", border: 0, cursor: "pointer", color: "#6B7280" }} aria-label="Close panel">
            <X size={16} />
          </button>
        </div>
        {showSavedViews && (
          <div className="mapiq-layer-section">
            <h4>Saved Views</h4>
            {savedViews.length === 0 && (
              <div style={{ fontSize: 11, color: "#9ca3af", padding: "0 16px 8px" }}>No saved views yet.</div>
            )}
            {savedViews.map((v) => (
              <div key={v.id} className="mapiq-layer-row" onClick={() => flyToSavedView(v)} style={{ cursor: "pointer" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                  <MapPinIcon size={14} color="#E18739" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{v.date}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSavedView(v.id); }}
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "#6B7280", display: "flex" }}
                    aria-label="Delete view"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
            <div className="mapiq-layer-row" style={{ color: "#243C51", fontWeight: 600, cursor: "pointer" }} onClick={openSaveView}>
              <span>+ Save current view</span>
            </div>
          </div>
        )}
        {enableTerritoryBuilder && (
          <div className="mapiq-layer-section">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 16px 8px" }}>
              <h4 style={{ padding: 0 }}>Territories</h4>
              <button
                onClick={() => { setActiveTool("zip"); setLayerOpen(false); }}
                aria-label="New territory"
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#243C51", fontSize: 16, fontWeight: 700, lineHeight: 1 }}
              >
                +
              </button>
            </div>
            {activeSavedTerritories.length === 0 && (
              <div style={{ fontSize: 11, color: "#9ca3af", padding: "0 16px 8px" }}>No territories yet.</div>
            )}
            {activeSavedTerritories.map((t) => (
              <div key={t.id} className="mapiq-layer-row" style={{ height: 44 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                  <button
                    onClick={() => toggleTerritoryVisible(t.id)}
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "#6B7280", display: "flex" }}
                    aria-label={t.visible ? "Hide territory" : "Show territory"}
                  >
                    {t.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: "#E18739", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#1B2326", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>{Math.round(t.population / 1000)}k</span>
                  <button
                    onClick={() => deleteTerritory(t.id)}
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "#6B7280", display: "flex" }}
                    aria-label="Delete territory"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Territory Builder panel */}
      {enableTerritoryBuilder && (
        <div className={`mapiq-territory-panel${territoryActive ? " open" : ""}`}>
          <div className="mapiq-tp-header">
              <Grid3x3 size={16} color="#6B7280" />
              <span>Territory Builder</span>
            <button
              className="close"
              onClick={() => {
                setActiveTool(null);
                clearSelection();
                if (onTerritoryNameChange) onTerritoryNameChange("");
                else setTerritoryName("");
              }}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mapiq-tp-body">
            <div className="mapiq-tp-label">Territory Name</div>
            <input
              className="mapiq-tp-input"
              placeholder="Territory name..."
              value={activeTerritoryName}
              onChange={(e) => (onTerritoryNameChange ? onTerritoryNameChange(e.target.value) : setTerritoryName(e.target.value))}
            />

            <div className="mapiq-tp-pop">
              <div className="v">
                {displayPop.toLocaleString()}
              </div>
              <div className="l">Total Population</div>
            </div>
            <div className="mapiq-tp-substats">
              <span>{activeSelectedZips.length} zip{activeSelectedZips.length === 1 ? "" : "s"} selected</span>
              <span>
                {activeSelectedZips.length > 0 ? `Avg: ${Math.round(totalPop / activeSelectedZips.length).toLocaleString()}/zip` : "Avg: —"}
              </span>
            </div>

            {activeSelectedZips.length > 0 && (
              <div className="mapiq-tp-demographics">
                <h5>Demographics</h5>
                <div className="mapiq-tp-demo-grid">
                  <div className="mapiq-tp-demo-card">
                    <span>Median Age</span>
                    <strong>{formatMetricDecimal(demographicSummary.medianAge)}</strong>
                  </div>
                  <div className="mapiq-tp-demo-card">
                    <span>Median Income</span>
                    <strong>{formatMetricCurrency(demographicSummary.medianHouseholdIncome)}</strong>
                  </div>
                  <div className="mapiq-tp-demo-card">
                    <span>Households</span>
                    <strong>{formatMetricNumber(demographicSummary.households)}</strong>
                  </div>
                  <div className="mapiq-tp-demo-card">
                    <span>Ages 25-44</span>
                    <strong>{formatMetricPercent(demographicSummary.age25To44Percent)}</strong>
                  </div>
                  <div className="mapiq-tp-demo-card">
                    <span>Ages 65+</span>
                    <strong>{formatMetricPercent(demographicSummary.age65PlusPercent)}</strong>
                  </div>
                  <div className="mapiq-tp-demo-card">
                    <span>Renters</span>
                    <strong>{formatMetricPercent(demographicSummary.renterPercent)}</strong>
                  </div>
                </div>
                {loadingZipCodes.length > 0 && (
                  <div className="mapiq-tp-demo-note">Loading ACS demographics...</div>
                )}
              </div>
            )}

            <div className="mapiq-tp-target-row">
              <span className="mapiq-tp-label" style={{ margin: 0 }}>Target Population</span>
              {editingTarget ? (
                <input
                  autoFocus
                  className="mapiq-tp-target-input"
                  type="number"
                  value={activeTargetPopulation}
                  onChange={(e) => {
                    const next = parseInt(e.target.value || "0", 10);
                    if (onTargetPopulationChange) onTargetPopulationChange(next);
                    else setTargetPopulation(next);
                  }}
                  onBlur={() => setEditingTarget(false)}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingTarget(false); }}
                />
              ) : (
                <button className="tgt" onClick={() => setEditingTarget(true)}>
                  {activeTargetPopulation.toLocaleString()}
                </button>
              )}
            </div>
            <div className="mapiq-tp-bar-track">
              <div
                className={`mapiq-tp-bar-fill${targetReached ? " done" : ""}`}
                style={{ width: `${targetPct}%` }}
              />
            </div>
            {targetReached && <div className="mapiq-tp-target-msg">✓ Target reached!</div>}

            <div className="mapiq-tp-zips">
              <h5>Selected Zips</h5>
              {territoryLoading && (
                <div className="mapiq-tp-empty">Loading ZIP boundaries...</div>
              )}
              {territoryError && (
                <div className="mapiq-tp-empty" style={{ color: "#991b1b" }}>{territoryError}</div>
              )}
              {activeSelectedZips.length === 0 ? (
                <div className="mapiq-tp-empty">Click zip codes on the map to add them</div>
              ) : (
                activeSelectedZips.map((z) => (
                  <div key={z} className="mapiq-tp-zip-row">
                    <span className="code">{z}</span>
                    <span className="pop">
                      {loadingZipCodes.includes(z) ? "Loading..." : formatMetricNumber(getZipPopulation(z))}
                    </span>
                    <button className="rm" onClick={() => removeSelectedZip(z)} aria-label={`Remove ${z}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mapiq-tp-footer">
            <button className="mapiq-tp-btn ghost" onClick={clearSelection}>Clear All</button>
            <button
              className="mapiq-tp-btn primary"
              disabled={activeSelectedZips.length === 0 || !activeTerritoryName.trim() || loadingZipCodes.length > 0}
              onClick={saveTerritory}
            >
              Save Territory
            </button>
          </div>
        </div>
      )}


      {/* Draw tools */}
      {showDrawTools && (
      <div className="mapiq-draw">
        {DRAW_TOOLS.map((t, i) => {
          const Icon = t.icon;
          return (
            <div key={t.key}>
              <button
                className={`mapiq-draw-btn${activeTool === t.key ? " active" : ""}`}
                onClick={() => handleToolToggle(t.key)}
                title={`Draw ${t.label}`}
              >
                <Icon size={16} />
              </button>
              {i === 1 && <div className="mapiq-draw-divider" />}
            </div>
          );
        })}
        <div className="mapiq-draw-divider" />
        <button className="mapiq-draw-btn" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button className="mapiq-draw-btn" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">
          <Minus size={16} />
        </button>
        {(drawShapes.length > 0 || polygonInProgress.length > 0) && (
          <>
            <div className="mapiq-draw-divider" />
            <button
              className="mapiq-draw-btn"
              onClick={clearAllShapes}
              title="Clear all drawings"
              aria-label="Clear drawings"
              style={{ color: "#E18739" }}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
      )}

      {showDrawTools && (isRadiusLikeTool || activeTool === "polygon" || activeTool === "zip") && (
        <div className={`mapiq-tool-panel ${activeTool === "zip" && enableTerritoryBuilder ? "zip-active" : ""}`}>
          {isRadiusLikeTool ? (
            <>
              <div className="mapiq-tool-title">{activeRadiusTitle}</div>
              <div className="mapiq-tool-copy">{activeRadiusCopy}</div>
              <div className="mapiq-tool-options" role="group" aria-label={`${activeRadiusTitle} options`}>
                {activeRadiusOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`mapiq-tool-option${activeRadiusValue === option ? " active" : ""}`}
                    onClick={() => setActiveRadiusValue(option)}
                  >
                    {option} {activeRadiusUnit}
                  </button>
                ))}
              </div>
              <div className="mapiq-tool-actions">
                <button className="mapiq-tool-btn ghost" onClick={cancelActiveDrawing}>Cancel</button>
              </div>
            </>
          ) : activeTool === "polygon" ? (
            <>
              <div className="mapiq-tool-title">Polygon draw</div>
              <div className="mapiq-tool-copy">
                {polygonInProgress.length === 0
                  ? "Click the map to place the first point."
                  : `${polygonInProgress.length} point${polygonInProgress.length === 1 ? "" : "s"} placed`}
              </div>
              <div className="mapiq-tool-actions">
                <button className="mapiq-tool-btn ghost" onClick={cancelActiveDrawing}>Cancel</button>
                <button className="mapiq-tool-btn primary" disabled={polygonInProgress.length < 3} onClick={finishPolygonDrawing}>Finish</button>
              </div>
            </>
          ) : (
            <>
              <div className="mapiq-tool-title">ZIP selector</div>
              <div className="mapiq-tool-copy">Click ZIP areas on the map to add or remove them.</div>
              <div className="mapiq-tool-actions">
                <button className="mapiq-tool-btn ghost" onClick={cancelActiveDrawing}>Done</button>
                {activeSelectedZips.length > 0 && <button className="mapiq-tool-btn primary" onClick={clearSelection}>Clear</button>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Save View modal */}
      {saveViewOpen && (
        <div className="mapiq-modal-backdrop" onClick={() => setSaveViewOpen(false)}>
          <div className="mapiq-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mapiq-modal-header">
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1B2326" }}>Save current view</div>
              <button className="mapiq-modal-close" onClick={() => setSaveViewOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="mapiq-modal-body">
              <label className="mapiq-modal-label">View name</label>
              <input
                autoFocus
                className="mapiq-modal-input"
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmSaveView(); }}
                placeholder="e.g. Dallas whitespace Q1"
              />
              <div className="mapiq-modal-hint">
                Captures the current map center, zoom, and active layers. Access it any time from the Saved Views panel.
              </div>
            </div>
            <div className="mapiq-modal-footer">
              <button className="mapiq-action-btn" onClick={() => setSaveViewOpen(false)}>Cancel</button>
              <button className="mapiq-action-btn primary" onClick={confirmSaveView} disabled={!saveViewName.trim()}>
                <Save size={14} /> Save view
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map legend — level-aware key for pin colors + active competitor layers */}
      <div className="mapiq-legend">
        <div className="mapiq-legend-title">Legend</div>
        <div className="mapiq-legend-items">
          {level === 1 && (
            <div className="mapiq-legend-row"><span className="sw" style={{ background: "#243C51" }} /> Study point</div>
          )}
          {level === 2 && (
            <>
              <div className="mapiq-legend-row"><span className="sw" style={{ background: "#059669" }} /> Open</div>
              <div className="mapiq-legend-row"><span className="sw" style={{ background: "#E18739" }} /> Under Construction</div>
              <div className="mapiq-legend-row"><span className="sw" style={{ background: "#5BA4D9" }} /> Site Dev</div>
              <div className="mapiq-legend-row"><span className="sw territory" /> Territory</div>
            </>
          )}
          {level === 3 && (
            <>
              <div className="mapiq-legend-row"><span className="sw" style={{ background: "#E18739" }} /> Active</div>
              <div className="mapiq-legend-row"><span className="sw" style={{ background: "#243C51" }} /> LOI Out</div>
              <div className="mapiq-legend-row"><span className="sw" style={{ background: "#F2A65A" }} /> Under Review</div>
              <div className="mapiq-legend-row"><span className="sw" style={{ background: "#94A3B8" }} /> Rejected</div>
              <div className="mapiq-legend-row"><span className="sw ring" /> Portfolio (context)</div>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="mapiq-toast">{toast}</div>}

      {/* Floating stat cards */}
      {selectedPin && statsAnchor && stats.length > 0 && (
        <div
          className="mapiq-stat-layer"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(${statsAnchor.x}px, ${statsAnchor.y - 4}px)`,
            zIndex: 180,
            pointerEvents: "none",
          }}
        >
          <FloatingStatCards pin={selectedPin} stats={stats} />
        </div>
      )}

      {/* Bottom detail panel */}
      <div
        className={`mapiq-bottom${bottomState !== "closed" ? " open" : ""}`}
        style={{ height: bottomState === "full" ? "90vh" : bottomState === "mid" ? 280 : 280 }}
      >
        <div
          className="mapiq-bottom-handle"
          onClick={() => setBottomState((s) => (s === "mid" ? "full" : "mid"))}
        />
        <button className="mapiq-bottom-close" onClick={() => { setBottomState("closed"); setSelectedId(null); }} aria-label="Close">
          <X size={14} />
        </button>
        {detail && (
          <div className="mapiq-bottom-content">
            {/* Column 1 */}
            <div className="mapiq-bottom-col" style={{ flex: 1.2 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1B2326" }}>{detail.title}</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>{detail.address}</div>
                {detail.statusLabel && (() => {
                  const PILL_MAP: Record<string, { label: string; cls: string }> = {
                    "Signed": { label: "Signed", cls: "pill-signed" },
                    "Lease Negotiations": { label: "Lease", cls: "pill-leases" },
                    "LOI Negotiations": { label: "LOI", cls: "pill-loi" },
                    "LOI Out": { label: "LOI", cls: "pill-loi" },
                    "First LOI(s) Submitted": { label: "LOI", cls: "pill-loi" },
                    "Market Study": { label: "Mkt Study", cls: "pill-market-study" },
                    "Site Tours": { label: "Tour", cls: "pill-prop-tour" },
                    "Kick Off": { label: "Intro", cls: "pill-intro-call" },
                    "On Hold": { label: "On-hold", cls: "pill-on-hold" },
                    "Open": { label: "Open", cls: "pill-signed" },
                    "Under Construction": { label: "Under Construction", cls: "pill-market-study" },
                    "Site Dev": { label: "Site Dev", cls: "pill-loi" },
                    "Active": { label: "Active", cls: "pill-signed" },
                    "Under Review": { label: "Under Review", cls: "pill-market-study" },
                    "Rejected": { label: "Rejected", cls: "pill-on-hold" },
                  };
                  const meta = PILL_MAP[detail.statusLabel] || { label: detail.statusLabel, cls: "pill-intro-call" };
                  return (
                    <div style={{ marginTop: 10 }}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-[20px] text-[12px] font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div className="mapiq-mini-stats">
                {detail.miniStats.map((s, i) => (
                  <div key={i} className="mapiq-mini-stat">
                    <div className="l">{s.label}</div>
                    <div className="v">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2 — Photo */}
            <div className="mapiq-photo-col">
              {detail.photoUrl ? (
                <img src={detail.photoUrl} alt={detail.title} />
              ) : (
                <div
                  className="flex h-full min-h-[180px] items-center justify-center text-sm font-semibold"
                  style={{ color: "#6B7280", background: "linear-gradient(135deg, rgba(36,60,81,0.08), rgba(225,135,57,0.10))" }}
                >
                  No site photo
                </div>
              )}
              <div className="overlay">{detail.address}</div>
            </div>

            {/* Column 3 — key metrics */}
            <div className="mapiq-bottom-col" style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1B2326" }}>{detail.keyMetricsTitle}</div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-evenly", flex: 1, gap: 6, marginTop: 12 }}>
                {detail.keyMetrics.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 6, borderBottom: i < detail.keyMetrics.length - 1 ? "1px solid rgba(36,60,81,0.06)" : "none" }}>
                    <span style={{ color: "#6B7280" }}>{m.label}</span>
                    <span style={{ color: "#1B2326", fontWeight: 600 }}>{m.value}</span>
                  </div>
                ))}
              </div>
              {(detail.primaryAction || detail.secondaryAction) && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {detail.primaryAction && (
                    <button className="mapiq-action-btn primary" style={{ flex: 1 }} onClick={detail.primaryAction.onClick}>
                      {detail.primaryAction.label}
                    </button>
                  )}
                  {detail.secondaryAction && (
                    <button className="mapiq-action-btn" style={{ flex: 1 }} onClick={detail.secondaryAction.onClick}>
                      {detail.secondaryAction.label}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export some icons consumers may want
export { Save, FileBarChart2, Target, Download };
