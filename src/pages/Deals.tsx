import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  dealRecords, dealBrands, getDealBrandById, getUniqueBrokers, getUniqueStates,
  emptyDealDocuments, DealStatusNew, KANBAN_COLUMNS, daysActive, DealRecord, DealDocuments,
} from "@/data/dealsData";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { DealHealthIndicator } from "@/components/DealHealthIndicator";
import { StageTimingBadge } from "@/components/StageTimingBadge";
import { BrandAvatar } from "@/components/BrandAvatar";
import {
  Search, LayoutList, Columns3, Map, Plus, ChevronRight, FileText, MoreHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserRole, canEditDeal, canViewFinancials } from "@/hooks/useUserRole";
import { createDeal, updateDeal } from "@/application/data/runtimeMutations";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { toast } from "sonner";

type ViewMode = "table" | "kanban" | "map";

const ALL_STATUSES: DealStatusNew[] = ["Signed", "Lease Negotiations", "LOI Negotiations", "First LOI(s) Submitted", "Site Tours", "Market Study", "Kick Off", "On Hold"];

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
}

export default function DealsPage({ brandFilter, isOneOff, onAddDeal }: DealsPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialView = (searchParams.get("view") as ViewMode) || "table";
  const [view, setView] = useState<ViewMode>(["table", "kanban", "map"].includes(initialView) ? initialView : "table");
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
  const allowEdit = canEditDeal(role);
  const showFinancials = canViewFinancials(role);

  const baseDeals = useMemo(() => {
    void runtimeDataVersion;
    let d = dealRecords;
    if (isOneOff) d = d.filter((x) => x.isOneOff);
    else if (brandFilter) d = d.filter((x) => x.brandId === brandFilter && !x.isOneOff);
    else d = d.filter((x) => !x.isOneOff);
    return d;
  }, [brandFilter, isOneOff, runtimeDataVersion]);

  const filtered = useMemo(() => {
    let d = baseDeals;
    if (search) {
      const q = search.toLowerCase();
      d = d.filter((x) =>
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
          <div className="flex p-0.5 rounded-[11px]" style={{ background: "var(--view-toggle-bg)", border: "1px solid var(--border-subtle)" }}>
            {([["table", LayoutList], ["kanban", Columns3], ["map", Map]] as const).map(([m, Icon]) => (
              <button
                key={m}
                onClick={() => setView(m)}
                className="p-2 rounded-[9px] transition-colors"
                style={view === m ? { background: "var(--view-toggle-active-bg)", color: "var(--view-toggle-active-color)" } : { color: "#94a3b8" }}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
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
            options={dealBrands.map((b) => ({ value: b.id, label: b.name }))}
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
          options={getUniqueBrokers().map((b) => ({ value: b, label: b }))}
        />
        <MultiSelectFilter
          label="State"
          value={stateFilter}
          onChange={setStateFilter}
          options={getUniqueStates().map((s) => ({ value: s, label: s }))}
        />
      </div>

      {/* Table View */}
      {view === "table" && <DealsTable deals={filtered} navigate={navigate} setEditingDeal={setEditingDeal} setShowDrawer={setShowDrawer} />}

      {/* Kanban View */}
      {view === "kanban" && (
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
                        <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>{deal.franchisee}</p>
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

      {/* Map View Placeholder */}
      {view === "map" && (
        <div className="glass-card-static p-16 text-center">
          <Map className="w-10 h-10 mx-auto mb-3" style={{ color: "#b8c5d0" }} />
          <p className="text-sm font-medium" style={{ color: "#4a5568" }}>Map view coming soon</p>
          <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>Deal locations will be plotted on an interactive map.</p>
        </div>
      )}

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

// ===== DEALS TABLE =====
const ROWS_PER_PAGE = 10;

function DealsTable({ deals, navigate, setEditingDeal, setShowDrawer }: {
  deals: DealRecord[];
  navigate: (path: string) => void;
  setEditingDeal: (d: DealRecord | null) => void;
  setShowDrawer: (v: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(deals.length / ROWS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [deals.length]);

  const safePage = Math.min(page, Math.max(totalPages, 1));
  const paginated = deals.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

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
                    {deal.franchisee}
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
                        <DropdownMenuItem onClick={() => { setEditingDeal(deal); setShowDrawer(true); }}>Edit</DropdownMenuItem>
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
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--border-divider)" }}>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            Showing {(safePage - 1) * ROWS_PER_PAGE + 1}–{Math.min(safePage * ROWS_PER_PAGE, deals.length)} of {deals.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="px-2 py-1 rounded text-xs transition-colors"
              style={{ color: safePage <= 1 ? "var(--text-faint)" : "var(--text-secondary)", cursor: safePage <= 1 ? "default" : "pointer" }}
            >···</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="w-8 h-8 rounded-[8px] text-xs font-semibold transition-colors"
                style={p === safePage
                  ? { background: "#243c51", color: "#fff" }
                  : { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-divider)" }
                }
              >{p}</button>
            ))}
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="px-2 py-1 rounded text-xs transition-colors"
              style={{ color: safePage >= totalPages ? "var(--text-faint)" : "var(--text-secondary)", cursor: safePage >= totalPages ? "default" : "pointer" }}
            >···</button>
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
