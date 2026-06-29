import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useSyncExternalStore, useMemo } from "react";
import { getDealBrandById, getDealRecordsByBrand, DEAL_STATUS_ORDER, daysActive, type DealRecord } from "@/data/dealsData";
import DealsPage from "./Deals";
import { ArrowLeft, Send, Handshake, Briefcase, CheckCircle2 } from "lucide-react";
import { TakeActionDrawer, type TakeActionSubmission } from "@/components/deal/TakeActionDrawer";
import { ActionItemsPanel } from "@/components/ActionItemsPanel";
import { brandActionStore, type BrandActionItem } from "@/lib/brandActionStore";
import { canAccessBrand, useCurrentProfile, useScopedUser, useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";

const STAGE_DOT_COLORS: Record<string, string> = {
  "Kick Off": "#E18739",
  "Market Study": "#F2A65A",
  "Site Tours": "#5BA4D9",
  "First LOI(s) Submitted": "#3B82F6",
  "LOI Negotiations": "#1E5BA8",
  "Lease Negotiations": "rgba(36,60,81,0.70)",
  "Signed": "#059669",
  "On Hold": "#94A3B8",
};

const glassCard: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  boxShadow: "var(--shadow-card)",
  borderRadius: 16,
  overflow: "hidden",
};
const EMPTY_ACTION_ITEMS: BrandActionItem[] = [];

export default function BrandDeals() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const runtimeDataVersion = useRuntimeDataVersion();
  const user = useScopedUser();
  const profile = useCurrentProfile();
  const role = useUserRole();
  const brand = useMemo(() => getDealBrandById(brandId || ""), [brandId, runtimeDataVersion]);
  const deals = useMemo(
    () => getDealRecordsByBrand(brandId || "").filter((d) => !d.isOneOff && canAccessBrand(user ?? role, d.brandId)),
    [brandId, runtimeDataVersion, role, user],
  );

  // Subscribe to brand action store
  const items = useSyncExternalStore(
    (cb) => brandActionStore.subscribe(cb),
    () => brandActionStore.getByBrand(brandId || ""),
    () => EMPTY_ACTION_ITEMS,
  );
  const openCount = items.filter((i) => i.status === "pending").length;

  const [actionPanelOpen, setActionPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [, setDealVersion] = useState(0);
  const takeActionLabel = role === "deal" ? "Request from Reimagine" : "Take Action";

  useEffect(() => {
    if (!brandId) return;
    if (!canAccessBrand(user ?? role, brandId)) return;
    void brandActionStore.loadByBrand(brandId).catch((err) => {
      toast.error("Unable to load action items", {
        description: err instanceof Error ? err.message : "Check Supabase schema and permissions.",
      });
    });
  }, [brandId, role, user]);

  const signed = deals.filter((d) => d.status === "Signed").length;
  const inProgress = deals.filter((d) => d.status !== "Signed" && d.status !== "On Hold").length;
  const onHold = deals.filter((d) => d.status === "On Hold").length;

  if (!brand) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: "#94a3b8" }}>Brand not found.</p>
        <button onClick={() => navigate("/brands")} className="mt-4 text-sm font-semibold" style={{ color: "#E18739" }}>Back to Brands</button>
      </div>
    );
  }

  if (!canAccessBrand(user ?? role, brand.id)) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: "var(--text-muted)" }}>You do not have access to this brand.</p>
        <button onClick={() => navigate("/brand")} className="mt-4 text-sm font-semibold" style={{ color: "#E18739" }}>Back to Brand View</button>
      </div>
    );
  }

  const handleSubmit = async (data: TakeActionSubmission) => {
    try {
      if (!profile) throw new Error("Current user profile is required.");
      await brandActionStore.add({
        brandId: brand.id,
        actionTypeKey: data.actionTypeKey,
        actionTypeLabel: data.actionTypeLabel,
        recipients: data.recipients,
        message: data.message,
        urgency: data.urgency,
        requestedBy: profile?.email || profile?.fullName || profile?.username || "Unknown",
      });
    } catch (err) {
      toast.error("Unable to save action item", {
        description: err instanceof Error ? err.message : "Check Supabase schema and permissions.",
      });
      throw err;
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="p-6 lg:p-8 pb-0 max-w-[1600px] mx-auto">
        <button onClick={() => navigate("/brands")} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors mb-4" style={{ color: "#94a3b8" }}>
          <ArrowLeft className="w-4 h-4" /> Brands
        </button>
        <div className="glass-card-static p-5 flex items-center gap-5 mb-2">
          <div className="w-14 h-14 rounded-[11px] flex items-center justify-center text-xl font-bold text-white shrink-0" style={{ backgroundColor: brand.logoColor, boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }}>
            {brand.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{brand.name}</h2>
            <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{brand.category} · <a href={brand.corporateLink} target="_blank" rel="noopener" style={{ color: "#E18739" }}>{brand.corporateLink}</a></p>
          </div>
          <div className="flex items-center" style={{ gap: 24 }}>
            {[
              { value: signed, label: "Signed", color: "#059669" },
              { value: inProgress, label: "In Progress", color: "#3b82f6" },
              { value: onHold, label: "On Hold", color: "#E18739" },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
                <p className="section-label">{m.label}</p>
              </div>
            ))}
            {/* Action Items stat (clickable) */}
            <button
              type="button"
              onClick={() => setActionPanelOpen(true)}
              className="text-center transition-all"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 8,
              }}
              aria-label={`${openCount} open action items`}
            >
              <p className="text-lg font-bold" style={{ color: openCount > 0 ? "#E18739" : "var(--text-muted)" }}>
                {openCount}
              </p>
              <p className="section-label">Action Items</p>
            </button>

            {/* Take Action button */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="cta-primary flex items-center"
              style={{ gap: 8 }}
            >
              <Send className="w-3.5 h-3.5" />
              {takeActionLabel}
            </button>
          </div>
        </div>
      </div>

      {/* ── Brand metrics ── */}
      <BrandMetricsSection deals={deals} />

      <DealsPage brandFilter={brandId} onAddDeal={() => setDealVersion((version) => version + 1)} />

      {/* Take Action drawer at brand level */}
      <TakeActionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dealName={brand.name}
        broker=""
        onSubmit={handleSubmit}
      />

      {/* Action Items slide-over panel */}
      <ActionItemsPanel
        open={actionPanelOpen}
        onClose={() => setActionPanelOpen(false)}
        items={items}
        contextLabel={brand.name}
        enableDealLinks
        resolveDealHref={(dealName) => {
          const match = deals.find(
            (d) => dealName.includes(d.franchisee) || dealName.includes(d.city),
          );
          return match ? `/deals/${match.id}` : null;
        }}
      />
    </div>
  );
}

