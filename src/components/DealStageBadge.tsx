import { DealStage } from "@/data/mapRuntimeData";
import { cn } from "@/lib/utils";

const stageBgMap: Record<DealStage, string> = {
  Prospecting: "bg-stage-prospecting/15 text-stage-prospecting",
  LOI: "bg-stage-loi/15 text-stage-loi",
  Lease: "bg-stage-lease/15 text-stage-lease",
  Open: "bg-stage-open/15 text-stage-open",
  Closed: "bg-stage-closed/15 text-stage-closed",
};

export function DealStageBadge({ stage, className }: { stage: DealStage; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap", stageBgMap[stage], className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", {
        "bg-stage-prospecting": stage === "Prospecting",
        "bg-stage-loi": stage === "LOI",
        "bg-stage-lease": stage === "Lease",
        "bg-stage-open": stage === "Open",
        "bg-stage-closed": stage === "Closed",
      })} />
      {stage}
    </span>
  );
}
