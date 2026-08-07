import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Compass, FileBarChart2, Save } from "lucide-react";
import { MapIQCanvas, type MapIQPinData, type MapIQTerritory, type MapIQZipDemographics, type MapIQZipFeature } from "@/components/mapiq/MapIQCanvas";
import { buildDealCityPins } from "@/components/DealCityMap";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { DEAL_STATUS_ORDER, dealBrands, dealRecords, type DealRecord, type DealStatusNew } from "@/data/dealsData";
import {
  fetchTerritoryZipsByCodes,
  fetchTerritoryZipsForBounds,
  type SavedTerritory,
  type TerritoryBounds,
  type TerritoryZip,
} from "@/data/territoryData";
import { canAccessDeal, getVisibleBrandsForUser, getVisibleDealsForUser, useCurrentProfile, useScopedUser, useUserRole } from "@/hooks/useUserRole";

const statuses: DealStatusNew[] = DEAL_STATUS_ORDER;
const TERRITORY_STORAGE_KEY = "reimagine.map.territories.v2";
const DEFAULT_TARGET_POPULATION = 100000;
const CENSUS_API_KEY = import.meta.env.VITE_CENSUS_API_KEY?.trim();
const CENSUS_API_URL = "https://api.census.gov/data/2022/acs/acs5";
const CENSUS_VARIABLES = {
  population: "B01003_001E",
  medianAge: "B01002_001E",
  medianHouseholdIncome: "B19013_001E",
  households: "B11001_001E",
  ownerOccupied: "B25003_002E",
  renterOccupied: "B25003_003E",
} as const;
const AGE_25_TO_44_VARIABLES = [
  "B01001_011E",
  "B01001_012E",
  "B01001_013E",
  "B01001_014E",
  "B01001_035E",
  "B01001_036E",
  "B01001_037E",
  "B01001_038E",
] as const;
const AGE_65_PLUS_VARIABLES = [
  "B01001_020E",
  "B01001_021E",
  "B01001_022E",
  "B01001_023E",
  "B01001_024E",
  "B01001_025E",
  "B01001_044E",
  "B01001_045E",
  "B01001_046E",
  "B01001_047E",
  "B01001_048E",
  "B01001_049E",
] as const;
const DEMOGRAPHIC_VARIABLES = [
  ...Object.values(CENSUS_VARIABLES),
  ...AGE_25_TO_44_VARIABLES,
  ...AGE_65_PLUS_VARIABLES,
] as const;

type ZipDemographicsMap = Record<string, MapIQZipDemographics | null>;
type MapViewProps = {
  requestedDealId?: string;
  requestedDealIds?: string[];
  requestedBrandId?: string;
  embedded?: boolean;
  enableAdvancedTools?: boolean;
};

const DEAL_STATUS_COLOR: Record<DealStatusNew, string> = {
  "Kick Off": "#94A3B8",
  "Market Study": "#8B5CF6",
  "Site Tours": "#14B8A6",
  "LOI Negotiations": "#1E5BA8",
  "Lease Negotiations": "#3B82F6",
  Signed: "#059669",
  "On Hold": "#E18739",
};

function brandNameForDeal(deal: DealRecord): string {
  return dealBrands.find((brand) => brand.id === deal.brandId)?.name ?? "Deal";
}

function dealDisplayName(deal: DealRecord): string {
  return deal.name || `${brandNameForDeal(deal)} - ${deal.franchisee}`;
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function createTerritoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `territory-${Date.now()}`;
}

function isSavedTerritory(value: unknown): value is SavedTerritory {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedTerritory>;
  return Boolean(
    candidate.id &&
    candidate.name &&
    typeof candidate.targetPopulation === "number" &&
    Array.isArray(candidate.zipCodes) &&
    typeof candidate.population === "number",
  );
}

function loadSavedTerritories(): SavedTerritory[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(TERRITORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedTerritory);
  } catch {
    return [];
  }
}

