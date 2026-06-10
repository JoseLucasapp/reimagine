import { Lock } from "lucide-react";
import { DealRecord } from "@/data/dealsData";

export function BrokerFilesCard({ deal }: { deal: DealRecord }) {
  return (
    <div className="glass-card-static relative" style={{ padding: 24, borderRadius: 12 }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4" style={{ color: "#243c51" }} />
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>
            Broker Files
          </span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 600, color: "#243c51",
          background: "rgba(36,60,81,0.06)", border: "1px solid rgba(36,60,81,0.12)",
          borderRadius: 8, padding: "4px 8px",
        }}>Reimagine Only</span>
      </div>

      {/* Content with blur overlay */}
      <div className="relative" style={{ borderRadius: 12 }}>
        <div className="flex flex-col gap-2">
          {[
            { label: "Co-Broker", value: deal.cobroker || "Tom Harris" },
            { label: "Co-Broker %", value: deal.cobrokerPercent || "25%" },
            { label: "Estimated Total", value: `$${deal.estimatedCommission.toLocaleString()}` },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between" style={{ padding: "4px 0" }}>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Frosted overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{
          borderRadius: 12, background: "hsl(var(--background))",
          gap: 8,
        }}>
          <Lock className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Visible to Reimagine team only</span>
        </div>
      </div>
    </div>
  );
}
