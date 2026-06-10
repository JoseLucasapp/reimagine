import { useState } from "react";
import { FileText, Check, Building2, Lock } from "lucide-react";
import { DealRecord, getDealBrandById, daysToSign } from "@/data/dealsData";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrokerFilesCard } from "@/components/deal/BrokerFilesCard";
import { useUserRole, isAdminRole } from "@/hooks/useUserRole";

interface DealSummaryTabProps {
  deal: DealRecord;
}

export function DealSummaryTab({ deal }: DealSummaryTabProps) {
  const [showBrokerFiles, setShowBrokerFiles] = useState(false);
  const role = useUserRole();
  const canViewBrokerFiles = isAdminRole(role);
  const isSigned = deal.status === "Signed";
  const brand = getDealBrandById(deal.brandId);
  const days = daysToSign(deal);

  const brokerFilesDialog = (
    <Dialog open={showBrokerFiles} onOpenChange={setShowBrokerFiles}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Lock className="w-4 h-4" />
            Broker Files
          </DialogTitle>
        </DialogHeader>
        <BrokerFilesCard deal={deal} />
      </DialogContent>
    </Dialog>
  );

  if (!isSigned) {
    return (
      <div className="flex flex-col gap-4">
        {/* Tab header with Broker Files trigger */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>
              Deal Summary
            </span>
          </div>
          {canViewBrokerFiles && (
            <button
              type="button"
              onClick={() => setShowBrokerFiles(true)}
              className="cta-secondary flex items-center gap-2"
              style={{ padding: "8px 16px", fontSize: 12 }}
            >
              <Lock className="w-3 h-3" />
              <span>Broker Files</span>
            </button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center" style={{ minHeight: 400, padding: 48 }}>
          <FileText className="w-12 h-12" style={{ color: "var(--text-muted)" }} />
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginTop: 16 }}>Deal Summary</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 400, textAlign: "center", marginTop: 8, lineHeight: 1.6 }}>
            This summary is generated automatically when the deal is marked as Signed.
          </p>
          <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 400, textAlign: "center", marginTop: 8, lineHeight: 1.6 }}>
            Once signed, this tab will include the selected property details, signed documents, and key lease terms.
          </p>
          <div className="flex items-center gap-2 mt-8" style={{
            background: "rgba(36,60,81,0.04)", borderRadius: 8, padding: "8px 16px",
          }}>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Change status to <strong>Signed</strong> in Project Details to unlock</span>
          </div>
        </div>
        {brokerFilesDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tab header with Broker Files trigger */}
      <div className="flex items-center justify-between" style={{ marginBottom: 0 }}>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: "#065f46" }} />
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>
            Deal Summary
          </span>
        </div>
        {canViewBrokerFiles && (
          <button
            type="button"
            onClick={() => setShowBrokerFiles(true)}
            className="cta-secondary flex items-center gap-2"
            style={{ padding: "8px 16px", fontSize: 12 }}
          >
            <Lock className="w-3 h-3" />
            <span>Broker Files</span>
          </button>
        )}
      </div>

      {/* Signed Property Summary */}
      <div className="glass-card-static" style={{ padding: 24, borderRadius: 12 }}>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4" style={{ color: "#065f46" }} />
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>
            Signed Location
          </span>
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>McKinney Ave Location</h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>3421 McKinney Ave, Dallas, TX 75204</p>
        <div className="flex items-center gap-3">
          {["2,400 SF", "Inline Retail", "Strip Center"].map(tag => (
            <span key={tag} style={{
              background: "rgba(36,60,81,0.04)", borderRadius: 8, padding: "4px 12px",
              fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Signed Documents */}
      <div className="glass-card-static" style={{ padding: 24, borderRadius: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", display: "block", marginBottom: 16 }}>
          Signed Documents
        </span>
        {[
          { label: "Signed LOI", file: "LOI_JamesThornton_Dallas.pdf" },
          { label: "Signed Lease", file: "Lease_McKinneyAve_Final.pdf" },
        ].map(doc => (
          <div key={doc.label} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
            <Check className="w-4 h-4" style={{ color: "#065f46" }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{doc.label}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>— "{doc.file}"</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Key Lease Terms */}
        <div className="glass-card-static" style={{ padding: 24, borderRadius: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", display: "block", marginBottom: 16 }}>
            Key Lease Terms
          </span>
          {[
            { label: "Lease Term", value: "10 years" },
            { label: "Commencement Date", value: "—" },
            { label: "Rent", value: "—" },
            { label: "TI Allowance", value: "$45/SF" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Deal Snapshot */}
        <div className="glass-card-static" style={{ padding: 24, borderRadius: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", display: "block", marginBottom: 16 }}>
            Deal Snapshot
          </span>
          {[
            { label: "Broker", value: deal.broker },
            { label: "Associate", value: deal.associate || "—" },
            { label: "Days to Sign", value: days !== null ? `${days}d` : "—" },
            { label: "Signed Date", value: deal.dateLeaseSigned ? new Date(deal.dateLeaseSigned).toLocaleDateString() : "—" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      {brokerFilesDialog}
    </div>
  );
}