function mergeTerritoryZips(current: TerritoryZip[], incoming: TerritoryZip[]): TerritoryZip[] {
  const byZip = new Map(current.map((zip) => [zip.zip, zip]));
  incoming.forEach((zip) => byZip.set(zip.zip, zip));
  return [...byZip.values()].sort((a, b) => a.zip.localeCompare(b.zip));
}

async function withCensusTimeout<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    return await request(controller.signal);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function cleanCensusNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function sumCensusValues(values: Array<number | null>): number | null {
  const total = values.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
  return total > 0 ? total : null;
}

function variableKey(variable: string): string {
  return variable.replace("_", "").replace(/E$/, "");
}

function blankDemographics(): MapIQZipDemographics {
  return {
    population: null,
    medianAge: null,
    medianHouseholdIncome: null,
    households: null,
    age25To44: null,
    age65Plus: null,
    ownerOccupied: null,
    renterOccupied: null,
  };
}

function parseCensusApiDemographics(data: unknown): MapIQZipDemographics | null {
  if (!Array.isArray(data) || !Array.isArray(data[0]) || !Array.isArray(data[1])) return null;
  const headers = data[0] as string[];
  const row = data[1] as unknown[];
  const valueFor = (variable: string) => {
    const index = headers.indexOf(variable);
    return index >= 0 ? cleanCensusNumber(row[index]) : null;
  };
  return {
    population: valueFor(CENSUS_VARIABLES.population),
    medianAge: valueFor(CENSUS_VARIABLES.medianAge),
    medianHouseholdIncome: valueFor(CENSUS_VARIABLES.medianHouseholdIncome),
    households: valueFor(CENSUS_VARIABLES.households),
    age25To44: sumCensusValues(AGE_25_TO_44_VARIABLES.map(valueFor)),
    age65Plus: sumCensusValues(AGE_65_PLUS_VARIABLES.map(valueFor)),
    ownerOccupied: valueFor(CENSUS_VARIABLES.ownerOccupied),
    renterOccupied: valueFor(CENSUS_VARIABLES.renterOccupied),
  };
}

async function fetchCensusApiDemographics(zipCode: string): Promise<MapIQZipDemographics | null> {
  return withCensusTimeout(async (signal) => {
    const params = new URLSearchParams({
      get: DEMOGRAPHIC_VARIABLES.join(","),
      for: `zip code tabulation area:${zipCode}`,
    });
    if (CENSUS_API_KEY) params.set("key", CENSUS_API_KEY);
    const response = await fetch(`${CENSUS_API_URL}?${params.toString()}`, { signal });
    if (!response.ok || response.redirected) return null;
    return parseCensusApiDemographics(await response.json());
  });
}

async function fetchCensusReporterDemographics(zipCodes: string[]): Promise<ZipDemographicsMap> {
  const uniqueCodes = Array.from(new Set(zipCodes));
  if (uniqueCodes.length === 0) return {};

  const fallback = Object.fromEntries(uniqueCodes.map((zipCode) => [zipCode, null])) as ZipDemographicsMap;
  const demographics = await withCensusTimeout(async (signal) => {
    const geoIds = uniqueCodes.map((zipCode) => `86000US${zipCode}`).join(",");
    const params = new URLSearchParams({
      table_ids: "B01003,B01002,B19013,B11001,B25003,B01001",
      geo_ids: geoIds,
    });
    const response = await fetch(`https://api.censusreporter.org/1.0/data/show/latest?${params.toString()}`, { signal });
    if (!response.ok) return fallback;
    const data = await response.json();
    return Object.fromEntries(uniqueCodes.map((zipCode) => {
      const geo = data?.data?.[`86000US${zipCode}`];
      if (!geo) return [zipCode, null];
      const valueFor = (table: string, variable: string) => cleanCensusNumber(geo?.[table]?.estimate?.[variableKey(variable)]);
      const next: MapIQZipDemographics = {
        population: valueFor("B01003", CENSUS_VARIABLES.population),
        medianAge: valueFor("B01002", CENSUS_VARIABLES.medianAge),
        medianHouseholdIncome: valueFor("B19013", CENSUS_VARIABLES.medianHouseholdIncome),
        households: valueFor("B11001", CENSUS_VARIABLES.households),
        age25To44: sumCensusValues(AGE_25_TO_44_VARIABLES.map((variable) => valueFor("B01001", variable))),
        age65Plus: sumCensusValues(AGE_65_PLUS_VARIABLES.map((variable) => valueFor("B01001", variable))),
        ownerOccupied: valueFor("B25003", CENSUS_VARIABLES.ownerOccupied),
        renterOccupied: valueFor("B25003", CENSUS_VARIABLES.renterOccupied),
      };
      return [zipCode, next];
    })) as ZipDemographicsMap;
  });

  return demographics ?? fallback;
}

