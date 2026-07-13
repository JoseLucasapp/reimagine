import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  dealRecords, dealBrands, getDealBrandById,
  DEAL_STATUS_ORDER, emptyDealDocuments, DealStatusNew, KANBAN_COLUMNS, daysActive, DealRecord, DealDocuments,
} from "@/data/dealsData";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { DealHealthIndicator } from "@/components/DealHealthIndicator";
import { StageTimingBadge } from "@/components/StageTimingBadge";
import { BrandAvatar } from "@/components/BrandAvatar";
import { buildDealCityPins } from "@/components/DealCityMap";
import { MapIQCanvas, type MapIQPinData } from "@/components/mapiq/MapIQCanvas";
import {
  Search, LayoutList, Columns3, Map as MapIcon, Plus, ChevronRight, FileText, MoreHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScopedUser, useUserRole, canEditDeal, canViewFinancials, getVisibleBrandsForUser, getVisibleDealsForUser } from "@/hooks/useUserRole";
import { createDeal, updateDeal } from "@/application/data/runtimeMutations";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { toast } from "sonner";
import { MapIQModal } from "@/components/mapiq/MapIQModal";

type ViewMode = "table" | "kanban" | "map";

const ALL_STATUSES: DealStatusNew[] = DEAL_STATUS_ORDER;

const DEAL_MAP_STATUS_COLOR: Record<DealStatusNew, string> = {
  "Kick Off": "#94A3B8",
  "Market Study": "#8B5CF6",
  "Site Tours": "#14B8A6",
  "LOI Negotiations": "#1E5BA8",
  "Lease Negotiations": "#3B82F6",
  Signed: "#059669",
  "On Hold": "#E18739",
};

const DOCUMENT_FIELDS: { key: keyof DealDocuments; label: string }[] = [
  { key: "engagementLetter", label: "Engagement Letter" },
  { key: "cobrokerAgreement", label: "Co-Broker Agreement" },
  { key: "flyer", label: "Flyer" },
  { key: "demo", label: "Demo" },
  { key: "signedLOI", label: "Signed LOI" },
  { key: "floorPlan", label: "Floor Plan" },
  { key: "approvalPackage", label: "Approval Package" },
  { key: "commissionAgreement", label: "Commission Agreement" },
  { key: "signedLease", label: "Signed Lease" },
];

const LINK_DEFAULT = "https://";

interface DealsPageProps {
  brandFilter?: string;
  isOneOff?: boolean;
  onAddDeal?: () => void;
  forcedView?: Exclude<ViewMode, "map">;
  hideViewToggle?: boolean;
}

