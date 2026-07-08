import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Hash, Layers, ListFilter, MapPin, Trash2, X } from "lucide-react";
import { DealCityMap, type DealCityMapResult } from "@/components/DealCityMap";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { DEAL_STATUS_ORDER, dealBrands, dealRecords, type DealRecord, type DealStatusNew } from "@/data/dealsData";
import {
  fetchTerritoryZipsByCodes,
  fetchTerritoryZipsForBounds,
  type TerritoryBounds,
  type SavedTerritory,
  type TerritoryZip,
} from "@/data/territoryData";
import { canAccessDeal, getVisibleBrandsForUser, getVisibleDealsForUser, useCurrentProfile, useScopedUser, useUserRole } from "@/hooks/useUserRole";

const statuses: DealStatusNew[] = DEAL_STATUS_ORDER;
const TERRITORY_STORAGE_KEY = "reimagine.map.territories.v2";
const DEFAULT_TARGET_POPULATION = 100000;
const CENSUS_API_KEY = import.meta.env.VITE_CENSUS_API_KEY?.trim();
type ZipPopulationMap = Record<string, number | null>;

function dealTitle(deal: DealRecord): string {
  const brand = dealBrands.find((item) => item.id === deal.brandId);
  return deal.name || `${brand?.name ?? "Deal"} ${[deal.city, deal.state].filter(Boolean).join(", ")}`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatOptionalNumber(value: number | null | undefined): string {
  return typeof value === "number" ? formatNumber(value) : "—";
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

async function withPopulationTimeout<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
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

async function fetchCensusApiPopulation(zipCode: string): Promise<number | null> {
  if (!CENSUS_API_KEY) return null;

  return withPopulationTimeout(async (signal) => {
    const params = new URLSearchParams({
      get: "B01003_001E",
      for: `zip code tabulation area:${zipCode}`,
      key: CENSUS_API_KEY,
    });
    const response = await fetch(`https://api.census.gov/data/2022/acs/acs5?${params.toString()}`, { signal });
    if (!response.ok || response.redirected) return null;
    const data = await response.json();
    const value = Number(data?.[1]?.[0]);
    return Number.isFinite(value) && value > 0 ? value : null;
  });
}

async function fetchCensusReporterPopulations(zipCodes: string[]): Promise<ZipPopulationMap> {
  const uniqueCodes = Array.from(new Set(zipCodes));
  if (uniqueCodes.length === 0) return {};

  const fallback = Object.fromEntries(uniqueCodes.map((zipCode) => [zipCode, null])) as ZipPopulationMap;
  const populations = await withPopulationTimeout(async (signal) => {
    const geoIds = uniqueCodes.map((zipCode) => `86000US${zipCode}`).join(",");
    const params = new URLSearchParams({ table_ids: "B01003", geo_ids: geoIds });
    const response = await fetch(`https://api.censusreporter.org/1.0/data/show/latest?${params.toString()}`, { signal });
    if (!response.ok) return fallback;
    const data = await response.json();
    return Object.fromEntries(uniqueCodes.map((zipCode) => {
      const value = Number(data?.data?.[`86000US${zipCode}`]?.B01003?.estimate?.B01003001);
      return [zipCode, Number.isFinite(value) && value > 0 ? value : null];
    })) as ZipPopulationMap;
  });

  return populations ?? fallback;
}

async function fetchZipPopulations(zipCodes: string[]): Promise<ZipPopulationMap> {
  if (typeof fetch === "undefined" || typeof window === "undefined") {
    return Object.fromEntries(zipCodes.map((zipCode) => [zipCode, null])) as ZipPopulationMap;
  }

  const uniqueCodes = Array.from(new Set(zipCodes));
  const populations: ZipPopulationMap = {};
  const reporterCodes: string[] = [];

  await Promise.all(uniqueCodes.map(async (zipCode) => {
    const censusPopulation = await fetchCensusApiPopulation(zipCode);
    if (typeof censusPopulation === "number") {
      populations[zipCode] = censusPopulation;
      return;
    }
    reporterCodes.push(zipCode);
  }));

  Object.assign(populations, await fetchCensusReporterPopulations(reporterCodes));
  uniqueCodes.forEach((zipCode) => {
    if (!(zipCode in populations)) populations[zipCode] = null;
  });

  return populations;
}

function useCountUp(value: number): number {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const start = displayRef.current;
    const delta = value - start;
    if (delta === 0) return;

    let frame = 0;
    const totalFrames = 18;
    const id = window.setInterval(() => {
      frame += 1;
      const pct = Math.min(1, frame / totalFrames);
      const next = Math.round(start + delta * pct);
      displayRef.current = next;
      setDisplay(next);
      if (pct === 1) window.clearInterval(id);
    }, 20);

    return () => window.clearInterval(id);
  }, [value]);

  return display;
}

