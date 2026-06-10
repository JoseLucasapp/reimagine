import { DealRecord } from "@/data/dealsData";
import { calculateDealHealth } from "@/lib/dealIntelligence";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DealHealthIndicatorProps {
  deal: DealRecord;
  size?: "sm" | "md";
}

export function DealHealthIndicator({ deal, size = "sm" }: DealHealthIndicatorProps) {
  const health = calculateDealHealth(deal);
  const dim = size === "md" ? 8 : 8;

  const colors = {
    good: { bg: "#10b981", shadow: "0 0 4px rgba(16,185,129,0.50)" },
    warning: { bg: "#f59e0b", shadow: "0 0 4px rgba(245,158,11,0.50)" },
    critical: { bg: "#ef4444", shadow: "0 0 4px rgba(239,68,68,0.50)" },
  }[health.level];

  const tooltipText = [
    `Deal Health: ${health.score}/100`,
    health.lastUpdatedDays < 999
      ? `Last updated ${health.lastUpdatedDays} day${health.lastUpdatedDays !== 1 ? "s" : ""} ago`
      : "No updates recorded",
    ...health.reasons.filter((r) => !r.includes("Updated within")),
  ].join(". ") + ".";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="shrink-0 cursor-help inline-block"
            style={{
              width: dim,
              height: dim,
              borderRadius: "50%",
              background: colors.bg,
              boxShadow: colors.shadow,
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs">
          <div className="flex items-center gap-[8px] mb-[4px]">
            <span className="font-semibold">Deal Health: {health.score}/100</span>
            <span className="text-[12px] font-medium px-[8px] py-[4px] rounded-full" style={{ background: "rgba(36,60,81,0.06)", color: "#94a3b8" }}>AI</span>
          </div>
          <p style={{ color: "#94a3b8" }} className="leading-relaxed">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
