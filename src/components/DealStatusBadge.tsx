import { DealStatusNew } from "@/data/dealsData";
import { cn } from "@/lib/utils";

const PILL_CLASSES: Record<string, string> = {
  "Signed": "pill-signed",
  "Lease Negotiations": "pill-leases",
  "LOI Negotiations": "pill-loi-neg",
  "First LOI(s) Submitted": "pill-loi",
  "Site Tours": "pill-prop-tour",
  "Market Study": "pill-market-study",
  "Kick Off": "pill-intro-call",
  "On Hold": "pill-on-hold",
};

export function DealStatusBadge({ status, className }: { status: DealStatusNew; className?: string }) {
  const pillClass = PILL_CLASSES[status] || "pill-intro-call";
  return (
    <span className={cn(
      "inline-flex w-fit self-start items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap",
      pillClass, className
    )}>
      {status}
    </span>
  );
}