function BrandMetricsSection({ deals }: { deals: DealRecord[] }) {
  const totals = useMemo(() => {
    const total = deals.length;
    const signed = deals.filter((d) => d.status === "Signed").length;
    const onHold = deals.filter((d) => d.status === "On Hold").length;
    const active = total - signed - onHold;
    return { total, active, signed };
  }, [deals]);

  const pipeline = useMemo(() => {
    const counts: Record<string, number> = {};
    deals.forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });
    return DEAL_STATUS_ORDER
      .map((s) => ({ stage: s, count: counts[s] || 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [deals]);

  const maxStage = Math.max(1, ...pipeline.map((p) => p.count));

  const avgPerStage = useMemo(() => {
    const buckets: Record<string, number[]> = {};
    deals.forEach((d) => {
      const days = daysActive(d);
      if (!Number.isFinite(days)) return;
      (buckets[d.status] ||= []).push(days);
    });
    return DEAL_STATUS_ORDER
      .filter((s) => buckets[s] && buckets[s].length > 0)
      .map((s) => ({
        stage: s,
        avg: Math.round(buckets[s].reduce((a, b) => a + b, 0) / buckets[s].length),
      }));
  }, [deals]);

  const kpis = [
    { key: "total", label: "Total Deals", value: totals.total, trend: `↑ ${Math.max(1, Math.round(totals.total / 3))} this mo`, Icon: Briefcase },
    { key: "active", label: "Active Deals", value: totals.active, trend: `↑ ${Math.max(1, Math.round(totals.active / 2))} this mo`, Icon: Handshake },
    { key: "signed", label: "Deals Signed", value: totals.signed, trend: `↑ ${Math.max(0, totals.signed)} this mo`, Icon: CheckCircle2 },
  ];

  return (
    <div className="px-6 lg:px-8 max-w-[1600px] mx-auto" style={{ marginTop: 16 }}>
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 16, marginBottom: 16 }}>
        {kpis.map(({ key, label, value, trend, Icon }) => (
          <div
            key={key}
            style={{
              background: "var(--stat-card-bg)",
              border: "0.56px solid var(--stat-card-border)",
              borderRadius: 14,
              padding: 20,
              minHeight: 110,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between">
              <div style={{ color: "#E18739" }}><Icon className="w-4 h-4" /></div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--stat-value-color)" }}>{trend}</span>
            </div>
            <p style={{ fontSize: 32, fontWeight: 800, color: "var(--stat-value-color)", letterSpacing: "-0.03em", lineHeight: 1, marginTop: 8 }}>{value}</p>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 8 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Two charts */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16, marginBottom: 24 }}>
        {/* Pipeline overview */}
        <div style={{ ...glassCard, padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-divider)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>Pipeline Overview</span>
          </div>
          <div style={{ padding: "16px 20px" }} className="flex flex-col gap-3">
            {pipeline.length === 0 ? (
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No deals yet</span>
            ) : pipeline.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", minWidth: 160, flexShrink: 0 }}>{stage}</span>
                <div className="flex-1" style={{ height: 6, borderRadius: 3, background: "var(--bg-nav-active)" }}>
                  <div style={{ height: 6, borderRadius: 3, background: STAGE_DOT_COLORS[stage] || "#94a3b8", width: `${(count / maxStage) * 100}%` }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--stat-value-color)", minWidth: 24, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Avg days per stage */}
        <div style={{ ...glassCard, padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-divider)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>Avg. Days per Stage</span>
          </div>
          <div style={{ padding: "16px 20px" }} className="flex flex-col gap-3">
            {avgPerStage.length === 0 ? (
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No data</span>
            ) : avgPerStage.map(({ stage, avg }) => (
              <div key={stage} className="flex items-center gap-3">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STAGE_DOT_COLORS[stage] || "#94a3b8", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", flex: 1 }}>{stage}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--stat-value-color)" }}>{avg}d avg</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
