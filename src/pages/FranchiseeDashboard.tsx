import { useEffect, useMemo, useState } from "react";
import { deals, getBrandById, getDealById } from "@/data/mapRuntimeData";
import { MapComponent } from "@/components/MapComponent";
import { SiteCard } from "@/components/SiteCard";
import { DealStageBadge } from "@/components/DealStageBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";

export default function FranchiseeDashboard() {
  const runtimeDataVersion = useRuntimeDataVersion();
  const [selectedDealId, setSelectedDealId] = useState(deals[0]?.id || "");
  const [highlightedSite, setHighlightedSite] = useState<string | null>(null);

  useEffect(() => {
    const selectedDealExists = deals.some((deal) => deal.id === selectedDealId);
    if ((!selectedDealId || !selectedDealExists) && deals[0]?.id) setSelectedDealId(deals[0].id);
  }, [selectedDealId, runtimeDataVersion]);

  const deal = useMemo(() => getDealById(selectedDealId), [selectedDealId, runtimeDataVersion]);
  const brand = useMemo(() => deal ? getBrandById(deal.brandId) : null, [deal, runtimeDataVersion]);
  const sites = deal?.sites ?? [];

  return (
    <div className="animate-fade-in">
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1600, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: -4 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            {deal ? deal.name : "My Deal"}
          </h1>
          <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
            {brand && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{brand.name}</span>}
            {deal && (
              <>
                <span style={{ color: "var(--text-faint)" }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#E18739" }}>{deal.franchiseeName}</span>
                <span style={{ color: "var(--text-faint)" }}>·</span>
                <DealStageBadge stage={deal.stage} />
              </>
            )}
          </div>
        </div>
        <Select value={selectedDealId} onValueChange={setSelectedDealId}>
          <SelectTrigger className="w-56 glass-input"><SelectValue /></SelectTrigger>
          <SelectContent>
            {deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.franchiseeName} — {d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Map + Cards */}
      <div className="flex" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "var(--shadow-card)", minHeight: "calc(100vh - 200px)" }}>
        <div className="flex-1">
          <MapComponent
            sites={sites}
            highlightedSiteId={highlightedSite}
            onSiteHover={setHighlightedSite}
            className="w-full h-full"
          />
        </div>
        <div className="w-80 overflow-y-auto" style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="sticky top-0 z-10" style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border-divider)", background: "var(--bg-surface)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              {sites.length} Site{sites.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="p-3 space-y-3">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                isHighlighted={highlightedSite === site.id}
                onHover={setHighlightedSite}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
