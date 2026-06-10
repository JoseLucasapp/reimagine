import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { deals, brands, getAllSites, DealStage, getBrandById, getDealById } from "@/data/mockData";
import { MapComponent } from "@/components/MapComponent";
import { SiteCard } from "@/components/SiteCard";
import { DealStageBadge } from "@/components/DealStageBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { List, Map as MapIcon } from "lucide-react";

const stages: DealStage[] = ["Prospecting", "LOI", "Lease", "Open", "Closed"];

export default function MapView() {
  const [searchParams] = useSearchParams();
  const dealFilter = searchParams.get("deal") || "all";
  const [brandFilter, setBrandFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [highlightedSite, setHighlightedSite] = useState<string | null>(null);
  const [showCards, setShowCards] = useState(true);

  const sites = useMemo(() => {
    return getAllSites().filter((s) => {
      const deal = getDealById(s.dealId);
      if (!deal) return false;
      if (dealFilter !== "all" && s.dealId !== dealFilter) return false;
      if (brandFilter !== "all" && deal.brandId !== brandFilter) return false;
      if (stageFilter !== "all" && s.stage !== stageFilter) return false;
      return true;
    });
  }, [brandFilter, stageFilter, dealFilter]);

  return (
    <div className="h-[calc(100vh-4rem)] flex animate-fade-in">
      <div className="flex-1 relative">
        <MapComponent sites={sites} highlightedSiteId={highlightedSite} onSiteHover={setHighlightedSite} className="w-full h-full" />

        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-36 glass-input text-sm shadow-md"><SelectValue placeholder="All Brands" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Brands</SelectItem>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-36 glass-input text-sm shadow-md"><SelectValue placeholder="All Stages" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Stages</SelectItem>{stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="absolute bottom-6 left-4 z-10 px-4 py-3" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.85)", borderRadius: 12, boxShadow: "var(--glass-shadow)" }}>
          <div className="flex items-center gap-4 text-xs">
            {stages.map((s) => <div key={s} className="flex items-center gap-1.5"><DealStageBadge stage={s} /></div>)}
          </div>
        </div>

        <button
          onClick={() => setShowCards(!showCards)}
          className="absolute top-4 right-4 z-10 p-2.5 transition-colors"
          style={{ background: "rgba(255,255,255,0.80)", backdropFilter: "blur(12px)", border: "1px solid rgba(36,60,81,0.08)", borderRadius: 9, boxShadow: "0 1px 4px rgba(36,60,81,0.06)" }}
        >
          {showCards ? <MapIcon className="w-4 h-4" style={{ color: "#1b2326" }} /> : <List className="w-4 h-4" style={{ color: "#1b2326" }} />}
        </button>
      </div>

      {showCards && (
        <div className="w-80 overflow-y-auto animate-slide-in-right" style={{ borderLeft: "1px solid rgba(36,60,81,0.08)", background: "rgba(255,255,255,0.55)", backdropFilter: "blur(20px)" }}>
          <div className="p-4 sticky top-0 z-10" style={{ borderBottom: "1px solid rgba(36,60,81,0.06)", background: "rgba(255,255,255,0.70)", backdropFilter: "blur(16px)" }}>
            <h3 className="section-label">{sites.length} Sites</h3>
          </div>
          <div className="p-3 space-y-3">
            {sites.map((site) => <SiteCard key={site.id} site={site} isHighlighted={highlightedSite === site.id} onHover={setHighlightedSite} compact />)}
            {sites.length === 0 && <p className="text-sm text-center py-8" style={{ color: "#94a3b8" }}>No sites match filters.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
