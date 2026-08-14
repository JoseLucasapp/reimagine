import { ExternalLink, FileText, Lock } from "lucide-react";
import { DealRecord } from "@/data/dealsData";

export function BrokerFilesCard({ deal }: { deal: DealRecord }) {
  const brokerDocuments = [
    { label: "Co-Broker Agreement", file: deal.documents.cobrokerAgreement },
    { label: "Commission Agreement", file: deal.documents.commissionAgreement },
  ];

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

      <div className="relative" style={{ borderRadius: 12 }}>
        <div className="flex flex-col gap-2">
          {[
            { label: "Co-Broker", value: deal.cobroker || "—" },
            { label: "Co-Broker %", value: deal.cobrokerPercent || "—" },
            { label: "Estimated Total", value: `$${deal.estimatedCommission.toLocaleString()}` },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between" style={{ padding: "4px 0" }}>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-divider)" }}>
        <span style={{ display: "block", marginBottom: 10, fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Broker Documents
        </span>
        <div className="flex flex-col gap-2">
          {brokerDocuments.map((doc) => (
            <div key={doc.label} className="flex items-center justify-between gap-3" style={{ fontSize: 13 }}>
              <span className="inline-flex items-center gap-2" style={{ color: "var(--text-secondary)", minWidth: 0 }}>
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{doc.label}</span>
              </span>
              {doc.file ? (
                <a href={doc.file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" style={{ color: "var(--text-orange-ui)", fontSize: 12, fontWeight: 700 }}>
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not filed</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
