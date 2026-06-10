import { DealRecord } from "@/data/dealsData";
import { getTimeInStage, getStageBenchmark, getStageTimingColor } from "@/lib/dealIntelligence";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function StageTimingBadge({ deal }: { deal: DealRecord }) {
  if (deal.status === "Signed") return null;
  
  const days = getTimeInStage(deal);
  const color = getStageTimingColor(deal);
  const benchmark = getStageBenchmark(deal.status);

  const textColor = {
    green: "#059669",
    amber: "#d97706",
    red: "#dc2626",
  }[color];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="font-semibold" style={{ fontSize: 12, letterSpacing: "0.04em", color: textColor }}>
            {days}d in stage
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>Average for {deal.status}: {benchmark} days</p>
          <p>This deal has been here {days} days.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
