import { Site, getDealById, getBrandById } from "@/data/mockData";
import { DealStageBadge } from "./DealStageBadge";
import { MapPin, FileText, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteCardProps {
  site: Site;
  isHighlighted?: boolean;
  onHover?: (siteId: string | null) => void;
  onClick?: (siteId: string) => void;
  compact?: boolean;
}

export function SiteCard({ site, isHighlighted, onHover, onClick, compact }: SiteCardProps) {
  const deal = getDealById(site.dealId);
  const brand = deal ? getBrandById(deal.brandId) : null;

  return (
    <div
      className={cn(
        "site-card animate-fade-in",
        isHighlighted && "ring-2 ring-brand-orange shadow-lg",
        compact && "p-3"
      )}
      onMouseEnter={() => onHover?.(site.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(site.id)}
    >
      {/* Image placeholder */}
      <div className="w-full h-28 bg-secondary/40 rounded-md mb-3 flex items-center justify-center">
        <MapPin className="w-6 h-6 text-muted-foreground/30" />
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-foreground leading-tight">{site.address}</h4>
          <DealStageBadge stage={site.stage} />
        </div>

        <p className="text-xs text-muted-foreground font-medium">
          {site.city}, {site.state}
        </p>

        {brand && (
          <p className="text-xs text-muted-foreground font-medium">
            {brand.name} · {deal?.name}
          </p>
        )}

        {site.notes && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{site.notes}</span>
          </div>
        )}

        {site.files.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <FileText className="w-3 h-3" />
            <span>{site.files.length} file{site.files.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
    </div>
  );
}