function TerritoryBuilderPanel({
  territoryName,
  setTerritoryName,
  targetPopulation,
  setTargetPopulation,
  selectedZips,
  selectedZipCodes,
  zipPopulationByCode,
  totalPopulation,
  displayPopulation,
  loadingZipCodes,
  onRemoveZip,
  onClear,
  onClose,
  onSave,
}: {
  territoryName: string;
  setTerritoryName: (value: string) => void;
  targetPopulation: number;
  setTargetPopulation: (value: number) => void;
  selectedZips: TerritoryZip[];
  selectedZipCodes: string[];
  zipPopulationByCode: Record<string, number | null>;
  totalPopulation: number;
  displayPopulation: number;
  loadingZipCodes: string[];
  onRemoveZip: (zipCode: string) => void;
  onClear: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const progress = targetPopulation > 0 ? Math.min(100, (totalPopulation / targetPopulation) * 100) : 0;
  const targetReached = selectedZipCodes.length > 0 && totalPopulation >= targetPopulation;
  const avgPopulation = selectedZipCodes.length > 0 ? Math.round(totalPopulation / selectedZipCodes.length) : 0;

  return (
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-200 absolute right-4 top-4 z-[500] flex max-h-[calc(100%-2rem)] w-[360px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[14px]"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "0 22px 50px rgba(15,23,42,0.22)" }}
    >
      <div className="flex items-center justify-between" style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-divider)" }}>
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4" style={{ color: "var(--text-orange-ui)" }} />
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Territory Builder</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-hover)]"
          aria-label="Close territory builder"
          title="Close"
        >
          <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      <div className="themed-scrollbar flex-1 overflow-y-auto" style={{ padding: 16 }}>
        <label className="section-label" htmlFor="territory-name">Territory Name</label>
        <input
          id="territory-name"
          value={territoryName}
          onChange={(event) => setTerritoryName(event.target.value)}
          placeholder="Name this territory"
          className="glass-input mt-2 w-full px-3 py-2 text-sm"
        />

        <div className="mt-4 rounded-[12px] text-center" style={{ background: "var(--bg-card)", padding: 18 }}>
          <p style={{ fontSize: 34, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{formatNumber(displayPopulation)}</p>
          <p className="section-label mt-2">Total Population</p>
          {loadingZipCodes.length > 0 && (
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>Updating Census estimates...</p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
          <span>{selectedZipCodes.length} zip{selectedZipCodes.length === 1 ? "" : "s"} selected</span>
          <span>Avg: {formatNumber(avgPopulation)}/zip</span>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <label className="section-label" htmlFor="target-population">Target Population</label>
          <input
            id="target-population"
            type="number"
            min={1}
            value={targetPopulation}
            onChange={(event) => setTargetPopulation(Math.max(1, Number(event.target.value) || DEFAULT_TARGET_POPULATION))}
            className="glass-input h-8 w-32 px-2 text-right text-sm font-semibold"
          />
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--border-divider)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: targetReached ? "#059669" : "#243c51" }}
          />
        </div>
        {targetReached && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#059669" }}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Target reached!
          </div>
        )}

        <div className="mt-5" style={{ borderTop: "1px solid var(--border-divider)", paddingTop: 14 }}>
          <span className="section-label">Selected Zips</span>
          <div className="mt-2 flex flex-col">
            {selectedZips.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>No zip codes selected.</p>
            ) : (
              selectedZips.map((zip) => (
                <div key={zip.zip} className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{zip.zip}</p>
                    <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{zip.label}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {loadingZipCodes.includes(zip.zip) ? "Loading..." : formatOptionalNumber(zipPopulationByCode[zip.zip])}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveZip(zip.zip)}
                      className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-hover)]"
                      aria-label={`Remove ${zip.zip}`}
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2" style={{ padding: 16, borderTop: "1px solid var(--border-divider)" }}>
        <button
          type="button"
          onClick={onClear}
          className="flex-1 rounded-[8px] px-3 py-2 text-sm font-semibold"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", background: "transparent" }}
        >
          Clear All
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={selectedZipCodes.length === 0 || loadingZipCodes.length > 0}
          className="flex-1 rounded-[8px] px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: "#fff", background: "#243c51" }}
        >
          Save Territory
        </button>
      </div>
    </div>
  );
}