async function fetchZipDemographics(zipCodes: string[]): Promise<ZipDemographicsMap> {
  if (typeof fetch === "undefined" || typeof window === "undefined") {
    return Object.fromEntries(zipCodes.map((zipCode) => [zipCode, null])) as ZipDemographicsMap;
  }

  const uniqueCodes = Array.from(new Set(zipCodes));
  const demographics: ZipDemographicsMap = {};
  const reporterCodes: string[] = [];

  await Promise.all(uniqueCodes.map(async (zipCode) => {
    const censusDemographics = await fetchCensusApiDemographics(zipCode);
    if (censusDemographics?.population != null) {
      demographics[zipCode] = censusDemographics;
      return;
    }
    reporterCodes.push(zipCode);
  }));

  Object.assign(demographics, await fetchCensusReporterDemographics(reporterCodes));
  uniqueCodes.forEach((zipCode) => {
    if (!(zipCode in demographics)) demographics[zipCode] = blankDemographics();
  });

  return demographics;
}

function majorityStatus(deals: DealRecord[]): DealStatusNew {
  const counts = new Map<DealStatusNew, number>();
  deals.forEach((deal) => counts.set(deal.status, (counts.get(deal.status) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Kick Off";
}

function toMapIQZipFeature(zip: TerritoryZip): MapIQZipFeature {
  return {
    zip: zip.zip,
    label: zip.label,
    center: [zip.center[1], zip.center[0]],
    geometry: zip.geometry,
  };
}

function territoryCentroid(zipCodes: string[], zipByCode: Map<string, TerritoryZip>, fallback: [number, number]): [number, number] {
  const centers = zipCodes
    .map((zipCode) => zipByCode.get(zipCode)?.center)
    .filter((center): center is [number, number] => Boolean(center));
  if (centers.length === 0) return fallback;
  const lat = centers.reduce((sum, center) => sum + center[0], 0) / centers.length;
  const lng = centers.reduce((sum, center) => sum + center[1], 0) / centers.length;
  return [lng, lat];
}

export default function MapView({
  requestedDealId: requestedDealIdOverride,
  requestedDealIds: requestedDealIdsOverride,
  requestedBrandId: requestedBrandIdOverride,
  embedded = false,
  enableAdvancedTools = false,
}: MapViewProps = {}) {
  const navigate = useNavigate();
  const runtimeDataVersion = useRuntimeDataVersion();
  const [searchParams] = useSearchParams();
  const requestedDealId = requestedDealIdOverride ?? searchParams.get("deal") ?? "";
  const requestedBrandId = requestedBrandIdOverride ?? searchParams.get("brand") ?? "";
  const requestedDealIdSet = useMemo(
    () => Array.isArray(requestedDealIdsOverride) ? new Set(requestedDealIdsOverride) : null,
    [requestedDealIdsOverride],
  );
  const role = useUserRole();
  const profile = useCurrentProfile();
  const user = useScopedUser();
  const canUseAdvancedMapTools = role === "admin" || enableAdvancedTools;
  const [brandFilter, setBrandFilter] = useState(() => requestedBrandId || "all");
  const [selectedZipCodes, setSelectedZipCodes] = useState<string[]>([]);
  const [territoryName, setTerritoryName] = useState("");
  const [targetPopulation, setTargetPopulation] = useState(DEFAULT_TARGET_POPULATION);
  const [territoryZips, setTerritoryZips] = useState<TerritoryZip[]>([]);
  const [territoryBoundsLoading, setTerritoryBoundsLoading] = useState(false);
  const [territoryBoundsError, setTerritoryBoundsError] = useState<string | null>(null);
  const [zipDemographicsByCode, setZipDemographicsByCode] = useState<ZipDemographicsMap>({});
  const [loadingZipCodes, setLoadingZipCodes] = useState<string[]>([]);
  const [savedTerritories, setSavedTerritories] = useState<SavedTerritory[]>([]);
  const [visibleTerritoryIds, setVisibleTerritoryIds] = useState<string[]>([]);
  const [territoriesHydrated, setTerritoriesHydrated] = useState(false);
  const territoryBoundsRequestRef = useRef(0);
  const territoryZipsRef = useRef<TerritoryZip[]>([]);
  const demographicRequestsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    const territories = loadSavedTerritories();
    setSavedTerritories(territories);
    setVisibleTerritoryIds(territories.map((territory) => territory.id));
    setTerritoriesHydrated(true);
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    territoryZipsRef.current = territoryZips;
  }, [territoryZips]);

  useEffect(() => {
    if (!territoriesHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(TERRITORY_STORAGE_KEY, JSON.stringify(savedTerritories));
  }, [savedTerritories, territoriesHydrated]);

  useEffect(() => {
    if (canUseAdvancedMapTools) return;
    setSelectedZipCodes([]);
    setTerritoryName("");
  }, [canUseAdvancedMapTools]);

  const visibleDeals = useMemo(() => {
    void runtimeDataVersion;
    const hasRequestedDealScope = Boolean(requestedDealId) || Boolean(requestedDealIdSet);
    let base = role === "broker" ? dealRecords : getVisibleDealsForUser(user ?? role, dealRecords);
    if (!hasRequestedDealScope) {
      base = base.filter((deal) => !deal.isOneOff);
    }
    if (role === "deal" && profile?.dealId) {
      base = base.filter((deal) => deal.id === profile.dealId);
    }
    if (requestedDealId) {
      base = base.filter((deal) => deal.id === requestedDealId && canAccessDeal(user ?? role, deal));
    }
    if (requestedDealIdSet) {
      base = base.filter((deal) => requestedDealIdSet.has(deal.id) && canAccessDeal(user ?? role, deal));
    }
    return base;
  }, [profile?.dealId, requestedDealId, requestedDealIdSet, role, runtimeDataVersion, user]);

  const visibleBrands = useMemo(() => {
    void runtimeDataVersion;
    return getVisibleBrandsForUser(user ?? role, dealBrands, visibleDeals);
  }, [role, runtimeDataVersion, user, visibleDeals]);

  useEffect(() => {
    if (role === "brand") return;
    setBrandFilter(requestedBrandId || "all");
  }, [requestedBrandId, role]);

  useEffect(() => {
    if (role === "brand" && profile?.brandId) {
      if (brandFilter !== profile.brandId) setBrandFilter(profile.brandId);
      return;
    }
    if (brandFilter !== "all" && !visibleBrands.some((brand) => brand.id === brandFilter)) {
      setBrandFilter("all");
    }
  }, [brandFilter, profile?.brandId, role, visibleBrands]);

  const filteredDeals = useMemo(() => {
    const shouldStartEmpty =
      role === "admin" &&
      !embedded &&
      !requestedDealId &&
      !requestedDealIdSet &&
      !requestedBrandId &&
      brandFilter === "all";
    if (shouldStartEmpty) return [];
    let next = visibleDeals;
    if (brandFilter !== "all") next = next.filter((deal) => deal.brandId === brandFilter);
    return next;
  }, [brandFilter, embedded, requestedBrandId, requestedDealId, requestedDealIdSet, role, visibleDeals]);

  const cityPinResult = useMemo(() => buildDealCityPins(filteredDeals), [filteredDeals]);

  const pins = useMemo<MapIQPinData[]>(() => {
    return cityPinResult.pins.map((pin) => {
      const status = majorityStatus(pin.deals);
      const statusCount = new Set(pin.deals.map((deal) => deal.status)).size;
      return {
        id: pin.key,
        lngLat: [pin.lng, pin.lat] as [number, number],
        kind: "study" as const,
        color: statusCount === 1 ? DEAL_STATUS_COLOR[status] : "#243C51",
        label: pin.deals.length > 1 ? String(pin.deals.length) : "",
        payload: {
          city: pin.label,
          precision: pin.precision,
          deals: pin.deals,
          status,
        },
      };
    });
  }, [cityPinResult.pins]);

  const searchSuggestions = useMemo(
    () => cityPinResult.pins.map((pin) => ({
      label: pin.label,
      sub: `${pin.deals.length} deal${pin.deals.length === 1 ? "" : "s"}`,
      lngLat: [pin.lng, pin.lat] as [number, number],
    })),
    [cityPinResult.pins],
  );

  const siteList = useMemo(() => ({
    tabs: ["All", ...statuses],
    rows: cityPinResult.pins.map((pin) => {
      const status = majorityStatus(pin.deals);
      return {
        id: pin.key,
        status,
        statusColor: DEAL_STATUS_COLOR[status],
        name: pin.label,
        address: `${pin.deals.length} deal${pin.deals.length === 1 ? "" : "s"}`,
        meta: pin.precision === "site" ? "site coordinates" : "city coordinates",
      };
    }),
  }), [cityPinResult.pins]);

  const territoryZipByCode = useMemo(() => new Map(territoryZips.map((zip) => [zip.zip, zip])), [territoryZips]);

  const defaultCenter = pins[0]?.lngLat ?? ([-96.797, 32.8198] as [number, number]);
  const showBrandSelector = role === "admin" && !embedded && !requestedDealId && !requestedDealIdSet && !requestedBrandId;
  const mapIQTerritories = useMemo<MapIQTerritory[]>(() => {
    return savedTerritories.map((territory) => ({
      id: territory.id,
      name: territory.name,
      zips: territory.zipCodes,
      population: territory.population,
      centroid: territoryCentroid(territory.zipCodes, territoryZipByCode, defaultCenter),
      visible: visibleTerritoryIds.includes(territory.id),
    }));
  }, [defaultCenter, savedTerritories, territoryZipByCode, visibleTerritoryIds]);

  const zipPopulationByCode = useMemo<Record<string, number | null>>(() => {
    return Object.fromEntries(Object.entries(zipDemographicsByCode).map(([zipCode, demographics]) => [
      zipCode,
      demographics?.population ?? null,
    ]));
  }, [zipDemographicsByCode]);

  const handleTerritoryViewportChange = useCallback((bounds: TerritoryBounds) => {
    const requestId = territoryBoundsRequestRef.current + 1;
    territoryBoundsRequestRef.current = requestId;
    setTerritoryBoundsLoading(true);
    setTerritoryBoundsError(null);
    void fetchTerritoryZipsForBounds(bounds)
      .then((zips) => {
        if (territoryBoundsRequestRef.current !== requestId) return;
        setTerritoryZips((current) => mergeTerritoryZips(current, zips));
      })
      .catch((error) => {
        if (territoryBoundsRequestRef.current !== requestId) return;
        if (territoryZipsRef.current.length > 0) return;
        setTerritoryBoundsError(error instanceof Error ? error.message : "Unable to load ZIP boundaries.");
      })
      .finally(() => {
        if (territoryBoundsRequestRef.current === requestId) setTerritoryBoundsLoading(false);
      });
  }, []);

  useEffect(() => {
    const missingZipCodes = Array.from(new Set(savedTerritories.flatMap((territory) => territory.zipCodes)))
      .filter((zipCode) => !territoryZipByCode.has(zipCode));
    if (missingZipCodes.length === 0) return;

    let active = true;
    void fetchTerritoryZipsByCodes(missingZipCodes)
      .then((zips) => {
        if (active) setTerritoryZips((current) => mergeTerritoryZips(current, zips));
      })
      .catch(() => {
        if (active) setTerritoryBoundsError("Unable to load saved territory boundaries.");
      });

    return () => {
      active = false;
    };
  }, [savedTerritories, territoryZipByCode]);

  useEffect(() => {
    const missingZipCodes = selectedZipCodes.filter((zipCode) => (
      !(zipCode in zipDemographicsByCode) && !demographicRequestsRef.current.has(zipCode)
    ));
    if (missingZipCodes.length === 0) return;

    missingZipCodes.forEach((zipCode) => demographicRequestsRef.current.add(zipCode));
    setLoadingZipCodes((current) => Array.from(new Set([...current, ...missingZipCodes])));

    void fetchZipDemographics(missingZipCodes)
      .then((demographics) => {
        if (!mountedRef.current) return;
        setZipDemographicsByCode((current) => ({ ...current, ...demographics }));
      })
      .finally(() => {
        missingZipCodes.forEach((zipCode) => demographicRequestsRef.current.delete(zipCode));
        if (!mountedRef.current) return;
        setLoadingZipCodes((current) => current.filter((item) => !missingZipCodes.includes(item)));
      });
  }, [selectedZipCodes, zipDemographicsByCode]);

  const toggleZip = useCallback((zipCode: string) => {
    setTerritoryName((current) => current.trim() || `Territory ${savedTerritories.length + 1}`);
    setSelectedZipCodes((current) => (
      current.includes(zipCode)
        ? current.filter((item) => item !== zipCode)
        : [...current, zipCode]
    ));
  }, [savedTerritories.length]);

  const clearTerritorySelection = useCallback(() => {
    setSelectedZipCodes([]);
    setTerritoryName("");
    setTargetPopulation(DEFAULT_TARGET_POPULATION);
  }, []);

  const saveTerritory = useCallback((input: { name: string; targetPopulation: number; zipCodes: string[]; population: number; centroid: [number, number] }) => {
    if (input.zipCodes.length === 0 || loadingZipCodes.length > 0) return;
    const territory: SavedTerritory = {
      id: createTerritoryId(),
      name: input.name.trim() || `Territory ${savedTerritories.length + 1}`,
      targetPopulation: input.targetPopulation,
      zipCodes: input.zipCodes,
      population: input.population,
      createdAt: new Date().toISOString(),
    };
    setSavedTerritories((current) => [territory, ...current]);
    setVisibleTerritoryIds((current) => [territory.id, ...current]);
    clearTerritorySelection();
  }, [clearTerritorySelection, loadingZipCodes.length, savedTerritories.length]);

  const toggleTerritoryVisibility = useCallback((territoryId: string) => {
    setVisibleTerritoryIds((current) => (
      current.includes(territoryId)
        ? current.filter((id) => id !== territoryId)
        : [...current, territoryId]
    ));
  }, []);

  const deleteTerritory = useCallback((territoryId: string) => {
    setSavedTerritories((current) => current.filter((territory) => territory.id !== territoryId));
    setVisibleTerritoryIds((current) => current.filter((id) => id !== territoryId));
  }, []);

  return (
    <div
      className="animate-fade-in"
      style={{
        height: embedded ? "100%" : "calc(100vh - 49px)",
        minHeight: embedded ? 0 : 640,
        overflow: "hidden",
      }}
    >
      <div className="relative h-full w-full overflow-hidden">
        <MapIQCanvas
          level={1}
          pins={pins}
          defaultCenter={defaultCenter}
          defaultZoom={pins.length > 0 ? 9 : 11}
          fitPinsOnLoad
          searchSuggestions={searchSuggestions}
          showDrawTools={canUseAdvancedMapTools}
          enableTerritoryBuilder={canUseAdvancedMapTools}
          showSavedViews={canUseAdvancedMapTools}
          territoryZips={territoryZips.map(toMapIQZipFeature)}
          selectedZipCodes={selectedZipCodes}
          zipPopulations={zipPopulationByCode}
          zipDemographics={zipDemographicsByCode}
          loadingZipCodes={loadingZipCodes}
          territoryLoading={territoryBoundsLoading}
          territoryError={territoryBoundsError}
          savedTerritories={mapIQTerritories}
          territoryName={territoryName}
          targetPopulation={targetPopulation}
          onTerritoryNameChange={setTerritoryName}
          onTargetPopulationChange={(value) => setTargetPopulation(Math.max(1, value || DEFAULT_TARGET_POPULATION))}
          onTerritoryViewportChange={canUseAdvancedMapTools ? handleTerritoryViewportChange : undefined}
          onZipToggle={canUseAdvancedMapTools ? toggleZip : undefined}
          onTerritoryClear={clearTerritorySelection}
          onTerritorySave={saveTerritory}
          onTerritoryVisibilityToggle={toggleTerritoryVisibility}
          onTerritoryDelete={deleteTerritory}
          siteList={siteList}
          contextBadge={
            <div className="mapiq-context-pill">
              <Compass size={16} color="#E18739" />
              {showBrandSelector ? (
                <>
                  <span>Brand</span>
                  <select
                    value={brandFilter}
                    onChange={(event) => setBrandFilter(event.target.value)}
                    aria-label="Select brand for MapIQ"
                    style={{
                      minWidth: 190,
                      maxWidth: 260,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: brandFilter === "all" ? "#64748B" : "#1B2326",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <option value="all" style={{ color: "#64748B", background: "#FFFFFF" }}>Select a brand</option>
                    {visibleBrands.map((brand) => (
                      <option key={brand.id} value={brand.id} style={{ color: "#1B2326", background: "#FFFFFF" }}>{brand.name}</option>
                    ))}
                  </select>
                </>
              ) : (
                <span>MapIQ — Market Research</span>
              )}
            </div>
          }
          actions={canUseAdvancedMapTools ? [
            { label: "Save view", icon: Save, onClick: () => undefined },
            { label: "Run report", icon: FileBarChart2, primary: true, onClick: () => window.print() },
          ] : []}
          buildStats={(pin) => {
            const deals = pin.payload.deals as DealRecord[];
            const signed = deals.filter((deal) => deal.status === "Signed").length;
            const commission = deals.reduce((total, deal) => total + deal.estimatedCommission, 0);
            return [
              { value: deals.length.toLocaleString(), label: "Deals" },
              { value: signed.toLocaleString(), label: "Signed" },
              { value: formatCurrency(commission), label: "Est. Commission" },
            ];
          }}
          buildDetail={(pin) => {
            const deals = pin.payload.deals as DealRecord[];
            const firstDeal = deals[0];
            const status = pin.payload.status as DealStatusNew;
            const estimatedCommission = deals.reduce((total, deal) => total + deal.estimatedCommission, 0);
            const brands = new Set(deals.map((deal) => brandNameForDeal(deal)));
            const brokers = new Set(deals.map((deal) => deal.broker).filter(Boolean));
            return {
              title: pin.payload.city as string,
              address: firstDeal ? `${firstDeal.city}, ${firstDeal.state}` : "Mapped market",
              statusLabel: deals.length === 1 && firstDeal ? firstDeal.status : `${deals.length} deals`,
              statusColor: DEAL_STATUS_COLOR[status],
              miniStats: [
                { label: "Deals", value: deals.length.toLocaleString() },
                { label: "Brands", value: brands.size.toLocaleString() },
                { label: "Brokers", value: brokers.size.toLocaleString() },
              ],
              keyMetricsTitle: "Market Deal Summary",
              keyMetrics: [
                { label: "Estimated Commission", value: formatCurrency(estimatedCommission) },
                { label: "Signed Deals", value: deals.filter((deal) => deal.status === "Signed").length.toLocaleString() },
                { label: "Active Deals", value: deals.filter((deal) => deal.status !== "Signed" && deal.status !== "On Hold").length.toLocaleString() },
                { label: "Top Deal", value: firstDeal ? dealDisplayName(firstDeal) : "No deal" },
              ],
              primaryAction: firstDeal
                ? { label: "Open First Deal", onClick: () => navigate(`/deals/${firstDeal.id}`) }
                : undefined,
            };
          }}
        />
      </div>
    </div>
  );
}
