import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, BarChart3, LayoutList, Columns3, Building2, Handshake, CheckCircle2, Plus, FileBarChart2, CalendarIcon, ChevronDown, LayoutGrid, Check, Link as LinkIcon, ExternalLink, MapPin } from "lucide-react";
import { BarChart, Bar, LineChart, Line, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { DEAL_STATUS_ORDER } from "@/data/dealsData";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { brandDetails as baseBrandDetails, brandCategories as baseBrandCategories, type BrandDetail } from "@/data/brandsData";
import { dealRecords, dealBrands, type DealRecord } from "@/data/dealsData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createBrand } from "@/application/data/runtimeMutations";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";

/* ── GLASS CARD — matches Dashboard exactly ── */
const glassCard: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  boxShadow: "var(--shadow-card)",
  borderRadius: 16,
  overflow: "hidden",
  transition: "background 0.30s ease, border-color 0.30s ease, box-shadow 0.30s ease",
};

type BrandView = "overview" | "list" | "kanban" | "bar" | "line";
type ChartRow = Record<string, string | number | undefined>;

type ChartPayload = {
  value?: string | number | null;
  dataKey?: string | number;
  color?: string;
  payload?: ChartRow;
};

type ChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ChartPayload[];
};

type LineTooltipProps = ChartTooltipProps & {
  filtered: BrandDetail[];
};

type XAxisTickProps = {
  x?: number;
  y?: number;
  width?: number;
  payload?: { value?: string | number };
};

type RoundedBarShapeProps = React.SVGProps<SVGPathElement> & {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ChartRow;
};


// Cohesive sequential palette — orange → amber → blues → navy → green → grey
const STAGE_COLORS: Record<string, string> = {
  "Kick Off": "#E18739",                       // brand orange
  "Market Study": "#F2A65A",                   // warm amber (lighter)
  "Site Tours": "#5BA4D9",                     // sky blue
  "First LOI(s) Submitted": "#3B82F6",         // medium blue
  "LOI Negotiations": "#1E5BA8",               // deeper blue
  "Lease Negotiations": "rgba(36,60,81,0.70)", // navy 70%
  "Signed": "#059669",                         // success green
  "On Hold": "#94A3B8",                        // neutral grey
};


const STATUS_PILL_GLOBAL: Record<string, { label: string; cls: string }> = {
  "Signed": { label: "Signed", cls: "pill-signed" },
  "Lease Negotiations": { label: "Lease", cls: "pill-lease" },
  "LOI Negotiations": { label: "LOI", cls: "pill-loi" },
  "First LOI(s) Submitted": { label: "First LOI", cls: "pill-first-loi" },
  "Site Tours": { label: "Site Tours", cls: "pill-site-tours" },
  "Market Study": { label: "Market Study", cls: "pill-market-study" },
  "Kick Off": { label: "Kick Off", cls: "pill-intro-call" },
  "On Hold": { label: "On Hold", cls: "pill-on-hold" },
};

const STATUS_BAR_COLORS: Record<string, string> = {
  "Signed": "#E18739", "Lease Negotiations": "#E18739", "First LOI(s) Submitted": "#E18739",
  "Market Study": "#E18739", "Site Tours": "#E18739", "LOI Negotiations": "#E18739",
  "Kick Off": "#E18739", "On Hold": "#E18739",
};

const LINK_DEFAULT = "https://";

function parseDealDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthEnd(year: number, month: number): Date {
  const end = new Date(year, month + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end;
}

function wasDealActiveAtMonthEnd(deal: DealRecord, endOfMonth: Date): boolean {
  if (deal.isOneOff || deal.status === "On Hold") return false;
  const introDate = parseDealDate(deal.dateIntroCall);
  if (introDate && introDate > endOfMonth) return false;
  if (!introDate) {
    const now = new Date();
    if (endOfMonth.getFullYear() !== now.getFullYear() || endOfMonth.getMonth() !== now.getMonth()) return false;
  }

  const signedDate = parseDealDate(deal.dateLeaseSigned);
  return !signedDate || signedDate > endOfMonth;
}

export default function BrandsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string[]>([]);
  const [dealFilter, setDealFilter] = useState("all");
  const [view, setView] = useState<BrandView>("overview");
  const runtimeDataVersion = useRuntimeDataVersion();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", franchisorLink: LINK_DEFAULT, logoColor: "#E18739" });

  // Layout customizer state
  type PanelType = "list" | "kanban" | "bar" | "line";
  type LayoutOption =
    | { id: string; label: string; panels: [PanelType] }
    | { id: string; label: string; panels: [PanelType, PanelType] };
  const LAYOUT_OPTIONS: LayoutOption[] = [
    { id: "list", label: "List only", panels: ["list"] },
    { id: "bar", label: "Bar Chart only", panels: ["bar"] },
    { id: "line", label: "Line Chart only", panels: ["line"] },
    { id: "kanban", label: "Kanban only", panels: ["kanban"] },
    { id: "list+bar", label: "List + Bar Chart", panels: ["list", "bar"] },
    { id: "list+line", label: "List + Line Chart", panels: ["list", "line"] },
    { id: "kanban+bar", label: "Kanban + Bar Chart", panels: ["kanban", "bar"] },
    { id: "kanban+line", label: "Kanban + Line Chart", panels: ["kanban", "line"] },
  ];
  const [customLayout, setCustomLayout] = useState<LayoutOption | null>(null);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [pendingLayoutId, setPendingLayoutId] = useState<string>("list");

  const openLayoutPicker = () => {
    setPendingLayoutId(customLayout?.id ?? "list");
    setLayoutPickerOpen(true);
  };
  const applyLayout = () => {
    const next = LAYOUT_OPTIONS.find((l) => l.id === pendingLayoutId) ?? LAYOUT_OPTIONS[0];
    setCustomLayout(next);
    setLayoutPickerOpen(false);
  };

  // Report modal state
  const REPORT_SECTIONS = ["Deal Summary", "Active Pipeline", "Signed Deals", "Top Sites", "Broker Activity"];
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSections, setReportSections] = useState<string[]>(REPORT_SECTIONS);
  const [reportBrands, setReportBrands] = useState<string[]>([]);
  const [reportRange, setReportRange] = useState<DateRange | undefined>(undefined);

  const openReportModal = () => {
    setReportSections(REPORT_SECTIONS);
    setReportBrands(brandDetails.map((b) => b.id));
    setReportRange(undefined);
    setReportOpen(true);
  };

  const handleGenerateReport = () => {
    const selectedBrands = brandDetails.filter((brand) => reportBrands.includes(brand.id));
    const selectedDeals = dealRecords.filter((deal) => reportBrands.includes(deal.brandId));
    const rows = selectedBrands.map((brand) => {
      const brandDeals = selectedDeals.filter((deal) => deal.brandId === brand.id);
      return {
        brand: brand.name,
        category: brand.category,
        activeDeals: brandDeals.filter((deal) => deal.status !== "Signed" && deal.status !== "On Hold").length,
        signedDeals: brandDeals.filter((deal) => deal.status === "Signed").length,
        totalDeals: brandDeals.length,
        estimatedCommission: brandDeals.reduce((sum, deal) => sum + deal.estimatedCommission, 0),
      };
    });

    const header = ["Brand", "Category", "Active Deals", "Signed Deals", "Total Deals", "Estimated Commission"];
    const body = rows.map((row) => [row.brand, row.category, row.activeDeals, row.signedDeals, row.totalDeals, row.estimatedCommission]);
    const csv = [
      `Report Sections: ${reportSections.join(" | ")}`,
      `Report Period: ${reportRange?.from ? format(reportRange.from, "yyyy-MM-dd") : "All time"}${reportRange?.to ? ` to ${format(reportRange.to, "yyyy-MM-dd")}` : ""}`,
      "",
      header.join(","),
      ...body.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reimagine-brand-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    toast.success("Report generated", { description: `${rows.length} brand${rows.length === 1 ? "" : "s"} exported from Supabase data.` });
    setReportOpen(false);
  };

  const toggleReportSection = (s: string) =>
    setReportSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const brandDetails = useMemo(() => {
    void runtimeDataVersion;
    return [...baseBrandDetails];
  }, [runtimeDataVersion]);
  const brandCategories = useMemo(() => {
    void runtimeDataVersion;
    return Array.from(new Set([...baseBrandCategories, ...baseBrandDetails.map(b => b.category).filter(Boolean)]));
  }, [runtimeDataVersion]);

  const resetForm = () => setForm({ name: "", category: "", franchisorLink: LINK_DEFAULT, logoColor: "#E18739" });

  const handleAddBrand = async () => {
    const name = form.name.trim();
    if (!name) { toast.error("Brand name is required"); return; }
    setSavingBrand(true);
    try {
      await createBrand({
        name,
        category: form.category,
        franchisorLink: form.franchisorLink,
        logoColor: form.logoColor,
      });
      toast.success(`${name} added`);
      resetForm();
      setDrawerOpen(false);
    } catch (err) {
      toast.error("Unable to save brand", {
        description: err instanceof Error ? err.message : "Check your Supabase permissions and try again.",
      });
    } finally {
      setSavingBrand(false);
    }
  };

  const filtered = useMemo(() => {
    return brandDetails.filter((b) => {
      if (catFilter.length > 0 && !catFilter.includes(b.category)) return false;
      if (dealFilter === "active" && b.activeDeals === 0) return false;
      if (dealFilter === "none" && b.activeDeals > 0) return false;
      if (search) return b.name.toLowerCase().includes(search.toLowerCase());
      return true;
    });
  }, [search, catFilter, dealFilter, brandDetails]);

  const overviewStats = useMemo(() => {
    void runtimeDataVersion;
    const allDeals = dealRecords.filter(d => !d.isOneOff);
    return {
      totalBrands: dealBrands.length,
      activeDeals: allDeals.filter(d => d.status !== "Signed").length,
      dealsSigned: allDeals.filter(d => d.status === "Signed").length,
    };
  }, [runtimeDataVersion]);

  const brandDealCounts = useMemo(() => {
    void runtimeDataVersion;
    return dealBrands.map(b => {
      const deals = dealRecords.filter(d => d.brandId === b.id && !d.isOneOff);
      return { name: b.name, count: deals.length, color: b.logoColor, id: b.id };
    }).sort((a, b) => b.count - a.count);
  }, [runtimeDataVersion]);

  const statusCounts = useMemo(() => {
    void runtimeDataVersion;
    const allDeals = dealRecords.filter(d => !d.isOneOff);
    const counts: Record<string, number> = {};
    allDeals.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [runtimeDataVersion]);

  const maxDeals = Math.max(...brandDealCounts.map(b => b.count), 1);
  const maxStatus = Math.max(...statusCounts.map(s => s[1]), 1);

  // Chart data — bar chart: stacked by stage per (filtered) brand
  const barChartData = useMemo(() => {
    return filtered.map((b) => {
      const deals = dealRecords.filter((d) => d.brandId === b.id && !d.isOneOff);
      const row: Record<string, string | number> = { name: b.name };
      DEAL_STATUS_ORDER.forEach((s) => {
        row[s] = deals.filter((d) => d.status === s).length;
      });
      return row;
    });
  }, [filtered, runtimeDataVersion]);

  // Chart data — line chart: deals active over last 6 months per brand
  const lineChartData = useMemo(() => {
    const now = new Date();
    const months: { end: Date; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ end: monthEnd(d.getFullYear(), d.getMonth()), label: d.toLocaleString("en-US", { month: "short" }) });
    }
    return months.map((m) => {
      const row: Record<string, string | number> = { month: m.label };
      filtered.forEach((b) => {
        row[b.name] = dealRecords.filter((deal) => deal.brandId === b.id && wasDealActiveAtMonthEnd(deal, m.end)).length;
      });
      return row;
    });
  }, [filtered, runtimeDataVersion]);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${Math.round(val / 1000)}K`;
    return `$${val}`;
  };

  const openExternal = (url: string) => {
    if (!url || url === "#") {
      toast.error("No link configured for this brand");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const statCards = [
    { key: "totalBrands", label: "Total Brands", value: overviewStats.totalBrands.toString(), icon: Building2, trend: "↑ 2 this mo" },
    { key: "activeDeals", label: "Active Deals", value: overviewStats.activeDeals.toString(), icon: Handshake, trend: "↑ 5 this mo" },
    { key: "dealsSigned", label: "Deals Signed", value: overviewStats.dealsSigned.toString(), icon: CheckCircle2, trend: "↑ 3 this mo" },
  ];

  // ── Panel renderers (used by both single-view and custom split layouts) ──
  const renderListPanel = () => {
    const listGridColumns = "minmax(240px,2fr) minmax(152px,0.7fr) 72px 72px minmax(380px,2.4fr) 96px";
    const STATUS_PILL: Record<string, { label: string; cls: string }> = {
      "Signed": { label: "Signed", cls: "pill-signed" },
      "Lease Negotiations": { label: "Lease", cls: "pill-leases" },
      "LOI Negotiations": { label: "LOI Neg.", cls: "pill-loi" },
      "First LOI(s) Submitted": { label: "1st LOI", cls: "pill-loi" },
      "Market Study": { label: "Mkt Study", cls: "pill-market-study" },
      "Site Tours": { label: "Tour", cls: "pill-prop-tour" },
      "Kick Off": { label: "Intro", cls: "pill-intro-call" },
      "On Hold": { label: "On-hold", cls: "pill-on-hold" },
    };

    return (
      <div style={{ ...glassCard, padding: 0 }}>
        <div
          className="grid items-center px-4 py-3"
          style={{
            gridTemplateColumns: listGridColumns,
            gap: 24,
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          <div>Brand</div>
          <div>Category</div>
          <div className="text-right">Deals</div>
          <div className="text-right">Sites</div>
          <div>Stages</div>
          <div className="text-right">Action</div>
        </div>

        {filtered.map((brand) => {
          const deals = dealRecords.filter((d) => d.brandId === brand.id && !d.isOneOff);
          const dealCount = deals.length;
          const siteCount = deals.reduce((s, d) => s + (d.storeCount || 0), 0);
          const counts: Record<string, number> = {};
          deals.forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });
          const statusEntries = Object.entries(counts);

          return (
            <div
              key={brand.id}
              className="grid items-center px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
              style={{
                gridTemplateColumns: listGridColumns,
                gap: 24,
                borderBottom: "1px solid var(--border-subtle)",
              }}
              onClick={() => navigate(brand.internalLink)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center font-bold text-[12px] text-white shrink-0"
                  style={{ background: brand.logoColor }}
                >
                  {brand.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {brand.name}
                </div>
              </div>
              <div className="min-w-0">
                <span className="inline-flex max-w-full items-center whitespace-nowrap px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold uppercase tracking-wide pill-intro-call">
                  {brand.category}
                </span>
              </div>
              <div className="text-right text-[13px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {dealCount}
              </div>
              <div className="text-right text-[13px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {siteCount}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {statusEntries.length === 0 ? (
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>—</span>
                ) : (
                  statusEntries.map(([status, n]) => {
                    const meta = STATUS_PILL[status] || { label: status, cls: "pill-intro-call" };
                    return (
                      <span
                        key={status}
                        className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold ${meta.cls}`}
                      >
                        {meta.label} ×{n}
                      </span>
                    );
                  })
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(brand.internalLink); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold uppercase tracking-wide transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                >
                  View <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 64, textAlign: "center" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No brands match your filters.</p>
          </div>
        )}
      </div>
    );
  };

  const renderKanbanPanel = () => {
    const columns = [
      { key: "active", title: "Active Pipeline", brands: filtered.filter((brand) => brand.activeDeals > 0) },
      { key: "signed", title: "Signed", brands: filtered.filter((brand) => brand.signedDeals > 0) },
      { key: "new", title: "No Active Deals", brands: filtered.filter((brand) => brand.activeDeals === 0 && brand.signedDeals === 0) },
    ];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {columns.map((column) => (
          <div key={column.key} className="glass-card-static" style={{ borderRadius: 14, padding: 14, minHeight: 360 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Columns3 className="w-4 h-4" style={{ color: "var(--text-orange-ui)" }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{column.title}</h3>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{column.brands.length}</span>
            </div>
            <div className="space-y-3">
              {column.brands.map((brand) => {
                const brandDeals = dealRecords.filter((deal) => deal.brandId === brand.id && !deal.isOneOff);
                const statuses = Array.from(new Set(brandDeals.map((deal) => deal.status)));
                return (
                  <button key={brand.id} onClick={() => navigate(brand.internalLink)} className="w-full text-left transition-all hover:-translate-y-px" style={{ ...glassCard, borderRadius: 12, padding: 14 }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{brand.name}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{brand.category}</p>
                      </div>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: brand.logoColor, flexShrink: 0 }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {statuses.length === 0 ? (
                        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No deals</span>
                      ) : (
                        statuses.map((status) => {
                          const meta = STATUS_PILL_GLOBAL[status] || { label: status, cls: "pill-intro-call" };
                          return <span key={status} className={`inline-flex items-center px-2 py-0.5 rounded-[20px] text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>;
                        })
                      )}
                    </div>
                  </button>
                );
              })}
              {column.brands.length === 0 && (
                <div className="rounded-[10px] p-8 text-center text-xs" style={{ border: "1px dashed var(--border-divider)", color: "var(--text-muted)" }}>No brands in this lane.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderChartPanel = (chartView: "bar" | "line", inSplit = false) => {
    if (filtered.length === 0) {
      return (
        <div style={{ padding: 64, textAlign: "center" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No data — all brands are filtered out.</p>
        </div>
      );
    }
    const legendItems = chartView === "bar"
      ? DEAL_STATUS_ORDER.map((s) => ({ label: s, color: STAGE_COLORS[s] }))
      : filtered.map((b) => ({ label: b.name, color: b.logoColor }));

    return (
      <div
        style={{
          background: "transparent",
          padding: inSplit ? "0 0 0 24px" : 0,
          position: "relative",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            {chartView === "bar" ? "Deals by Stage per Brand" : "Active Deals — Last 6 Months"}
          </span>
        </div>
        <div className="flex" style={{ gap: 24, alignItems: "stretch" }}>
          <div style={{ flex: 1, minWidth: 0, height: 480, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartView === "bar" ? (
                <BarChart data={barChartData} margin={{ top: 16, right: 8, bottom: 8, left: 0 }} barCategoryGap="48%">
                  <CartesianGrid strokeDasharray="2 6" stroke="var(--border-divider)" strokeOpacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={<TruncatedXAxisTick />}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border-divider)" }}
                    interval={0}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <RTooltip cursor={{ fill: "rgba(225,135,57,0.06)", radius: 8 }} content={<StageTooltip />} />
                  {DEAL_STATUS_ORDER.map((stage) => (
                    <Bar
                      key={stage}
                      dataKey={stage}
                      stackId="stages"
                      fill={STAGE_COLORS[stage]}
                      maxBarSize={32}
                      shape={(props: unknown) => {
                        const barProps = props as RoundedBarShapeProps;
                        const x = Number(barProps.x ?? 0);
                        const y = Number(barProps.y ?? 0);
                        const width = Number(barProps.width ?? 0);
                        const height = Number(barProps.height ?? 0);
                        const payload = barProps.payload;
                        if (height <= 0) return <g />;
                        let topStage: string | null = null;
                        for (let i = DEAL_STATUS_ORDER.length - 1; i >= 0; i--) {
                          const stageCount = Number(payload?.[DEAL_STATUS_ORDER[i]] ?? 0);
                          if (stageCount > 0) {
                            topStage = DEAL_STATUS_ORDER[i];
                            break;
                          }
                        }
                        const isTop = topStage === stage;
                        const r = isTop ? Math.min(4, width / 2, height) : 0;
                        const path = isTop
                          ? `M${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} L${x},${y + height} Z`
                          : `M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`;
                        return <path d={path} fill={STAGE_COLORS[stage]} />;
                      }}
                    />
                  ))}
                </BarChart>
              ) : (
                <ComposedChart data={lineChartData} margin={{ top: 16, right: 8, bottom: 8, left: 0 }}>
                  <defs>
                    {filtered.map((b) => (
                      <linearGradient key={b.id} id={`lineFill-${b.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={b.logoColor} stopOpacity={0.16} />
                        <stop offset="100%" stopColor={b.logoColor} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="var(--border-divider)" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: "var(--border-divider)" }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <RTooltip content={<LineTooltip filtered={filtered} />} />
                  {filtered.map((b) => (
                    <Area key={`area-${b.id}`} type="monotone" dataKey={b.name} stroke="none" fill={`url(#lineFill-${b.id})`} fillOpacity={1} isAnimationActive={false} />
                  ))}
                  {filtered.map((b) => (
                    <Line
                      key={b.id}
                      type="monotone"
                      dataKey={b.name}
                      stroke={b.logoColor}
                      strokeWidth={2}
                      dot={{ r: 4, fill: b.logoColor, stroke: "var(--bg-surface)", strokeWidth: 2 }}
                      activeDot={{ r: 6, stroke: "var(--bg-surface)", strokeWidth: 2, fill: b.logoColor }}
                    />
                  ))}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
          {/* Side legend */}
          <div className="hidden md:flex flex-col" style={{ gap: 24, minWidth: 160, paddingTop: 16 }}>
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center" style={{ gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Mobile fallback legend — single row, horizontal scroll */}
        <div className="flex md:hidden items-center" style={{ gap: 16, marginTop: 16, overflowX: "auto", paddingBottom: 4 }}>
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center shrink-0" style={{ gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPanel = (p: PanelType, inSplit = false) => {
    if (p === "list") return renderListPanel();
    if (p === "kanban") return renderKanbanPanel();
    return renderChartPanel(p, inSplit);
  };


  return (
    <div className="animate-fade-in dark:!bg-transparent">
    <div className="p-4 md:p-7" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: -4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Brands
        </h1>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>
            {filtered.length} client brand{filtered.length !== 1 ? "s" : ""}
          </span>
          {!customLayout && (view === "list" || view === "kanban") && (
            <button
              onClick={openReportModal}
              className="flex items-center transition-all"
              style={{
                gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: "var(--bg-surface)", color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)", cursor: "pointer",
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
            >
              <FileBarChart2 className="w-4 h-4" />
              Report
            </button>
          )}
          <button
            onClick={openLayoutPicker}
            className="flex items-center transition-all"
            style={{
              gap: 8, padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: customLayout ? "var(--view-toggle-active-bg)" : "var(--bg-surface)",
              color: customLayout ? "var(--view-toggle-active-color)" : "var(--text-primary)",
              border: customLayout ? "none" : "1px solid var(--border-subtle)",
              cursor: "pointer",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          >
            <LayoutGrid className="w-4 h-4" />
            Change Layout
          </button>

          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center transition-all"
            style={{
              gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: "#243c51", color: "white", border: "none", cursor: "pointer",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          >
            <Plus className="w-4 h-4" />
            Add Brand
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: "overview" as const, icon: BarChart3, label: "Overview" },
          { key: "list" as const, icon: LayoutList, label: "List" },
          { key: "kanban" as const, icon: Columns3, label: "Kanban" },
        ]).map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className="flex items-center gap-2 transition-all"
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500,
              cursor: "pointer",
              ...(view === v.key
                ? { background: "var(--view-toggle-active-bg)", color: "var(--view-toggle-active-color)", boxShadow: "0 2px 8px rgba(36,60,81,0.20)" }
                : { background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }
              ),
            }}
          >
            <v.icon className="w-4 h-4" />
            {v.label}

          </button>
        ))}
        {/* Charts dropdown tab */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 transition-all"
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer",
                ...((view === "bar" || view === "line")
                  ? { background: "var(--view-toggle-active-bg)", color: "var(--view-toggle-active-color)", boxShadow: "0 2px 8px rgba(36,60,81,0.20)" }
                  : { background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }),
              }}
            >
              <BarChart3 className="w-4 h-4" />
              {view === "bar" ? "Charts: Bar" : view === "line" ? "Charts: Line" : "Charts"}
              <ChevronDown className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8}>
            <DropdownMenuItem onClick={() => setView("bar")} className="cursor-pointer">
              Bar Chart
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("line")} className="cursor-pointer">
              Line Chart
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ═══ CUSTOM LAYOUT (split panels) ═══ */}
      {customLayout && (
        <div
          className="grid grid-cols-1 lg:grid-cols-2"
          style={{
            gap: 0,
            ...(customLayout.panels.length === 1 ? { gridTemplateColumns: "1fr" } : {}),
          }}
        >
          {customLayout.panels.map((p, i) => {
            const isLeft = i === 0 && customLayout.panels.length === 2;
            const isRight = i === 1;
            return (
              <div
                key={`${p}-${i}`}
                style={{
                  minWidth: 0,
                  maxHeight: "calc(100vh - 240px)",
                  overflowY: "auto",
                  paddingRight: isLeft ? 24 : 0,
                  paddingLeft: isRight ? 0 : 0,
                  borderRight: isLeft ? "1px solid var(--border-divider)" : "none",
                }}
              >
                {renderPanel(p, customLayout.panels.length === 2)}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ OVERVIEW VIEW — brand cards grid only ═══ */}
      {!customLayout && view === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 16, alignItems: "start" }}>
          {brandDetails.map((brand) => {
            const deals = dealRecords.filter((d) => d.brandId === brand.id && !d.isOneOff);
            const dealCount = deals.length;
            const siteCount = deals.reduce((s, d) => s + (d.storeCount || 0), 0);
            const STATUS_PILL: Record<string, { label: string; cls: string }> = {
              "Signed": { label: "Signed", cls: "pill-signed" },
              "Lease Negotiations": { label: "Lease", cls: "pill-leases" },
              "LOI Negotiations": { label: "LOI", cls: "pill-loi" },
              "First LOI(s) Submitted": { label: "LOI", cls: "pill-loi" },
              "Market Study": { label: "Mkt Study", cls: "pill-market-study" },
              "Site Tours": { label: "Tour", cls: "pill-prop-tour" },
              "Kick Off": { label: "Intro", cls: "pill-intro-call" },
              "On Hold": { label: "On-hold", cls: "pill-on-hold" },
            };
            const counts: Record<string, number> = {};
            deals.forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });
            const statusEntries = Object.entries(counts);

            return (
              <div
                key={brand.id}
                className="relative cursor-pointer transition-all duration-200 hover:-translate-y-px"
                style={{ ...glassCard, padding: 20 }}
                onClick={() => navigate(brand.internalLink)}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-[40px] h-[40px] rounded-[8px] flex items-center justify-center font-bold text-[13px] text-white shrink-0"
                    style={{ background: brand.logoColor }}
                  >
                    {brand.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-bold truncate" style={{ color: "var(--text-primary)" }}>{brand.name}</h3>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {dealCount} deal{dealCount !== 1 ? "s" : ""} · {siteCount} site{siteCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[20px] text-[11px] font-semibold uppercase tracking-wide pill-intro-call shrink-0">
                    {brand.category}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {statusEntries.length === 0 ? (
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No deals yet</span>
                  ) : (
                    statusEntries.map(([status, n]) => {
                      const meta = STATUS_PILL[status] || { label: status, cls: "pill-intro-call" };
                      return (
                        <span key={status} className={`inline-flex items-center px-2 py-0.5 rounded-[20px] text-[12px] font-semibold ${meta.cls}`}>
                          {meta.label} ×{n}
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(brand.internalLink); }}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
                    aria-label={`Open ${brand.name} deals`}
                    title="Open deals"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openExternal(brand.franchisorLink); }}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
                    aria-label={`Open ${brand.name} franchisor link`}
                    title="Open franchisor link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(brand.mapLink); }}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
                    aria-label={`Open ${brand.name} map`}
                    title="Open map"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); navigate(brand.internalLink); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[9px] text-xs font-semibold uppercase tracking-wide transition-all group/btn"
                  style={{ border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                >
                  View Deals <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>
            );
          })}

          {/* + Add Brand slot */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center transition-all hover:-translate-y-px"
            style={{
              ...glassCard,
              padding: 20,
              minHeight: 168,
              cursor: "pointer",
              borderStyle: "dashed",
              color: "var(--text-muted)",
              gap: 8,
            }}
          >
            <Plus className="w-6 h-6" />
            <span className="text-[13px] font-semibold uppercase tracking-wide">Add Brand</span>
          </button>
        </div>
      )}

      {/* ═══ LIST VIEW ═══ */}
      {!customLayout && view === "list" && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 mb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
              <input
                type="text" placeholder="Search brands..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="glass-input pl-9 pr-4 py-2 text-sm w-56"
              />
            </div>
            <MultiSelectFilter
              label="Category"
              value={catFilter}
              onChange={setCatFilter}
              options={brandCategories.map((c) => ({ value: c, label: c }))}
            />
            <Select value={dealFilter} onValueChange={setDealFilter}>
              <SelectTrigger className="w-44 glass-input"><SelectValue placeholder="All Deal Counts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                <SelectItem value="active">Has Active Deals</SelectItem>
                <SelectItem value="none">No Active Deals</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderListPanel()}
        </>
      )}

      {/* ═══ CHART VIEWS (Bar / Line) ═══ */}
      {!customLayout && (view === "bar" || view === "line") && (
        <>
          {/* Filters — visible but disabled with tooltip */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 mb-2"
                  style={{ opacity: 0.55, cursor: "not-allowed" }}
                  onClick={(e) => e.preventDefault()}
                >
                  <div className="relative" style={{ pointerEvents: "none" }}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
                    <input type="text" placeholder="Search brands..." disabled className="glass-input pl-9 pr-4 py-2 text-sm w-56" />
                  </div>
                  <div style={{ pointerEvents: "none" }}>
                    <MultiSelectFilter label="Category" value={catFilter} onChange={() => {}} options={brandCategories.map((c) => ({ value: c, label: c }))} />
                  </div>
                  <div style={{ pointerEvents: "none" }}>
                    <Select value={dealFilter}>
                      <SelectTrigger className="w-44 glass-input"><SelectValue placeholder="All Deal Counts" /></SelectTrigger>
                    </Select>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>Chart view does not support filtering</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {renderChartPanel(view as "bar" | "line")}
        </>
      )}

      {/* ═══ KANBAN VIEW ═══ */}
      {!customLayout && view === "kanban" && renderKanbanPanel()}
    </div>

    <Sheet open={drawerOpen} onOpenChange={(o) => { setDrawerOpen(o); if (!o) resetForm(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Brand</SheetTitle>
          <SheetDescription>Create a new client brand. You can add deals to it afterward.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 mt-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-name">Brand Name<span style={{ color: "#dc2626" }}> *</span></Label>
            <Input id="brand-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Reimagine Coffee" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-category">Category</Label>
            <Input id="brand-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. F&B, Fitness, Retail" list="brand-cat-suggestions" />
            <datalist id="brand-cat-suggestions">
              {baseBrandCategories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-link">Franchisor Link</Label>
            <Input id="brand-link" type="url" value={form.franchisorLink} onChange={(e) => setForm({ ...form, franchisorLink: e.target.value })} placeholder="https://..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-color">Brand Color</Label>
            <div className="flex items-center gap-3">
              <input id="brand-color" type="color" value={form.logoColor} onChange={(e) => setForm({ ...form, logoColor: e.target.value })} style={{ width: 44, height: 38, border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer", background: "transparent" }} />
              <Input value={form.logoColor} onChange={(e) => setForm({ ...form, logoColor: e.target.value })} placeholder="#E18739" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={() => setDrawerOpen(false)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
              Cancel
            </button>
            <button disabled={savingBrand} onClick={handleAddBrand} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#243c51", color: "white", border: "none", cursor: savingBrand ? "not-allowed" : "pointer", opacity: savingBrand ? 0.65 : 1 }}>
              {savingBrand ? "Saving..." : "Add Brand"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    {/* Generate Report Modal */}
    <Dialog open={reportOpen} onOpenChange={setReportOpen}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>Select what to include in your brand report.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col" style={{ gap: 24, marginTop: 8 }}>
          {/* Sections */}
          <div className="flex flex-col" style={{ gap: 12 }}>
            <Label style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Report Sections
            </Label>
            <div className="flex flex-col" style={{ gap: 8 }}>
              {REPORT_SECTIONS.map((s) => {
                const checked = reportSections.includes(s);
                return (
                  <label key={s} className="flex items-center cursor-pointer" style={{ gap: 24, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleReportSection(s)} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{s}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Brands multi-select */}
          <div className="flex flex-col" style={{ gap: 8 }}>
            <Label style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Select Brands
            </Label>
            <MultiSelectFilter
              label="Brands"
              value={reportBrands}
              onChange={setReportBrands}
              options={brandDetails.map((b) => ({ value: b.id, label: b.name }))}
            />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {reportBrands.length === brandDetails.length ? "All brands selected" : `${reportBrands.length} of ${brandDetails.length} selected`}
            </span>
          </div>

          {/* Date range */}
          <div className="flex flex-col" style={{ gap: 8 }}>
            <Label style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Report Period
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between glass-input"
                  style={{ height: 36, padding: "0 12px", borderRadius: 12, fontSize: 12, fontWeight: 500, color: "var(--text-primary)", gap: 8 }}
                >
                  <span>
                    {reportRange?.from
                      ? reportRange.to
                        ? `${format(reportRange.from, "MMM d, yyyy")} – ${format(reportRange.to, "MMM d, yyyy")}`
                        : format(reportRange.from, "MMM d, yyyy")
                      : "Pick a date range"}
                  </span>
                  <CalendarIcon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={reportRange}
                  onSelect={setReportRange}
                  numberOfMonths={2}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Footer */}
          <div className="flex items-center" style={{ gap: 8, marginTop: 8 }}>
            <button onClick={() => setReportOpen(false)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handleGenerateReport} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#243c51", color: "white", border: "none", cursor: "pointer" }}>
              Generate
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Layout Picker Modal */}
    <Dialog open={layoutPickerOpen} onOpenChange={setLayoutPickerOpen}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize View</DialogTitle>
          <DialogDescription>Choose how you want to view your brands.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col" style={{ gap: 24, marginTop: 8 }}>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12 }}>
            {LAYOUT_OPTIONS.map((opt) => {
              const isActive = pendingLayoutId === opt.id;
              const split = opt.panels.length === 2;
              return (
                <button
                  key={opt.id}
                  onClick={() => setPendingLayoutId(opt.id)}
                  className="flex flex-col items-center transition-all"
                  style={{
                    gap: 8,
                    padding: 12,
                    borderRadius: 12,
                    cursor: "pointer",
                    background: isActive ? "rgba(225,135,57,0.08)" : "var(--bg-surface)",
                    border: isActive ? "1px solid #E18739" : "1px solid var(--border-subtle)",
                    boxShadow: isActive ? "0 2px 8px rgba(225,135,57,0.18)" : "none",
                    position: "relative",
                  }}
                >
                  {isActive && (
                    <span
                      style={{
                        position: "absolute", top: 8, right: 8,
                        width: 16, height: 16, borderRadius: "50%",
                        background: "#E18739", color: "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  {/* Diagram */}
                  <div
                    aria-hidden
                    style={{
                      width: "100%",
                      height: 64,
                      borderRadius: 8,
                      background: "var(--bg-nav-active)",
                      display: "flex",
                      gap: 4,
                      padding: 8,
                    }}
                  >
                    {split ? (
                      <>
                        <div style={{ flex: 1, borderRadius: 4, background: panelTone(opt.panels[0]) }} />
                        <div style={{ flex: 1, borderRadius: 4, background: panelTone(opt.panels.length > 1 ? opt.panels[1]! : opt.panels[0]) }} />
                      </>
                    ) : (
                      <div style={{ flex: 1, borderRadius: 4, background: panelTone(opt.panels[0]) }} />
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textAlign: "center" }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center" style={{ gap: 8, marginTop: 8 }}>
            {customLayout && (
              <button
                onClick={() => { setCustomLayout(null); setLayoutPickerOpen(false); }}
                style={{ padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}
              >
                Reset
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setLayoutPickerOpen(false)}
              style={{ padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={applyLayout}
              style={{ padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#243c51", color: "white", border: "none", cursor: "pointer" }}
            >
              Apply
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}

function panelTone(p: "list" | "kanban" | "bar" | "line"): string {
  switch (p) {
    case "list": return "rgba(36,60,81,0.55)";
    case "kanban": return "rgba(36,60,81,0.40)";
    case "bar": return "rgba(225,135,57,0.65)";
    case "line": return "rgba(225,135,57,0.45)";
  }
}


/* ── X-axis tick that truncates long brand names with ellipsis (no wrapping) ── */
function TruncatedXAxisTick(props: XAxisTickProps) {
  const { x = 0, y = 0, payload, width } = props;
  const label = String(payload?.value ?? "");
  // Approx 7px per char at 12px font. Use width hint from chart, fallback 80.
  const max = Math.max(6, Math.floor((width ?? 80) / 7));
  const text = label.length > max ? label.slice(0, max - 1).trimEnd() + "…" : label;
  return (
    <g transform={`translate(${x},${y + 16})`}>
      <text textAnchor="middle" fill="var(--text-secondary)" fontSize={12} fontWeight={600}>
        {text}
      </text>
    </g>
  );
}

/* ── Custom stacked-bar tooltip: brand header + stage rows with dot/name/count ── */
function StageTooltip(props: ChartTooltipProps) {
  if (!props.active || !props.payload?.length) return null;
  const brandName = String(props.label ?? "");
  // Use the underlying row to render in DEAL_STATUS_ORDER, dropping zero values
  const row = props.payload[0]?.payload ?? {};
  const rows = (DEAL_STATUS_ORDER as readonly string[])
    .filter((stage) => Number(row[stage] ?? 0) > 0)
    .map((stage) => ({ name: stage, value: Number(row[stage] ?? 0), color: STAGE_COLORS[stage] }));
  if (rows.length === 0) return null;
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        padding: 12,
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {brandName}
      </div>
      <div style={{ height: 1, background: "var(--border-divider)", marginBottom: 8 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{r.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Custom line tooltip: month header + brand rows ── */
function LineTooltip(props: LineTooltipProps) {
  if (!props.active || !props.payload?.length) return null;
  const month = String(props.label ?? "");
  const rows = props.payload
    .filter((point) => Number(point.value ?? 0) > 0)
    .map((point) => {
      const dataKey = String(point.dataKey ?? "");
      const brand = props.filtered.find((b) => b.name === dataKey);
      return { name: dataKey, value: Number(point.value ?? 0), color: brand?.logoColor ?? point.color ?? "var(--text-muted)" };
    });
  if (rows.length === 0) return null;
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        padding: 12,
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        {month}
      </div>
      <div style={{ height: 1, background: "var(--border-divider)", marginBottom: 8 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{r.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