export default function MapView() {
  const runtimeDataVersion = useRuntimeDataVersion();
  const [searchParams] = useSearchParams();
  const requestedDealId = searchParams.get("deal") || "";
  const requestedBrandId = searchParams.get("brand") || "";
  const role = useUserRole();
  const profile = useCurrentProfile();
  const user = useScopedUser();
  const canUseAdvancedMapTools = role === "admin";
  const [brandFilter, setBrandFilter] = useState(() => requestedBrandId || "all");
  const [stageFilter, setStageFilter] = useState("all");
  const [mapResult, setMapResult] = useState<DealCityMapResult>({ pins: [], unmappedDeals: [] });
  const [territoryMode, setTerritoryMode] = useState(false);
  const [selectedZipCodes, setSelectedZipCodes] = useState<string[]>([]);
  const [territoryName, setTerritoryName] = useState("");
  const [targetPopulation, setTargetPopulation] = useState(DEFAULT_TARGET_POPULATION);
  const [territoryZips, setTerritoryZips] = useState<TerritoryZip[]>([]);
  const [territoryBoundsLoading, setTerritoryBoundsLoading] = useState(false);
  const [territoryBoundsError, setTerritoryBoundsError] = useState<string | null>(null);
  const [zipPopulationByCode, setZipPopulationByCode] = useState<Record<string, number | null>>({});
  const [loadingZipCodes, setLoadingZipCodes] = useState<string[]>([]);
  const [savedTerritories, setSavedTerritories] = useState<SavedTerritory[]>([]);
  const [visibleTerritoryIds, setVisibleTerritoryIds] = useState<string[]>([]);
  const [territoriesHydrated, setTerritoriesHydrated] = useState(false);
  const territoryBoundsRequestRef = useRef(0);
  const territoryZipsRef = useRef<TerritoryZip[]>([]);
  const populationRequestsRef = useRef<Set<string>>(new Set());
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
    if (!canUseAdvancedMapTools && territoryMode) {
      setTerritoryMode(false);
      setSelectedZipCodes([]);
    }
  }, [canUseAdvancedMapTools, territoryMode]);

  const visibleDeals = useMemo(() => {
    void runtimeDataVersion;
    let base = getVisibleDealsForUser(user ?? role, dealRecords).filter((deal) => !deal.isOneOff);
    if (role === "deal" && profile?.dealId) {
      base = base.filter((deal) => deal.id === profile.dealId);
    }
    if (requestedDealId) {
      base = base.filter((deal) => deal.id === requestedDealId && canAccessDeal(user ?? role, deal));
    }
    return base;
  }, [profile?.dealId, requestedDealId, role, runtimeDataVersion, user]);

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
    let next = visibleDeals;
    if (brandFilter !== "all") next = next.filter((deal) => deal.brandId === brandFilter);
    if (stageFilter !== "all") next = next.filter((deal) => deal.status === stageFilter);
    return next;
  }, [brandFilter, stageFilter, visibleDeals]);

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

  const territoryZipByCode = useMemo(() => new Map(territoryZips.map((zip) => [zip.zip, zip])), [territoryZips]);
  const selectedZips = useMemo(
    () => selectedZipCodes.map((zipCode) => territoryZipByCode.get(zipCode)).filter(Boolean) as TerritoryZip[],
    [selectedZipCodes, territoryZipByCode],
  );

  const totalPopulation = useMemo(
    () => selectedZipCodes.reduce((total, zipCode) => total + (zipPopulationByCode[zipCode] ?? 0), 0),
    [selectedZipCodes, zipPopulationByCode],
  );
  const displayPopulation = useCountUp(totalPopulation);

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
      !(zipCode in zipPopulationByCode) && !populationRequestsRef.current.has(zipCode)
    ));
    if (missingZipCodes.length === 0) return;

    missingZipCodes.forEach((zipCode) => populationRequestsRef.current.add(zipCode));
    setLoadingZipCodes((current) => Array.from(new Set([...current, ...missingZipCodes])));

    void fetchZipPopulations(missingZipCodes)
      .then((populations) => {
        if (!mountedRef.current) return;
        setZipPopulationByCode((current) => ({ ...current, ...populations }));
      })
      .finally(() => {
        missingZipCodes.forEach((zipCode) => populationRequestsRef.current.delete(zipCode));
        if (!mountedRef.current) return;
        setLoadingZipCodes((current) => current.filter((item) => !missingZipCodes.includes(item)));
      });
  }, [selectedZipCodes, zipPopulationByCode]);

  const toggleZip = useCallback((zipCode: string) => {
    setTerritoryMode(true);
    setTerritoryName((current) => current.trim() || `Territory ${savedTerritories.length + 1}`);
    setSelectedZipCodes((current) => (
      current.includes(zipCode)
        ? current.filter((item) => item !== zipCode)
        : [...current, zipCode]
    ));
  }, [savedTerritories.length]);

  const clearSelection = () => {
    setSelectedZipCodes([]);
    setTerritoryName("");
    setTargetPopulation(DEFAULT_TARGET_POPULATION);
  };

  const saveTerritory = () => {
    if (selectedZipCodes.length === 0 || loadingZipCodes.length > 0) return;
    const name = territoryName.trim() || `Territory ${savedTerritories.length + 1}`;
    const territory: SavedTerritory = {
      id: createTerritoryId(),
      name,
      targetPopulation,
      zipCodes: selectedZipCodes,
      population: totalPopulation,
      createdAt: new Date().toISOString(),
    };
    setSavedTerritories((current) => [territory, ...current]);
    setVisibleTerritoryIds((current) => [territory.id, ...current]);
    clearSelection();
    setTerritoryMode(false);
  };

  const toggleTerritoryVisibility = (territoryId: string) => {
    setVisibleTerritoryIds((current) => (
      current.includes(territoryId)
        ? current.filter((id) => id !== territoryId)
        : [...current, territoryId]
    ));
  };

  const deleteTerritory = (territoryId: string) => {
    setSavedTerritories((current) => current.filter((territory) => territory.id !== territoryId));
    setVisibleTerritoryIds((current) => current.filter((id) => id !== territoryId));
  };

  return (
    <div className="animate-fade-in" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1600, margin: "0 auto" }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Deal City Map
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            City-level pins are generated from imported deals. Site coordinates are used first when available.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setTerritoryMode((current) => !current)}
            disabled={!canUseAdvancedMapTools}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold transition-colors"
            style={{
              color: territoryMode ? "#fff" : "var(--text-primary)",
              background: territoryMode ? "#243c51" : "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              display: canUseAdvancedMapTools ? "inline-flex" : "none",
            }}
          >
            <Hash className="h-4 w-4" />
            Zip Draw
          </button>
          {role === "admin" && (
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-44 glass-input text-sm"><SelectValue placeholder="All Brands" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {visibleBrands.map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-52 glass-input text-sm"><SelectValue placeholder="All Stages" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]" style={{ gap: 18 }}>
        <div className="glass-card-static relative overflow-hidden" style={{ padding: 0, minHeight: 660 }}>
          <DealCityMap
            deals={filteredDeals}
            className="h-full w-full"
            onComputed={setMapResult}
            territoryMode={territoryMode}
            territoryZips={canUseAdvancedMapTools ? territoryZips : []}
            selectedZipCodes={canUseAdvancedMapTools ? selectedZipCodes : []}
            savedTerritories={canUseAdvancedMapTools ? savedTerritories : []}
            visibleTerritoryIds={canUseAdvancedMapTools ? visibleTerritoryIds : []}
            onTerritoryViewportChange={canUseAdvancedMapTools ? handleTerritoryViewportChange : undefined}
            onZipToggle={canUseAdvancedMapTools ? toggleZip : undefined}
          />

          {canUseAdvancedMapTools && territoryMode && (
            <div
              className="absolute left-1/2 top-4 z-[450] -translate-x-1/2 rounded-[10px] px-4 py-2 text-sm font-semibold"
              style={{ color: "#fff", background: "rgba(15,23,42,0.86)", boxShadow: "0 10px 24px rgba(15,23,42,0.2)" }}
            >
              {territoryBoundsLoading ? "Loading ZIP boundaries..." : "Click zip codes to build your territory"}
            </div>
          )}

          {canUseAdvancedMapTools && territoryMode && territoryBoundsError && (
            <div
              className="absolute left-4 bottom-5 z-[450] max-w-[360px] rounded-[10px] px-3 py-2 text-xs font-semibold"
              style={{ color: "#991b1b", background: "rgba(254,226,226,0.94)", border: "1px solid rgba(153,27,27,0.18)" }}
            >
              {territoryBoundsError}
            </div>
          )}

          {canUseAdvancedMapTools && (
            <button
              type="button"
              onClick={() => setTerritoryMode((current) => !current)}
              className="absolute bottom-5 right-5 z-[430] flex h-12 w-12 items-center justify-center rounded-[12px] transition-colors"
              style={{
                color: territoryMode ? "#fff" : "var(--text-primary)",
                background: territoryMode ? "#243c51" : "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
              }}
              aria-label="Toggle zip draw tool"
              title="Zip draw"
            >
              <Hash className="h-5 w-5" />
            </button>
          )}

          {canUseAdvancedMapTools && territoryMode && (
            <TerritoryBuilderPanel
              territoryName={territoryName}
              setTerritoryName={setTerritoryName}
              targetPopulation={targetPopulation}
              setTargetPopulation={setTargetPopulation}
              selectedZips={selectedZips}
              selectedZipCodes={selectedZipCodes}
              zipPopulationByCode={zipPopulationByCode}
              totalPopulation={totalPopulation}
              displayPopulation={displayPopulation}
              loadingZipCodes={loadingZipCodes}
              onRemoveZip={toggleZip}
              onClear={clearSelection}
              onClose={() => setTerritoryMode(false)}
              onSave={saveTerritory}
            />
          )}
        </div>

        <aside className="glass-card-static overflow-hidden" style={{ padding: 0 }}>
          <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-divider)" }}>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" style={{ color: "#E18739" }} />
              <span className="section-label">Layers</span>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{filteredDeals.length} deals</span>
          </div>

          <div className="themed-scrollbar overflow-y-auto" style={{ maxHeight: 640, padding: 14 }}>
            {canUseAdvancedMapTools && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <span className="section-label">Territories</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{savedTerritories.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {savedTerritories.length === 0 ? (
                    <p className="rounded-[10px] p-4 text-sm" style={{ color: "var(--text-muted)", border: "1px dashed var(--border-divider)" }}>No territories saved.</p>
                  ) : (
                    savedTerritories.map((territory) => {
                      const visible = visibleTerritoryIds.includes(territory.id);
                      return (
                        <div
                          key={territory.id}
                          className="rounded-[10px] p-3"
                          style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: "#E18739" }} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{territory.name}</p>
                              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                {territory.zipCodes.length} zips · {formatNumber(territory.population)} pop
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleTerritoryVisibility(territory.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--bg-hover)]"
                              aria-label={`${visible ? "Hide" : "Show"} ${territory.name}`}
                              title={visible ? "Hide" : "Show"}
                            >
                              {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTerritory(territory.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--bg-hover)]"
                              aria-label={`Delete ${territory.name}`}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" style={{ color: "#991b1b" }} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            <section className={canUseAdvancedMapTools ? "mt-5" : ""}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" style={{ color: "#E18739" }} />
                  <span className="section-label">{mapResult.pins.length} City Pins</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {filteredDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    to={`/deals/${deal.id}`}
                    className="block rounded-[10px] p-3 transition-colors"
                    style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{dealTitle(deal)}</p>
                        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{deal.franchisee || "Franchisee"} · {[deal.city, deal.state].filter(Boolean).join(", ") || "Unknown location"}</p>
                      </div>
                      <DealStatusBadge status={deal.status} />
                    </div>
                  </Link>
                ))}
                {filteredDeals.length === 0 && (
                  <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>No deals match this map scope.</div>
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>

      <div className="glass-card-static" style={{ padding: 18 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <ListFilter className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <span className="section-label">Unmapped Deals</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{mapResult.unmappedDeals.length}</span>
        </div>
        {mapResult.unmappedDeals.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>All visible deals have city/state or fallback coordinates.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: 10 }}>
            {mapResult.unmappedDeals.map((deal) => (
              <Link key={deal.id} to={`/deals/${deal.id}`} className="rounded-[10px] p-3 text-sm font-semibold" style={{ border: "1px solid var(--border-subtle)", color: "var(--text-primary)", background: "var(--bg-card)" }}>
                {dealTitle(deal)}
                <span className="mt-1 block text-xs font-normal" style={{ color: "var(--text-muted)" }}>{deal.city || "No city"}, {deal.state || "No state"}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
