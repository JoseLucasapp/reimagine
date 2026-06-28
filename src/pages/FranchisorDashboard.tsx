import { useEffect, useMemo, useState } from "react";
import { deals, brands, getAllSites, getBrandById, getDealById, DealStage } from "@/data/mapRuntimeData";
import { MapComponent } from "@/components/MapComponent";
import { SiteCard } from "@/components/SiteCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DealStageBadge } from "@/components/DealStageBadge";
import { List, Map as MapIcon } from "lucide-react";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";

export default function FranchisorDashboard() {
  const runtimeDataVersion = useRuntimeDataVersion();
  const [brandFilter, setBrandFilter] = useState(brands[0]?.id || "all");
  const [highlightedSite, setHighlightedSite] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  useEffect(() => {
    const selectedBrandExists = brands.some((brand) => brand.id === brandFilter);
    if ((!selectedBrandExists || brandFilter === "all") && brands[0]?.id) setBrandFilter(brands[0].id);
  }, [brandFilter, runtimeDataVersion]);

  const sites = useMemo(() => {
    return getAllSites().filter((s) => {
      const deal = getDealById(s.dealId);
      if (!deal) return false;
      if (brandFilter !== "all" && deal.brandId !== brandFilter) return false;
      return true;
    });
  }, [brandFilter, runtimeDataVersion]);

  const brand = useMemo(() => getBrandById(brandFilter), [brandFilter, runtimeDataVersion]);

  return (
    <div className="animate-fade-in">
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1600, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: -4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {brand ? `${brand.name} Portfolio` : "Portfolio Overview"}
        </h1>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>{sites.length} sites</span>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-40 glass-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex p-0.5 rounded-[11px]" style={{ background: "var(--view-toggle-bg)", border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setViewMode("map")}
              className="p-2 rounded-[9px] transition-colors"
              style={viewMode === "map" ? { background: "var(--view-toggle-active-bg)", color: "var(--view-toggle-active-color)" } : { color: "var(--text-muted)" }}
            >
              <MapIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="p-2 rounded-[9px] transition-colors"
              style={viewMode === "list" ? { background: "var(--view-toggle-active-bg)", color: "var(--view-toggle-active-color)" } : { color: "var(--text-muted)" }}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "map" ? (
        <div className="flex" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", minHeight: "calc(100vh - 200px)" }}>
          <div className="flex-1">
            <MapComponent
              sites={sites}
              highlightedSiteId={highlightedSite}
              onSiteHover={setHighlightedSite}
              className="w-full h-full"
            />
          </div>
          <div className="w-80 overflow-y-auto" style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
            <div className="p-3 space-y-3">
              {sites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  isHighlighted={highlightedSite === site.id}
                  onHover={setHighlightedSite}
                  compact
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: 14 }}>
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
