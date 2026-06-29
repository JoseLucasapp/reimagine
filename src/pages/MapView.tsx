import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapPin, ListFilter } from "lucide-react";
import { DealCityMap, type DealCityMapResult } from "@/components/DealCityMap";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { dealBrands, dealRecords, type DealRecord, type DealStatusNew } from "@/data/dealsData";
import { canAccessDeal, getVisibleBrandsForUser, getVisibleDealsForUser, useCurrentProfile, useScopedUser, useUserRole } from "@/hooks/useUserRole";

const statuses: DealStatusNew[] = ["Signed", "Lease Negotiations", "LOI Negotiations", "First LOI(s) Submitted", "Site Tours", "Market Study", "Kick Off", "On Hold"];

function dealTitle(deal: DealRecord): string {
  const brand = dealBrands.find((item) => item.id === deal.brandId);
  return deal.name || `${brand?.name ?? "Deal"} ${[deal.city, deal.state].filter(Boolean).join(", ")}`;
}

export default function MapView() {
  const runtimeDataVersion = useRuntimeDataVersion();
  const [searchParams] = useSearchParams();
  const requestedDealId = searchParams.get("deal") || "";
  const role = useUserRole();
  const profile = useCurrentProfile();
  const user = useScopedUser();
  const [brandFilter, setBrandFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [mapResult, setMapResult] = useState<DealCityMapResult>({ pins: [], unmappedDeals: [] });

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
    if (role === "brand" && profile?.brandId) {
      setBrandFilter(profile.brandId);
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]" style={{ gap: 18 }}>
        <div className="glass-card-static overflow-hidden" style={{ padding: 0, minHeight: 620 }}>
          <DealCityMap deals={filteredDeals} className="h-full w-full" onComputed={setMapResult} />
        </div>

        <aside className="glass-card-static overflow-hidden" style={{ padding: 0 }}>
          <div className="flex items-center justify-between" style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-divider)" }}>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" style={{ color: "#E18739" }} />
              <span className="section-label">{mapResult.pins.length} City Pins</span>
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{filteredDeals.length} deals</span>
          </div>
          <div className="themed-scrollbar overflow-y-auto" style={{ maxHeight: 560, padding: 14 }}>
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
