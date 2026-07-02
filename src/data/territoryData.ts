export type LatLngTuple = [number, number];

type TerritoryGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type TerritoryZip = {
  zip: string;
  label: string;
  center: LatLngTuple;
  geometry: TerritoryGeometry;
};

export type SavedTerritory = {
  id: string;
  name: string;
  targetPopulation: number;
  zipCodes: string[];
  population: number;
  createdAt: string;
};

export type TerritoryBounds = {
  north: number;
  east: number;
  south: number;
  west: number;
  zoom?: number;
};

type TigerFeature = {
  attributes?: Record<string, unknown>;
  geometry?: {
    rings?: number[][][];
  } | null;
};

type TigerResponse = {
  features?: TigerFeature[];
  error?: {
    message?: string;
  };
};

type TigerJsonpCallback = (payload: TigerResponse) => void;

const TIGER_ZCTA_QUERY_URL =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2023/MapServer/2/query";
const TIGER_JSONP_TIMEOUT_MS = 30000;
const MAX_BOUNDS_LAT_STEP = 1.25;
const MAX_BOUNDS_LNG_STEP = 1.25;
const MAX_BOUNDS_LAT_SPLITS = 3;
const MAX_BOUNDS_LNG_SPLITS = 3;
const LOW_ZOOM_MAX_LAT_SPAN = 2.4;
const LOW_ZOOM_MAX_LNG_SPAN = 2.4;
const MAX_QUERY_LAT_SPAN = 3;
const MAX_QUERY_LNG_SPAN = 3;

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function numberText(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function zctaFromFeature(feature: TigerFeature): TerritoryZip | null {
  const properties = feature.attributes ?? {};
  const zip = text(properties.ZCTA5) || text(properties.GEOID) || text(properties.BASENAME);
  const rings = feature.geometry?.rings;
  if (!zip || !rings || rings.length === 0) return null;

  const lat = numberText(properties.INTPTLAT) ?? numberText(properties.CENTLAT);
  const lng = numberText(properties.INTPTLON) ?? numberText(properties.CENTLON);
  if (lat == null || lng == null) return null;

  return {
    zip,
    label: text(properties.NAME) || `ZCTA ${zip}`,
    center: [lat, lng],
    geometry: { type: "Polygon", coordinates: rings },
  };
}

function tigerJsonp(params: URLSearchParams): Promise<TigerResponse> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("TIGERWeb ZIP boundaries require a browser."));
  }

  params.set("f", "json");
  params.set("returnGeometry", "true");
  params.set("outSR", "4326");
  if (!params.has("geometryPrecision")) params.set("geometryPrecision", "5");
  params.set("outFields", "ZCTA5,GEOID,BASENAME,NAME,INTPTLAT,INTPTLON,CENTLAT,CENTLON");

  return new Promise((resolve, reject) => {
    const callbackName = `__reimagineTiger${Date.now()}${Math.random().toString(36).slice(2)}`;
    const callbacks = window as unknown as Record<string, TigerJsonpCallback | undefined>;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("TIGERWeb ZIP boundary request timed out."));
    }, TIGER_JSONP_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeout);
      delete callbacks[callbackName];
      script.remove();
    }

    callbacks[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("TIGERWeb ZIP boundary request failed."));
    };

    params.set("callback", callbackName);
    script.src = `${TIGER_ZCTA_QUERY_URL}?${params.toString()}`;
    document.head.appendChild(script);
  });
}

async function queryZctas(params: URLSearchParams): Promise<TerritoryZip[]> {
  const data = await tigerJsonp(params);
  if (data.error) throw new Error(data.error.message || "TIGERWeb returned an error.");

  return (data.features ?? [])
    .map(zctaFromFeature)
    .filter((zip): zip is TerritoryZip => Boolean(zip));
}

