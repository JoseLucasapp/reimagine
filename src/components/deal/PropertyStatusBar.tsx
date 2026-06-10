import { Calendar } from "lucide-react";

type PropertyStatus = "Under Review" | "Active Tour" | "LOI Submitted" | "Lease Executed" | "On Hold";

const STATUS_COLORS: Record<PropertyStatus, { bg: string; border: string; dot: string; text: string }> = {
  "Under Review": { bg: "rgba(217,119,6,0.10)", border: "rgba(217,119,6,0.22)", dot: "#92400e", text: "#92400e" },
  "Active Tour": { bg: "rgba(30,96,145,0.10)", border: "rgba(30,96,145,0.22)", dot: "#1e6091", text: "#1e6091" },
  "LOI Submitted": { bg: "rgba(91,33,182,0.10)", border: "rgba(91,33,182,0.22)", dot: "#5b21b6", text: "#5b21b6" },
  "Lease Executed": { bg: "rgba(5,150,105,0.10)", border: "rgba(5,150,105,0.22)", dot: "#065f46", text: "#065f46" },
  "On Hold": { bg: "rgba(153,27,27,0.10)", border: "rgba(153,27,27,0.22)", dot: "#991b1b", text: "#991b1b" },
};

interface PropertyStatusBarProps {
  status?: PropertyStatus;
  dateLabel?: string;
}

export function PropertyStatusBar({ status = "Lease Executed", dateLabel = "Lease signed 11/19/2025" }: PropertyStatusBarProps) {
  const colors = STATUS_COLORS[status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2" style={{ padding: "8px 0 8px 0", marginBottom: 12 }}>
      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>
          Property Status
        </span>
        <div className="flex items-center" style={{
          gap: 8, background: colors.bg, border: `1px solid ${colors.border}`,
          borderRadius: 8, padding: "4px 12px 4px 12px",
        }}>
          <span className="pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: colors.dot, display: "inline-block" }} />
          <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: colors.text, maxWidth: 120 }}>{status}</span>
        </div>
      </div>
      <div className="flex items-center" style={{ gap: 4 }}>
        <Calendar className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
        <span className="truncate" style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 160 }}>{dateLabel}</span>
      </div>
    </div>
  );
}