export default function DealsPage({ brandFilter, isOneOff, onAddDeal, forcedView, hideViewToggle }: DealsPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedInitialView = (searchParams.get("view") as ViewMode) || "table";
  const initialView = requestedInitialView === "map" ? "table" : requestedInitialView;
  const [view, setView] = useState<ViewMode>(["table", "kanban", "map"].includes(initialView) ? initialView : "table");
  const [openInitialMap, setOpenInitialMap] = useState(requestedInitialView === "map");
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [brandFilterState, setBrandFilterState] = useState<string[]>(
    brandFilter ? [brandFilter] : (searchParams.get("brand") ? [searchParams.get("brand") as string] : [])
  );
  const [brokerFilter, setBrokerFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealRecord | null>(null);
  const runtimeDataVersion = useRuntimeDataVersion();
  const role = useUserRole();
  const user = useScopedUser();
  const allowEdit = canEditDeal(role);
  const effectiveView = forcedView ?? view;

  useEffect(() => {
    if (openInitialMap) {
      setMapModalOpen(true);
      setOpenInitialMap(false);
    }
  }, [openInitialMap]);

  useEffect(() => {
    if (view === "map") {
      setView("table");
      setMapModalOpen(true);
    }
  }, [view]);

  const baseDeals = useMemo(() => {
    void runtimeDataVersion;
    let d = getVisibleDealsForUser(user ?? role, dealRecords);
    if (isOneOff) d = d.filter((x) => x.isOneOff);
    else if (brandFilter) d = d.filter((x) => x.brandId === brandFilter && !x.isOneOff);
    else d = d.filter((x) => !x.isOneOff);
    return d;
  }, [brandFilter, isOneOff, role, runtimeDataVersion, user]);

  const visibleBrands = useMemo(() => {
    void runtimeDataVersion;
    return getVisibleBrandsForUser(user ?? role, dealBrands, baseDeals);
  }, [baseDeals, role, runtimeDataVersion, user]);

  const filtered = useMemo(() => {
    let d = baseDeals;
    if (search) {
      const q = search.toLowerCase();
      d = d.filter((x) =>
        (x.name ?? x.franchisee).toLowerCase().includes(q) ||
        x.franchisee.toLowerCase().includes(q) ||
        x.city.toLowerCase().includes(q) ||
        x.broker.toLowerCase().includes(q) ||
        getDealBrandById(x.brandId)?.name.toLowerCase().includes(q)
      );
    }
    if (statusFilter.length > 0) d = d.filter((x) => statusFilter.includes(x.status));
    if (brandFilterState.length > 0) d = d.filter((x) => brandFilterState.includes(x.brandId));
    if (brokerFilter.length > 0) d = d.filter((x) => brokerFilter.includes(x.broker));
    if (stateFilter.length > 0) d = d.filter((x) => stateFilter.includes(x.state));
    return d;
  }, [baseDeals, search, statusFilter, brandFilterState, brokerFilter, stateFilter]);
  const filteredDealIds = useMemo(() => filtered.map((deal) => deal.id), [filtered]);

  const handleAddDeal = () => {
    setEditingDeal(null);
    setShowDrawer(true);
  };

  return (
    <div className="animate-fade-in">
    <div className="p-4 md:p-7" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1600, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ marginBottom: -4 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {isOneOff ? "One-Off Deals" : "Deals"}
          </h1>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#E18739", marginTop: 4 }}>
            ✦ {filtered.length} DEALS
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!hideViewToggle && (
            <div className="flex p-0.5 rounded-[11px]" style={{ background: "var(--view-toggle-bg)", border: "1px solid var(--border-subtle)" }}>
              {([["table", LayoutList], ["kanban", Columns3], ["map", MapIcon]] as const).map(([m, Icon]) => (
                <button
                  key={m}
                  onClick={() => {
                    if (m === "map") {
                      setMapModalOpen(true);
                      return;
                    }
                    setView(m);
                  }}
                  className="p-2 rounded-[9px] transition-colors"
                  style={effectiveView === m ? { background: "var(--view-toggle-active-bg)", color: "var(--view-toggle-active-color)" } : { color: "#94a3b8" }}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          )}
          {allowEdit && (
            <button
              onClick={handleAddDeal}
              className="cta-secondary inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Deal
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
          <input
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-9 pr-4 py-2 text-sm"
          />
        </div>
        {!brandFilter && (
          <MultiSelectFilter
            label="Brand"
            value={brandFilterState}
            onChange={setBrandFilterState}
            options={visibleBrands.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
        <MultiSelectFilter
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={ALL_STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <MultiSelectFilter
          label="Broker"
          value={brokerFilter}
          onChange={setBrokerFilter}
          options={[...new Set(baseDeals.map((deal) => deal.broker).filter(Boolean))].sort().map((b) => ({ value: b, label: b }))}
        />
        <MultiSelectFilter
          label="State"
          value={stateFilter}
          onChange={setStateFilter}
          options={[...new Set(baseDeals.map((deal) => deal.state).filter(Boolean))].sort().map((s) => ({ value: s, label: s }))}
        />
      </div>

      {/* Table View */}
      {effectiveView === "table" && <DealsTable deals={filtered} navigate={navigate} setEditingDeal={setEditingDeal} setShowDrawer={setShowDrawer} allowEdit={allowEdit} />}

      {/* Kanban View */}
      {effectiveView === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const cards = filtered.filter((d) => d.status === col);
            const isSigned = col === "Signed";
            return (
              <div key={col} className="min-w-[260px] w-[260px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <DealStatusBadge status={col} />
                  <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>{cards.length}</span>
                </div>
                <div className="space-y-2.5">
                  {cards.map((deal) => {
                    const brand = getDealBrandById(deal.brandId);
                    return (
                      <div
                        key={deal.id}
                        className="p-3.5 cursor-pointer transition-all duration-200 group"
                        onClick={() => navigate(`/deals/${deal.id}`)}
                        style={{
                          background: isSigned ? "rgba(5, 150, 105, 0.04)" : "var(--stat-card-bg)",
                          backdropFilter: "blur(14px)",
                          WebkitBackdropFilter: "blur(14px)",
                          border: isSigned ? "0.56px solid rgba(5, 150, 105, 0.20)" : "0.56px solid var(--stat-card-border)",
                          borderRadius: 14,
                          boxShadow: "var(--shadow-card)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isSigned ? "rgba(5,150,105,0.07)" : "var(--bg-card-hover)";
                          e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isSigned ? "rgba(5, 150, 105, 0.04)" : "var(--stat-card-bg)";
                          e.currentTarget.style.boxShadow = "var(--shadow-card)";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{brand?.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 transition-colors" style={{ color: "var(--text-faint)" }} />
                        </div>
                        <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>{deal.name ?? deal.franchisee}</p>
                        <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>{deal.city}, {deal.state}</p>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold" style={{ color: "var(--text-orange-ui)" }}>{deal.broker}</span>
                          <DealHealthIndicator deal={deal} />
                        </div>
                        <div className="flex items-center justify-between">
                          <StageTimingBadge deal={deal} />
                          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{daysActive(deal)}d</span>
                        </div>
                      </div>
                    );
                  })}
                  {cards.length === 0 && (
                    <div className="rounded-[10px] p-6 text-center text-xs" style={{ border: "1px dashed rgba(36,60,81,0.12)", color: "#94a3b8" }}>
                      No deals
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MapIQModal
        open={mapModalOpen}
        onOpenChange={setMapModalOpen}
        title={brandFilter ? "Brand Deals MapIQ" : "Deals MapIQ"}
        description="Advanced MapIQ tools scoped to your visible deals."
        dealIds={filteredDealIds}
        brandId={brandFilter}
      />

      {/* Add/Edit Drawer */}
      {showDrawer && (
        <DealDrawer
          deal={editingDeal}
          brandId={brandFilter}
          defaultIsOneOff={Boolean(isOneOff)}
          onSaved={() => {
            setSearch("");
            setStatusFilter([]);
            setBrokerFilter([]);
            setStateFilter([]);
            setBrandFilterState(brandFilter ? [brandFilter] : []);
            onAddDeal?.();
          }}
          onClose={() => { setShowDrawer(false); setEditingDeal(null); }}
        />
      )}
    </div>
    </div>
  );
}


function majorityDealStatus(deals: DealRecord[]): DealStatusNew {
  const counts = new Map<DealStatusNew, number>();
  deals.forEach((deal) => counts.set(deal.status, (counts.get(deal.status) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Kick Off";
}

function formatMapCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function dealMapBrandName(deal: DealRecord): string {
  return getDealBrandById(deal.brandId)?.name ?? "Deal";
}

function dealMapDisplayName(deal: DealRecord): string {
  return deal.name || `${dealMapBrandName(deal)} - ${deal.franchisee}`;
}

function DealsMapPanel({ deals, navigate }: { deals: DealRecord[]; navigate: (path: string) => void }) {
  const cityPinResult = useMemo(() => buildDealCityPins(deals), [deals]);

  const pins = useMemo<MapIQPinData[]>(() => (
    cityPinResult.pins.map((pin) => {
      const status = majorityDealStatus(pin.deals);
      const statusCount = new Set(pin.deals.map((deal) => deal.status)).size;
      return {
        id: pin.key,
        lngLat: [pin.lng, pin.lat] as [number, number],
        kind: "study" as const,
        color: statusCount === 1 ? DEAL_MAP_STATUS_COLOR[status] : "#243C51",
        label: pin.deals.length > 1 ? String(pin.deals.length) : "",
        payload: {
          city: pin.label,
          precision: pin.precision,
          deals: pin.deals,
          status,
        },
      };
    })
  ), [cityPinResult.pins]);

  const defaultCenter = pins[0]?.lngLat ?? ([-96.797, 32.8198] as [number, number]);
  const siteList = useMemo(() => ({
    tabs: ["All", ...ALL_STATUSES],
    rows: cityPinResult.pins.map((pin) => {
      const status = majorityDealStatus(pin.deals);
      return {
        id: pin.key,
        status,
        statusColor: DEAL_MAP_STATUS_COLOR[status],
        name: pin.label,
        address: `${pin.deals.length} deal${pin.deals.length === 1 ? "" : "s"}`,
        meta: pin.precision === "site" ? "site coordinates" : "city coordinates",
      };
    }),
  }), [cityPinResult.pins]);

  const searchSuggestions = useMemo(
    () => cityPinResult.pins.map((pin) => ({
      label: pin.label,
      sub: `${pin.deals.length} deal${pin.deals.length === 1 ? "" : "s"}`,
      lngLat: [pin.lng, pin.lat] as [number, number],
    })),
    [cityPinResult.pins],
  );

  if (deals.length === 0 || pins.length === 0) {
    return (
      <div className="glass-card-static p-16 text-center">
        <MapIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "#b8c5d0" }} />
        <p className="text-sm font-medium" style={{ color: "#4a5568" }}>No deals to map</p>
        <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>Adjust the filters or add site/city coordinates.</p>
      </div>
    );
  }

  return (
    <div className="glass-card-static overflow-hidden" style={{ borderRadius: 14, padding: 0, height: 620 }}>
      <MapIQCanvas
        level={1}
        pins={pins}
        defaultCenter={defaultCenter}
        defaultZoom={pins.length > 0 ? 9 : 11}
        fitPinsOnLoad
        searchSuggestions={searchSuggestions}
        showDrawTools={false}
        enableTerritoryBuilder={false}
        showSavedViews={false}
        siteList={siteList}
        contextBadge={
          <div className="mapiq-context-pill">
            <MapIcon size={16} color="#E18739" />
            <span>MapIQ — Deals</span>
          </div>
        }
        actions={[]}
        buildStats={(pin) => {
          const pinDeals = pin.payload.deals as DealRecord[];
          const signed = pinDeals.filter((deal) => deal.status === "Signed").length;
          const commission = pinDeals.reduce((total, deal) => total + deal.estimatedCommission, 0);
          return [
            { value: pinDeals.length.toLocaleString(), label: "Deals" },
            { value: signed.toLocaleString(), label: "Signed" },
            { value: formatMapCurrency(commission), label: "Est. Commission" },
          ];
        }}
        buildDetail={(pin) => {
          const pinDeals = pin.payload.deals as DealRecord[];
          const firstDeal = pinDeals[0];
          const status = pin.payload.status as DealStatusNew;
          const estimatedCommission = pinDeals.reduce((total, deal) => total + deal.estimatedCommission, 0);
          const brands = new Set(pinDeals.map((deal) => dealMapBrandName(deal)));
          const brokers = new Set(pinDeals.map((deal) => deal.broker).filter(Boolean));
          return {
            title: pin.payload.city as string,
            address: firstDeal ? `${firstDeal.city}, ${firstDeal.state}` : "Mapped market",
            statusLabel: pinDeals.length === 1 && firstDeal ? firstDeal.status : `${pinDeals.length} deals`,
            statusColor: DEAL_MAP_STATUS_COLOR[status],
            miniStats: [
              { label: "Deals", value: pinDeals.length.toLocaleString() },
              { label: "Brands", value: brands.size.toLocaleString() },
              { label: "Brokers", value: brokers.size.toLocaleString() },
            ],
            keyMetricsTitle: "Market Deal Summary",
            keyMetrics: [
              { label: "Estimated Commission", value: formatMapCurrency(estimatedCommission) },
              { label: "Signed Deals", value: pinDeals.filter((deal) => deal.status === "Signed").length.toLocaleString() },
              { label: "Active Deals", value: pinDeals.filter((deal) => deal.status !== "Signed" && deal.status !== "On Hold").length.toLocaleString() },
              { label: "Top Deal", value: firstDeal ? dealMapDisplayName(firstDeal) : "No deal" },
            ],
            primaryAction: firstDeal
              ? { label: "Open First Deal", onClick: () => navigate(`/deals/${firstDeal.id}`) }
              : undefined,
          };
        }}
      />
    </div>
  );
}

// ===== DEALS TABLE =====
const ROWS_PER_PAGE = 10;

function getVisiblePageItems(currentPage: number, totalPages: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>([1, totalPages]);
  for (let pageNumber = currentPage - 2; pageNumber <= currentPage + 2; pageNumber += 1) {
    if (pageNumber > 1 && pageNumber < totalPages) pages.add(pageNumber);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [];

  sorted.forEach((pageNumber, index) => {
    const previous = sorted[index - 1];
    if (previous && pageNumber - previous > 1) {
      items.push(previous === 1 ? "ellipsis-start" : "ellipsis-end");
    }
    items.push(pageNumber);
  });

  return items;
}

function DealsTable({ deals, navigate, setEditingDeal, setShowDrawer, allowEdit }: {
  deals: DealRecord[];
  navigate: (path: string) => void;
  setEditingDeal: (d: DealRecord | null) => void;
  setShowDrawer: (v: boolean) => void;
  allowEdit: boolean;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(deals.length / ROWS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [deals.length]);

  const safePage = Math.min(page, Math.max(totalPages, 1));
  const paginated = deals.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);
  const visiblePageItems = getVisiblePageItems(safePage, totalPages);

  const COL_HEADERS = ["Brand", "Deal / Franchisee", "City, State", "Broker", "Date Started", "Days Active", "Status", "Last Update", "Docs", ""];

  if (deals.length === 0) {
    return (
      <div className="glass-table px-4 py-12 text-center text-sm" style={{ color: "#94a3b8" }}>No deals match your filters.</div>
    );
  }

  return (
    <div className="glass-table">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "var(--bg-table-header)" }}>
              {COL_HEADERS.map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-muted-foreground" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((deal) => {
              const brand = getDealBrandById(deal.brandId);
              const d = daysActive(deal);
              const lastNote = deal.notes[0];
              const docCount = Object.values(deal.documents).filter(Boolean).length;
              return (
                <tr
                  key={deal.id}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid var(--border-divider)" }}
                  onClick={() => navigate(`/deals/${deal.id}`)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(36,60,81,0.02)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Brand */}
                  <td className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                    <div className="flex items-center gap-2">
                      <BrandAvatar name={brand?.name || "?"} size={32} />
                      <span className="font-medium text-xs" style={{ color: "var(--text-primary)", maxWidth: 100 }}>{brand?.name}</span>
                    </div>
                  </td>
                  {/* Franchisee */}
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap" }}>
                    {deal.name ?? deal.franchisee}
                  </td>
                  {/* City, State */}
                  <td className="px-4 py-3" style={{ color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap" }}>
                    {deal.city}, {deal.state}
                  </td>
                  {/* Broker */}
                  <td className="px-4 py-3 font-semibold" style={{ borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--text-primary)" }}>{deal.broker}</span>
                    {deal.associate && <span style={{ color: "var(--text-faint)", fontWeight: 400 }}> / {deal.associate}</span>}
                  </td>
                  {/* Date Started */}
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap" }}>
                    {deal.dateIntroCall ? new Date(deal.dateIntroCall).toLocaleDateString() : "—"}
                  </td>
                  {/* Days Active */}
                  <td className="px-4 py-3 font-semibold" style={{ borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
                    {d}d
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                    <div className="flex flex-col items-start gap-0.5">
                      <DealStatusBadge status={deal.status} />
                      <StageTimingBadge deal={deal} />
                    </div>
                  </td>
                  {/* Last Update */}
                  <td className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-divider)", maxWidth: 180 }}>
                    <span className="text-xs truncate block" style={{ color: "var(--text-faint)" }}>{lastNote?.text}</span>
                  </td>
                  {/* Docs */}
                  <td className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                    {docCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(36,60,81,0.06)", color: "var(--text-tertiary)" }}>
                        <FileText className="w-3 h-3" />{docCount}
                      </span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-divider)" }} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded transition-colors text-[var(--text-faint)] hover:text-[#E18739]"><MoreHorizontal className="w-4 h-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/deals/${deal.id}`)}>View</DropdownMenuItem>
                        {allowEdit && <DropdownMenuItem onClick={() => { setEditingDeal(deal); setShowDrawer(true); }}>Edit</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderTop: "1px solid var(--border-divider)" }}>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            Showing {(safePage - 1) * ROWS_PER_PAGE + 1}–{Math.min(safePage * ROWS_PER_PAGE, deals.length)} of {deals.length}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="h-8 rounded-[8px] px-3 text-xs font-semibold transition-colors"
              style={{
                border: "1px solid var(--border-divider)",
                color: safePage <= 1 ? "var(--text-faint)" : "var(--text-secondary)",
                cursor: safePage <= 1 ? "default" : "pointer",
              }}
            >
              Previous
            </button>
            {visiblePageItems.map((item, index) => {
              if (typeof item !== "number") {
                return (
                  <span key={`${item}-${index}`} className="flex h-8 w-8 items-center justify-center text-xs" style={{ color: "var(--text-faint)" }}>
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  className="h-8 min-w-[32px] rounded-[8px] px-2 text-xs font-semibold transition-colors"
                  style={item === safePage
                    ? { background: "#243c51", color: "#fff" }
                    : { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-divider)" }
                  }
                >
                  {item}
                </button>
              );
            })}
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="h-8 rounded-[8px] px-3 text-xs font-semibold transition-colors"
              style={{
                border: "1px solid var(--border-divider)",
                color: safePage >= totalPages ? "var(--text-faint)" : "var(--text-secondary)",
                cursor: safePage >= totalPages ? "default" : "pointer",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { DuplicateDealWarning } from "@/components/DuplicateDealWarning";

type DealFormState = {
  brandId: string;
  franchisee: string;
  cellPhone: string;
  city: string;
  state: string;
  broker: string;
  associate: string;
  corporate: boolean;
  dateIntroCall: string;
  dateLeaseSigned: string;
  storesBought: number;
  storeCount: number;
  territoryMapLink: string;
  marketStudyLink: string;
  mapLink: string;
  tourBookLink: string;
  cobroker: string;
  cobrokerPercent: string;
  estimatedCommission: number;
  status: DealStatusNew;
  initialNote: string;
  documents: DealDocuments;
  isOneOff: boolean;
  corporateComments: string;
};

function initialLinkValue(value: string | null | undefined): string {
  return value || LINK_DEFAULT;
}

function DealSectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="section-label mt-5 mb-3">{children}</p>;
}

function DealField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</Label>
      {children}
    </div>
  );
}

function DealDrawer({
  deal,
  brandId,
  defaultIsOneOff,
  onSaved,
  onClose,
}: {
  deal: DealRecord | null;
  brandId?: string;
  defaultIsOneOff: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const isEdit = !!deal;
  const role = useUserRole();
  const showFinancials = canViewFinancials(role);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<DealFormState>({
    brandId: deal?.brandId || brandId || "",
    franchisee: deal?.franchisee || "",
    cellPhone: deal?.cellPhone || "",
    city: deal?.city || "",
    state: deal?.state || "",
    broker: deal?.broker || "",
    associate: deal?.associate || "",
    corporate: deal?.corporate || false,
    dateIntroCall: deal?.dateIntroCall || "",
    dateLeaseSigned: deal?.dateLeaseSigned || "",
    storesBought: deal?.storesBought || 0,
    storeCount: deal?.storeCount || 0,
    territoryMapLink: initialLinkValue(deal?.territoryMapLink),
    marketStudyLink: initialLinkValue(deal?.marketStudyLink),
    mapLink: initialLinkValue(deal?.mapLink),
    tourBookLink: initialLinkValue(deal?.tourBookLink),
    cobroker: deal?.cobroker || "",
    cobrokerPercent: deal?.cobrokerPercent || "",
    estimatedCommission: deal?.estimatedCommission || 0,
    status: deal?.status || ("Kick Off" as DealStatusNew),
    initialNote: "",
    documents: deal?.documents || { ...emptyDealDocuments },
    isOneOff: deal?.isOneOff ?? defaultIsOneOff,
    corporateComments: deal?.corporateComments || "",
  });

  const update = <K extends keyof DealFormState>(key: K, value: DealFormState[K]) => setFormData((p) => ({ ...p, [key]: value }));
  const updateDocument = (key: keyof DealDocuments, value: string) => {
    setFormData((p) => ({
      ...p,
      documents: {
        ...p.documents,
        [key]: value.trim() ? value : null,
      },
    }));
  };

  const handleSave = async () => {
    if (!formData.brandId) {
      toast.error("Select a brand before saving the deal.");
      return;
    }
    if (!formData.franchisee.trim()) {
      toast.error("Franchisee is required.");
      return;
    }
    if (!formData.city.trim() || !formData.state.trim()) {
      toast.error("City and state are required.");
      return;
    }
    if (!formData.broker.trim()) {
      toast.error("Broker is required.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && deal) {
        await updateDeal(deal.id, formData);
        toast.success("Deal updated");
      } else {
        await createDeal(formData);
        toast.success("Deal created", { description: formData.franchisee });
      }
      onSaved();
      onClose();
    } catch (err) {
      setSaving(false);
      toast.error("Unable to save deal", {
        description: err instanceof Error ? err.message : "Check your Supabase permissions and try again.",
      });
    }
  };

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" style={{ background: "var(--bg-surface)", backdropFilter: "blur(24px)", color: "var(--text-primary)" }}>
        <SheetHeader>
          <SheetTitle style={{ color: "var(--text-primary)" }}>{isEdit ? "Edit Deal" : "Add New Deal"}</SheetTitle>
          <SheetDescription style={{ color: "var(--text-muted)" }}>{isEdit ? "Update deal information." : "Create a new deal record."}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-1">
          <DealSectionTitle>Deal Info</DealSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <DealField label="Brand">
              <Select value={formData.brandId} onValueChange={(v) => update("brandId", v)}>
                <SelectTrigger className="glass-input w-full"><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>
                  {dealBrands.length === 0 ? (
                    <div className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>No brands available</div>
                  ) : (
                    dealBrands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </DealField>
            <DealField label="Status">
              <Select value={formData.status} onValueChange={(v) => update("status", v as DealStatusNew)}>
                <SelectTrigger className="glass-input w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </DealField>
          </div>
          <DealField label="Franchisee"><Input className="glass-input" value={formData.franchisee} onChange={(e) => update("franchisee", e.target.value)} /></DealField>
          {formData.franchisee && formData.brandId && (
            <DuplicateDealWarning
              franchisee={formData.franchisee}
              brandId={formData.brandId}
              city={formData.city}
              excludeDealId={deal?.id}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <DealField label="Cell Phone"><Input className="glass-input" value={formData.cellPhone} onChange={(e) => update("cellPhone", e.target.value)} /></DealField>
            <DealField label="Broker"><Input className="glass-input" value={formData.broker} onChange={(e) => update("broker", e.target.value)} /></DealField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <DealField label="City"><Input className="glass-input" value={formData.city} onChange={(e) => update("city", e.target.value)} /></DealField>
            <DealField label="State"><Input className="glass-input" value={formData.state} onChange={(e) => update("state", e.target.value)} /></DealField>
            <DealField label="Associate"><Input className="glass-input" value={formData.associate} onChange={(e) => update("associate", e.target.value)} /></DealField>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={formData.corporate} onCheckedChange={(v) => update("corporate", v)} />
            <Label className="text-xs" style={{ color: "var(--text-muted)" }}>Corporate Search</Label>
            <Switch checked={formData.isOneOff} onCheckedChange={(v) => update("isOneOff", v)} />
            <Label className="text-xs" style={{ color: "var(--text-muted)" }}>One-Off Deal</Label>
          </div>

          <Separator className="my-3" />
          <DealSectionTitle>Timeline</DealSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <DealField label="Date Intro Call"><Input className="glass-input" type="date" value={formData.dateIntroCall} onChange={(e) => update("dateIntroCall", e.target.value)} /></DealField>
            <DealField label="Date Lease Executed"><Input className="glass-input" type="date" value={formData.dateLeaseSigned} onChange={(e) => update("dateLeaseSigned", e.target.value)} /></DealField>
          </div>

          <Separator className="my-3" />
          <DealSectionTitle>Store Info</DealSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <DealField label="Stores Bought"><Input className="glass-input" type="number" value={formData.storesBought} onChange={(e) => update("storesBought", +e.target.value)} /></DealField>
            <DealField label="Store Count #"><Input className="glass-input" type="number" value={formData.storeCount} onChange={(e) => update("storeCount", +e.target.value)} /></DealField>
          </div>

          <Separator className="my-3" />
          <DealSectionTitle>Links</DealSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <DealField label="Territory Map URL"><Input className="glass-input" type="url" value={formData.territoryMapLink} onChange={(e) => update("territoryMapLink", e.target.value)} /></DealField>
            <DealField label="Market Study URL"><Input className="glass-input" type="url" value={formData.marketStudyLink} onChange={(e) => update("marketStudyLink", e.target.value)} /></DealField>
            <DealField label="Map URL"><Input className="glass-input" type="url" value={formData.mapLink} onChange={(e) => update("mapLink", e.target.value)} /></DealField>
            <DealField label="Tour Book URL"><Input className="glass-input" type="url" value={formData.tourBookLink} onChange={(e) => update("tourBookLink", e.target.value)} /></DealField>
          </div>

          {showFinancials && (
            <>
              <Separator className="my-3" />
              <DealSectionTitle>Co-Broker</DealSectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <DealField label="Co-Broker"><Input className="glass-input" value={formData.cobroker} onChange={(e) => update("cobroker", e.target.value)} /></DealField>
                <DealField label="Co-Broker %"><Input className="glass-input" value={formData.cobrokerPercent} onChange={(e) => update("cobrokerPercent", e.target.value)} /></DealField>
              </div>
            </>
          )}

          <Separator className="my-3" />
          <DealSectionTitle>Notes</DealSectionTitle>
          <DealField label="Initial Note"><Textarea className="glass-input" value={formData.initialNote} onChange={(e) => update("initialNote", e.target.value)} placeholder="Add a note..." rows={3} /></DealField>

          {formData.corporate && (
            <>
              <Separator className="my-3" />
              <DealSectionTitle>Corporate Comments</DealSectionTitle>
              <DealField label="Comments"><Textarea className="glass-input" value={formData.corporateComments} onChange={(e) => update("corporateComments", e.target.value)} rows={2} /></DealField>
            </>
          )}

          <Separator className="my-3" />
          <DealSectionTitle>Documents</DealSectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {DOCUMENT_FIELDS.map((doc) => (
              <DealField key={doc.key} label={doc.label}>
                <Input
                  className="glass-input"
                  type="url"
                  value={formData.documents[doc.key] ?? LINK_DEFAULT}
                  onChange={(e) => updateDocument(doc.key, e.target.value)}
                />
              </DealField>
            ))}
          </div>

          <div className="pt-6 pb-4">
            <button
              className="cta-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Deal"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