function clampBoundsForQuery(bounds: TerritoryBounds): TerritoryBounds {
  const latSpan = Math.max(0, bounds.north - bounds.south);
  const lngSpan = Math.max(0, bounds.east - bounds.west);
  const maxLatSpan = typeof bounds.zoom === "number" && bounds.zoom < 7 ? LOW_ZOOM_MAX_LAT_SPAN : MAX_QUERY_LAT_SPAN;
  const maxLngSpan = typeof bounds.zoom === "number" && bounds.zoom < 7 ? LOW_ZOOM_MAX_LNG_SPAN : MAX_QUERY_LNG_SPAN;
  const nextLatSpan = Math.min(latSpan, maxLatSpan);
  const nextLngSpan = Math.min(lngSpan, maxLngSpan);

  if (nextLatSpan === latSpan && nextLngSpan === lngSpan) return bounds;

  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east + bounds.west) / 2;
  return {
    north: centerLat + nextLatSpan / 2,
    south: centerLat - nextLatSpan / 2,
    east: centerLng + nextLngSpan / 2,
    west: centerLng - nextLngSpan / 2,
    zoom: bounds.zoom,
  };
}

function splitBounds(bounds: TerritoryBounds): TerritoryBounds[] {
  const latSpan = Math.max(0, bounds.north - bounds.south);
  const lngSpan = Math.max(0, bounds.east - bounds.west);
  const latSplits = Math.max(1, Math.min(MAX_BOUNDS_LAT_SPLITS, Math.ceil(latSpan / MAX_BOUNDS_LAT_STEP)));
  const lngSplits = Math.max(1, Math.min(MAX_BOUNDS_LNG_SPLITS, Math.ceil(lngSpan / MAX_BOUNDS_LNG_STEP)));
  const latStep = latSpan / latSplits;
  const lngStep = lngSpan / lngSplits;
  const boxes: TerritoryBounds[] = [];

  for (let latIndex = 0; latIndex < latSplits; latIndex += 1) {
    for (let lngIndex = 0; lngIndex < lngSplits; lngIndex += 1) {
      boxes.push({
        south: bounds.south + latStep * latIndex,
        north: latIndex === latSplits - 1 ? bounds.north : bounds.south + latStep * (latIndex + 1),
        west: bounds.west + lngStep * lngIndex,
        east: lngIndex === lngSplits - 1 ? bounds.east : bounds.west + lngStep * (lngIndex + 1),
        zoom: bounds.zoom,
      });
    }
  }

  return boxes;
}

function dedupeZips(zips: TerritoryZip[]): TerritoryZip[] {
  return [...new Map(zips.map((zip) => [zip.zip, zip])).values()]
    .sort((a, b) => a.zip.localeCompare(b.zip));
}

async function queryZctasForBounds(bounds: TerritoryBounds): Promise<TerritoryZip[]> {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    resultRecordCount: "700",
    geometryPrecision: "5",
    maxAllowableOffset: "0.002",
  });
  return queryZctas(params);
}

export async function fetchTerritoryZipsForBounds(bounds: TerritoryBounds): Promise<TerritoryZip[]> {
  const boxes = splitBounds(clampBoundsForQuery(bounds));
  const zips: TerritoryZip[] = [];
  const errors: unknown[] = [];

  for (const box of boxes) {
    try {
      zips.push(...await queryZctasForBounds(box));
    } catch (error) {
      errors.push(error);
    }
  }

  if (zips.length > 0) return dedupeZips(zips);

  if (errors.length > 0) {
    const [firstError] = errors;
    throw firstError instanceof Error ? firstError : new Error("Unable to load ZIP boundaries.");
  }

  return [];
}

export async function fetchTerritoryZipsByCodes(zipCodes: string[]): Promise<TerritoryZip[]> {
  const uniqueCodes = Array.from(new Set(zipCodes.map((zip) => zip.trim()).filter(Boolean)));
  if (uniqueCodes.length === 0) return [];

  const batches: string[][] = [];
  for (let index = 0; index < uniqueCodes.length; index += 40) {
    batches.push(uniqueCodes.slice(index, index + 40));
  }

  const results = await Promise.all(batches.map((batch) => {
    const quoted = batch.map((zip) => `'${zip.replace(/'/g, "''")}'`).join(",");
    return queryZctas(new URLSearchParams({ where: `ZCTA5 IN (${quoted})` }));
  }));

  return results.flat();
}
