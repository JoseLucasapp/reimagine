import { checkDuplicateDeal, DuplicateWarning } from "@/lib/dealIntelligence";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface DuplicateDealWarningProps {
  franchisee: string;
  brandId: string;
  city: string;
  excludeDealId?: string;
}

export function DuplicateDealWarning({ franchisee, brandId, city, excludeDealId }: DuplicateDealWarningProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !franchisee || !brandId) return null;

  const warning = checkDuplicateDeal(franchisee, brandId, city, excludeDealId);
  if (!warning) return null;

  return (
    <div className="rounded-lg border border-brand-orange bg-[#fff8e1] p-3 flex items-start gap-2.5 animate-fade-in">
      <AlertTriangle className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground mb-1">Possible Duplicate</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{warning.message}</p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setDismissed(true)}
            className="text-[12px] font-semibold text-foreground px-2.5 py-1 rounded border border-border hover:bg-muted transition-colors"
          >
            Yes, new location
          </button>
          <button
            onClick={() => window.open(`/deals/${warning.existingDeal.id}`, "_blank")}
            className="text-[12px] font-semibold text-brand-orange hover:underline"
          >
            View existing deal
          </button>
        </div>
      </div>
    </div>
  );
}
