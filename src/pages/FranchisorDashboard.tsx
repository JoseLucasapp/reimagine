import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, Navigate } from "react-router-dom";
import { Send, Map as MapIcon, List, CheckCircle2, Handshake, Briefcase } from "lucide-react";
import { ActionItemsPanel } from "@/components/ActionItemsPanel";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { TakeActionDrawer, type TakeActionSubmission } from "@/components/deal/TakeActionDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { dealBrands, dealRecords, type DealRecord } from "@/data/dealsData";
import { brandActionStore, type BrandActionItem } from "@/lib/brandActionStore";
import { getVisibleBrandsForUser, getVisibleDealsForUser, useCurrentProfile, useScopedUser, useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const EMPTY_ACTION_ITEMS: BrandActionItem[] = [];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function dealName(deal: DealRecord): string {
  const brand = dealBrands.find((item) => item.id === deal.brandId);
  return deal.name || `${brand?.name ?? "Deal"} ${[deal.city, deal.state].filter(Boolean).join(", ")}`;
}

export default function FranchisorDashboard() {
  const runtimeDataVersion = useRuntimeDataVersion();
  const user = useScopedUser();
  const role = useUserRole();
  const profile = useCurrentProfile();
  const [selectedBrandId, setSelectedBrandId] = useState("all");
  const [actionPanelOpen, setActionPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleDeals = useMemo(() => {
    void runtimeDataVersion;
    return getVisibleDealsForUser(user ?? role, dealRecords).filter((deal) => !deal.isOneOff);
  }, [role, runtimeDataVersion, user]);

  const visibleBrands = useMemo(() => {
    void runtimeDataVersion;
    return getVisibleBrandsForUser(user ?? role, dealBrands, visibleDeals);
  }, [role, runtimeDataVersion, user, visibleDeals]);

  useEffect(() => {
    if (role === "brand" && profile?.brandId) {
      setSelectedBrandId(profile.brandId);
      return;
    }
    if (selectedBrandId !== "all" && !visibleBrands.some((brand) => brand.id === selectedBrandId)) {
      setSelectedBrandId("all");
    }
  }, [profile?.brandId, role, selectedBrandId, visibleBrands]);

  const scopedDeals = useMemo(() => {
    if (selectedBrandId === "all") return visibleDeals;
    return visibleDeals.filter((deal) => deal.brandId === selectedBrandId);
  }, [selectedBrandId, visibleDeals]);

  const activeBrand = selectedBrandId === "all" ? null : visibleBrands.find((brand) => brand.id === selectedBrandId) ?? null;
  const actionBrandId = activeBrand?.id ?? (role === "brand" ? profile?.brandId ?? null : null);

  const items = useSyncExternalStore(
    (cb) => brandActionStore.subscribe(cb),
    () => (actionBrandId ? brandActionStore.getByBrand(actionBrandId) : EMPTY_ACTION_ITEMS),
    () => EMPTY_ACTION_ITEMS,
  );

  useEffect(() => {
    if (!actionBrandId) return;
    void brandActionStore.loadByBrand(actionBrandId).catch((err) => {
      toast.error("Unable to load action items", {
        description: err instanceof Error ? err.message : "Check Supabase schema and permissions.",
      });
    });
  }, [actionBrandId]);

  const stats = useMemo(() => {
    const signed = scopedDeals.filter((deal) => deal.status === "Signed").length;
    const active = scopedDeals.filter((deal) => deal.status !== "Signed" && deal.status !== "On Hold").length;
    return { total: scopedDeals.length, active, signed };
  }, [scopedDeals]);

  const requestedBy = profile?.email || profile?.fullName || profile?.username || "Unknown";

  const handleSubmit = async (data: TakeActionSubmission) => {
    if (!actionBrandId) {
      toast.error("Select a single brand before creating an action.");
      throw new Error("Brand scope is required.");
    }
    if (!profile) {
      toast.error("Current user profile is required.");
      throw new Error("Current user profile is required.");
    }
    await brandActionStore.add({
      brandId: actionBrandId,
      actionTypeKey: data.actionTypeKey,
      actionTypeLabel: data.actionTypeLabel,
      recipients: data.recipients,
      message: data.message,
      urgency: data.urgency,
      requestedBy,
    });
  };

  const missingBrandScope = role === "brand" && !profile?.brandId;

  if (role === "brand" && profile?.brandId) {
    return <Navigate to={`/brands/${profile.brandId}/deals`} replace />;
  }

  if (missingBrandScope) {
    return (
      <div className="animate-fade-in p-8">
        <div className="glass-card-static mx-auto max-w-xl p-6 text-center">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Brand scope is not assigned</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            This profile is marked as Brand Level but does not have a `brand_id` in Supabase profiles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1600, margin: "0 auto" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {activeBrand ? `${activeBrand.name} Deals` : "Brand Deals"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              List view is the default while map view is being refined.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {role === "admin" && (
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger className="w-52 glass-input"><SelectValue placeholder="All brands" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {visibleBrands.map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2 rounded-[11px] px-3 py-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
              <List className="h-4 w-4" />
              <span className="text-xs font-semibold">List</span>
              <span className="text-xs">|</span>
              <MapIcon className="h-4 w-4 opacity-50" />
              <span className="text-xs">Map available</span>
            </div>
            {actionBrandId && (
              <>
                <button type="button" onClick={() => setActionPanelOpen(true)} className="cta-secondary">
                  {items.filter((item) => item.status === "pending").length} Action Items
                </button>
                <button type="button" onClick={() => setDrawerOpen(true)} className="cta-primary inline-flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Take Action
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 16 }}>
          {[
            { label: "Total Deals", value: stats.total, icon: Briefcase },
            { label: "Active Deals", value: stats.active, icon: Handshake },
            { label: "Signed Deals", value: stats.signed, icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.label} style={{ background: "var(--stat-card-bg)", border: "0.56px solid var(--stat-card-border)", borderRadius: 14, padding: 20, boxShadow: "var(--shadow-card)" }}>
              <item.icon className="h-4 w-4" style={{ color: "#E18739" }} />
              <p style={{ fontSize: 32, fontWeight: 800, color: "var(--stat-value-color)", marginTop: 8, lineHeight: 1 }}>{item.value}</p>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 8, display: "block" }}>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="glass-table overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "var(--bg-table-header)" }}>
                  {["Deal", "Franchisee", "City, State", "Stage", "Broker", "Est. Commission", "Latest Update", ""].map((header) => (
                    <th key={header} className="px-4 py-3 text-left font-semibold text-muted-foreground" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scopedDeals.map((deal) => {
                  const latestNote = deal.notes[0];
                  return (
                    <tr key={deal.id} style={{ borderBottom: "1px solid var(--border-divider)" }}>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap" }}>{dealName(deal)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap" }}>{deal.franchisee || "—"}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap" }}>{[deal.city, deal.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-divider)" }}><DealStatusBadge status={deal.status} /></td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap" }}>{deal.broker || "—"}</td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-divider)", whiteSpace: "nowrap" }}>{formatCurrency(deal.estimatedCommission)}</td>
                      <td className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-divider)", maxWidth: 280 }}>
                        <span className="block truncate text-xs" style={{ color: "var(--text-faint)" }}>{latestNote?.text || "No updates yet"}</span>
                      </td>
                      <td className="px-4 py-3 text-right" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                        <Link to={`/deals/${deal.id}`} className="text-xs font-semibold" style={{ color: "#E18739" }}>Open Deal</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {scopedDeals.length === 0 && (
            <div className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No deals are visible for this profile scope.
            </div>
          )}
        </div>
      </div>

      <TakeActionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dealName={activeBrand?.name ?? "Brand"}
        broker=""
        onSubmit={handleSubmit}
      />
      <ActionItemsPanel
        open={actionPanelOpen}
        onClose={() => setActionPanelOpen(false)}
        items={items}
        contextLabel={activeBrand?.name}
        enableDealLinks
        resolveDealHref={(name) => {
          const match = scopedDeals.find((deal) => name.includes(deal.franchisee) || name.includes(deal.city));
          return match ? `/deals/${match.id}` : null;
        }}
      />
    </div>
  );
}
