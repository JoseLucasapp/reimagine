import { DealStatus, statusColors, statusDotColors } from "@/data/dashboardData";
import { cn } from "@/lib/utils";

const PILL_MAP: Record<string, string> = {
  "Signed": "pill-signed",
  "Leases": "pill-leases",
  "LOI": "pill-loi",
  "Market Study": "pill-market-study",
  "Property Tour": "pill-prop-tour",
  "On-Hold": "pill-on-hold",
  "Intro Call": "pill-intro-call",
  "Sales Call": "pill-sales-call",
};

export function StatusBadge({ status, className }: { status: DealStatus; className?: string }) {
  const pillClass = PILL_MAP[status] || "";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold",
      pillClass || statusColors[status],
      className
    )}>
      {!pillClass && <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusDotColors[status])} />}
      {status}
    </span>
  );
}
