import { useState, useEffect, useSyncExternalStore } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { recordDealVisit } from "@/hooks/useRecentDeals";
import { DEAL_STATUS_ORDER, getDealRecordById, getDealBrandById, daysToSign, daysActive, DealStatusNew, type DealRecord, type DealDocuments } from "@/data/dealsData";
import { DealHealthIndicator } from "@/components/DealHealthIndicator";
import { AIDealSummary } from "@/components/AIDealSummary";
import { TopSitesTab } from "@/components/deal/TopSitesTab";
import { LOIComparisonTab } from "@/components/deal/LOIComparisonTab";
import { DealSummaryTab } from "@/components/deal/DealSummaryTab";
// BrokerFilesCard is now rendered inside DealSummaryTab via modal
import { BrandAvatar } from "@/components/BrandAvatar";
import { ArrowRight, MapPin, Clock, FileText, Check, Plus, Map, BookOpen, BarChart3, Zap, Store, Layers, FolderOpen, X, Send, RefreshCw, ClipboardList, MessageSquare, CheckCircle2, Link2, Loader2, Upload } from "lucide-react";
import { TakeActionDrawer, TakeActionSubmission } from "@/components/deal/TakeActionDrawer";
import { canAccessDeal, canEditDeal, useCurrentProfile, useScopedUser, useUserRole } from "@/hooks/useUserRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DealLinksEditorModal } from "@/components/deal/DealLinksEditorModal";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { getSitesByDeal } from "@/data/mapRuntimeData";
import { createDealActionItem, createDealNote, createTourBook, siteToMutationInput, updateDeal, updateSite, type DealMutationInput } from "@/application/data/runtimeMutations";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { ALL_DEAL_DOCUMENTS, DEAL_DOCUMENT_GROUPS, DealDocumentsManagerModal, type DealDocumentKey } from "@/components/deal/DealDocumentsManagerModal";
import { fileNameFromStorageValue, uploadDealDocumentFile } from "@/infrastructure/supabase/storage";
import { dealActionStore, type DealActionItem } from "@/lib/dealActionStore";

const ALL_STATUSES: DealStatusNew[] = DEAL_STATUS_ORDER;
const EMPTY_DEAL_ACTION_ITEMS: DealActionItem[] = [];


type DealDocumentDescriptor = {
  key: DealDocumentKey;
  label: string;
};

const ALL_DOC_KEYS = ALL_DEAL_DOCUMENTS;
const hiddenScrollbarStyle: React.CSSProperties = { scrollbarWidth: "none", msOverflowStyle: "none" };

type DealTab = "project" | "topsites" | "loi" | "summary";

function dealToMutationInput(deal: DealRecord, overrides: Partial<DealMutationInput> = {}): DealMutationInput {
  return {
    brandId: deal.brandId,
    franchisee: deal.franchisee,
    cellPhone: deal.cellPhone,
    city: deal.city,
    state: deal.state,
    broker: deal.broker,
    associate: deal.associate,
    corporate: deal.corporate,
    dateIntroCall: deal.dateIntroCall ?? "",
    dateLeaseSigned: deal.dateLeaseSigned ?? "",
    storesBought: deal.storesBought,
    storeCount: deal.storeCount,
    territoryMapLink: deal.territoryMapLink ?? "",
    marketStudyLink: deal.marketStudyLink ?? "",
    mapLink: deal.mapLink ?? "",
    tourBookLink: deal.tourBookLink ?? "",
    cobroker: deal.cobroker,
    cobrokerPercent: deal.cobrokerPercent,
    estimatedCommission: deal.estimatedCommission,
    status: deal.status,
    documents: deal.documents,
    isOneOff: deal.isOneOff,
    corporateComments: deal.corporateComments,
    ...overrides,
  };
}

// ===== DEAL VELOCITY WIDGET — DEAL-SPECIFIC stage journey =====
const VELOCITY_STAGES: { status: DealStatusNew; label: string; dotColor: string; weight: number }[] = [
  { status: "Kick Off",                label: "Kick Off",   dotColor: "#94a3b8", weight: 7 },
  { status: "Market Study",            label: "Mkt Study",  dotColor: "#8b5cf6", weight: 14 },
  { status: "Site Tours",              label: "Site Tours", dotColor: "#14b8a6", weight: 10 },
  { status: "LOI Negotiations",        label: "LOI Negotiations", dotColor: "#1E5BA8", weight: 21 },
  { status: "Lease Negotiations",      label: "Lease Neg.", dotColor: "#3b82f6", weight: 30 },
  { status: "Signed",                  label: "Signed",     dotColor: "#059669", weight: 0 },
];

type StageJourney = {
  status: DealStatusNew;
  label: string;
  dotColor: string;
  days: number | null;
  state: "completed" | "current" | "future";
};

function buildDealJourney(deal: DealRecord): StageJourney[] {
  const totalDays = Math.max(1, daysActive(deal));
  const currentIdx = VELOCITY_STAGES.findIndex((s) => s.status === deal.status);
  // On Hold or unknown: treat as current at first stage
  const idx = currentIdx >= 0 ? currentIdx : 0;

  // Completed stages = 0..idx-1, allocate proportional weights of totalDays,
  // leaving remainder for current stage.
  const completed = VELOCITY_STAGES.slice(0, idx);
  const completedWeight = completed.reduce((a, s) => a + s.weight, 0) || 1;
  // For Signed deals (idx === last), distribute totalDays across all completed stages
  const isSigned = deal.status === "Signed";
  const currentBudget = isSigned ? 0 : Math.round(totalDays * 0.35);
  const completedBudget = Math.max(0, totalDays - currentBudget);

  const days: number[] = completed.map((s) => Math.max(1, Math.round((s.weight / completedWeight) * completedBudget)));
  // Fix rounding drift
  const drift = completedBudget - days.reduce((a, b) => a + b, 0);
  if (days.length > 0) days[days.length - 1] = Math.max(1, days[days.length - 1] + drift);

  const currentDays = isSigned ? totalDays - days.reduce((a, b) => a + b, 0) : currentBudget;

  return VELOCITY_STAGES.map((s, i) => {
    if (i < idx) return { status: s.status, label: s.label, dotColor: s.dotColor, days: days[i], state: "completed" as const };
    if (i === idx) return { status: s.status, label: s.label, dotColor: s.dotColor, days: Math.max(1, currentDays), state: "current" as const };
    return { status: s.status, label: s.label, dotColor: s.dotColor, days: null, state: "future" as const };
  });
}

function DealVelocityWidget({ deal, onViewKanban }: { deal: DealRecord; onViewKanban: () => void }) {
  const journey = buildDealJourney(deal);
  const totalActive = daysActive(deal);
  const currentStage = journey.find((s) => s.state === "current");
  const completedTotal = journey.filter((s) => s.state === "completed").reduce((a, s) => a + (s.days || 0), 0) + (currentStage?.days || 0) || 1;

  return (
    <div className="glass-card-static" style={{ padding: "16px 20px", borderRadius: 12 }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3" style={{ color: "#E18739" }} />
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>
            Deal Velocity
          </span>
        </div>
        <button
          onClick={onViewKanban}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)" }}
          className="hover:opacity-75 transition-opacity cursor-pointer"
        >
          View Full Kanban →
        </button>
      </div>

      {/* Stage segments — deal-specific */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${journey.length}, 1fr)`, gap: 0 }}>
        {journey.map((stage, idx) => {
          const isLast = idx === journey.length - 1;
          const isCurrent = stage.state === "current";
          const isCompleted = stage.state === "completed";
          const isFuture = stage.state === "future";
          const labelColor = isFuture ? "var(--text-muted)" : "var(--text-secondary)";
          const daysColor = isCurrent ? "var(--text-orange-ui)" : "var(--text-muted)";
          return (
            <div
              key={stage.status}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
                minWidth: 0,
                padding: "8px 12px",
                borderRight: isLast ? "none" : "1px solid rgba(36,60,81,0.08)",
                borderBottom: isCurrent ? "2px solid var(--text-orange-ui)" : "2px solid transparent",
                background: isCurrent ? "rgba(225,135,57,0.04)" : "transparent",
                opacity: isFuture ? 0.7 : 1,
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0" style={{ width: "100%" }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: isFuture ? "transparent" : stage.dotColor,
                  border: isFuture ? `1px solid ${stage.dotColor}` : "none",
                  opacity: isFuture ? 0.5 : 1,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: isCurrent ? 12 : 11,
                  fontWeight: 600,
                  color: labelColor,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {stage.label}
                </span>
              </div>
              <span style={{
                fontSize: isCurrent ? 12 : 11,
                fontWeight: isCurrent ? 600 : 500,
                color: stage.days != null ? daysColor : "var(--text-muted)",
              }}>
                {stage.days != null ? `${stage.days}d` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom: deal-specific progress + stats */}
      <div className="flex items-center" style={{ gap: 16, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(36,60,81,0.06)" }}>
        <div className="flex overflow-hidden" style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(36,60,81,0.06)" }}>
          {journey.map((stage) => {
            if (stage.days == null) return null;
            const w = (stage.days / completedTotal) * 100;
            if (w === 0) return null;
            return (
              <div
                key={stage.status}
                style={{ width: `${w}%`, height: "100%", background: stage.dotColor }}
              />
            );
          })}
        </div>
        <span style={{ flexShrink: 0, fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
          Active {totalActive}d · Current: {currentStage?.label ?? "—"} · {currentStage?.days ?? 0}d in stage
        </span>
      </div>
    </div>
  );
}

// ===== DOCUMENT COMPLETION WIDGET =====
function DocCompletionWidget({ deal, onViewAll }: { deal: DealRecord; onViewAll?: () => void }) {
  const docs = deal.documents;
  const total = ALL_DOC_KEYS.length;
  const filed = Object.values(docs).filter(Boolean).length;
  const pct = Math.round((filed / total) * 100);
  const radius = 31;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (filed / total) * circumference;

  const criticalDocs: DealDocumentDescriptor[] = [
    { key: "engagementLetter", label: "Engagement Letter" },
    { key: "signedLOI", label: "Signed LOI" },
    { key: "cobrokerAgreement", label: "Co-Broker Agmt" },
    { key: "signedLease", label: "Signed Lease" },
  ];

  return (
    <div className="glass-card-static flex flex-col" style={{ padding: 0, borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: "16px 20px", background: "rgba(36,60,81,0.03)" }}>
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" style={{ color: "#E18739" }} />
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>Deal Documents</span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, color:"#065f46",
          background: pct === 100 ? "rgba(5,150,105,0.08)" : "rgba(36,60,81,0.06)",
          borderRadius: 9999, padding: "4px 10px",
        }}>{filed} of {total} filed</span>
      </div>

      <div style={{ padding: "16px 20px 20px" }}>
        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 9999, background: "rgba(36,60,81,0.08)", marginBottom: 16, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 9999, width: `${pct}%`,
            background: pct === 100 ? "#059669" : "linear-gradient(90deg, #243c51, #E18739)",
            transition: "width 0.5s ease",
          }} />
        </div>

        {/* Document checklist */}
        <div className="flex flex-col" style={{ gap: 6 }}>
          {criticalDocs.map((d) => {
            const has = Boolean(docs[d.key]);
            return (
              <div key={d.key} className="flex items-center gap-3" style={{
                padding: "8px 12px", borderRadius: 8,
                background: has ? "rgba(5,150,105,0.04)" : "rgba(153,27,27,0.03)",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: has ? "rgba(5,150,105,0.12)" : "rgba(153,27,27,0.08)",
                }}>
                  {has
                    ? <Check className="w-3 h-3" style={{ color: "#059669" }} />
                    : <X className="w-3 h-3" style={{ color: "#991b1b" }} />
                  }
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: has ? "#065f46" : "#991b1b" }}>{d.label}</span>
              </div>
            );
          })}
        </div>

        {/* Expand link */}
        <button onClick={onViewAll} style={{
          fontSize: 12, color: "var(--text-muted)", marginTop: 10, padding: 0, background: "none", border: "none", cursor: "pointer",
        }}>+ {total - criticalDocs.length} more documents</button>
      </div>

      {/* Footer CTA */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-divider)", background: "rgba(36,60,81,0.02)" }}>
        <button className="w-full flex items-center justify-center gap-2" onClick={onViewAll} style={{
          fontSize: 12, fontWeight: 600, color: "#E18739", padding: "8px 0",
          background: "none", border: "none", cursor: "pointer",
        }}>
          View all deal documents
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

type SignedSiteOption = {
  id: string;
  label: string;
};

type SignedCompletionValues = {
  selectedProperty: string;
  signedLOI: string;
  signedLease: string;
  leaseTerm: string;
  commencementDate: string;
  rent: string;
  tiAllowance: string;
};

function normalizeCompletionDocument(value: string): string {
  return value.trim();
}

// ===== SIGNED COMPLETION MODAL =====
function SignedCompletionModal({
  deal,
  onClose,
  onConfirm,
  sites,
}: {
  deal: DealRecord;
  onClose: () => void;
  onConfirm: (values: SignedCompletionValues) => void | Promise<void>;
  sites: SignedSiteOption[];
}) {
  const [leaseTerm, setLeaseTerm] = useState("");
  const [commencementDate, setCommencementDate] = useState("");
  const [rent, setRent] = useState("");
  const [tiAllowance, setTiAllowance] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(sites[0]?.id ?? "");
  const [signedLOI, setSignedLOI] = useState(deal.documents.signedLOI ?? "");
  const [signedLease, setSignedLease] = useState(deal.documents.signedLease ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<DealDocumentKey | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const signedLOIValue = normalizeCompletionDocument(signedLOI);
  const signedLeaseValue = normalizeCompletionDocument(signedLease);
  const canSubmit = Boolean(signedLOIValue && signedLeaseValue && (sites.length === 0 || selectedProperty));

  const handleRequiredDocUpload = async (key: DealDocumentKey, file: File | null) => {
    if (!file) return;

    setUploadingKey(key);
    setUploadError(null);
    try {
      const publicUrl = await uploadDealDocumentFile({ dealId: deal.id, documentKey: key, file });
      if (key === "signedLOI") setSignedLOI(publicUrl);
      if (key === "signedLease") setSignedLease(publicUrl);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to upload file. Please try again.");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleConfirm = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await onConfirm({
        selectedProperty,
        signedLOI: signedLOIValue,
        signedLease: signedLeaseValue,
        leaseTerm: leaseTerm.trim(),
        commencementDate: commencementDate.trim(),
        rent: rent.trim(),
        tiAllowance: tiAllowance.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const requiredDocs: { key: DealDocumentKey; label: string; value: string; setValue: (value: string) => void; placeholder: string }[] = [
    { key: "signedLOI", label: "Signed LOI", value: signedLOI, setValue: setSignedLOI, placeholder: "Paste Signed LOI file link or upload a file..." },
    { key: "signedLease", label: "Signed Lease", value: signedLease, setValue: setSignedLease, placeholder: "Paste Signed Lease file link or upload a file..." },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4" style={{ background: "rgba(15,23,42,0.52)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full overflow-hidden"
        style={{
          maxWidth: 680,
          maxHeight: "88vh",
          borderRadius: 18,
          background: "hsl(var(--background))",
          border: "1px solid var(--border-card)",
          boxShadow: "0 24px 80px rgba(15,23,42,0.24)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="flex items-start justify-between gap-4" style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border-divider)", background: "var(--bg-card)" }}>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(5,150,105,0.12)", color: "#059669" }}>
              <Check className="w-4 h-4" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 750, color: "var(--text-primary)", lineHeight: 1.25 }}>Complete to Mark as Signed</h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, maxWidth: 500 }}>
                Add the required signed documents, select the signed property, and capture the core lease terms before closing the deal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 32, height: 32, border: "1px solid var(--border-subtle)", borderRadius: 10, background: "hsl(var(--background))", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X className="w-4 h-4 mx-auto" />
          </button>
        </div>

        <div className="themed-scrollbar overflow-y-auto" style={{ padding: 24 }}>
          <section style={{ marginBottom: 22 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>Required Documents</span>
              <span style={{ fontSize: 12, color: signedLOIValue && signedLeaseValue ? "#059669" : "var(--text-muted)", fontWeight: 650 }}>
                {[signedLOIValue, signedLeaseValue].filter(Boolean).length} of 2 ready
              </span>
            </div>
            {uploadError && (
              <div style={{ marginBottom: 10, padding: "9px 11px", borderRadius: 10, background: "rgba(153,27,27,0.07)", border: "1px solid rgba(153,27,27,0.14)", color: "#991b1b", fontSize: 12 }}>
                {uploadError}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {requiredDocs.map((doc) => {
                const filled = Boolean(doc.value.trim());
                const uploading = uploadingKey === doc.key;
                return (
                  <div key={doc.label} className="grid gap-3 md:grid-cols-[150px_1fr] md:items-start" style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border-subtle)", background: filled ? "rgba(5,150,105,0.035)" : "var(--bg-card)" }}>
                    <div className="flex items-center gap-2" style={{ paddingTop: 9 }}>
                      <div className="flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 999, background: filled ? "rgba(5,150,105,0.12)" : "rgba(100,116,139,0.10)", color: filled ? "#059669" : "var(--text-muted)" }}>
                        {filled ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 650, color: "var(--text-primary)" }}>{doc.label}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        value={doc.value}
                        onChange={(event) => { doc.setValue(event.target.value); setUploadError(null); }}
                        placeholder={doc.placeholder}
                        className="glass-input w-full px-3 py-2 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <label
                          className="inline-flex items-center gap-1.5"
                          style={{
                            padding: "6px 10px",
                            borderRadius: 9,
                            border: "1px dashed var(--border-subtle)",
                            background: "hsl(var(--background))",
                            color: uploading ? "var(--text-muted)" : "var(--text-secondary)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: uploading ? "not-allowed" : "pointer",
                            opacity: uploading ? 0.65 : 1,
                          }}
                        >
                          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          {uploading ? "Uploading..." : filled ? "Replace file" : "Upload file"}
                          <input
                            type="file"
                            className="sr-only"
                            disabled={uploading}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0] ?? null;
                              void handleRequiredDocUpload(doc.key, file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {filled && (
                          <span style={{ minWidth: 0, fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {fileNameFromStorageValue(doc.value)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={{ marginBottom: 22 }}>
            <span style={{ fontSize: 11, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
              Signed Property
            </span>
            {sites.length > 0 ? (
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger className="w-full glass-input"><SelectValue placeholder="Select the property that was signed..." /></SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>{site.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="glass-input px-3 py-2 text-sm" style={{ color: "var(--text-muted)", borderStyle: "dashed" }}>
                No sites are attached to this deal yet. The deal can be marked as signed, but add a site later to complete property reporting.
              </div>
            )}
          </section>

          <section>
            <span style={{ fontSize: 11, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", display: "block", marginBottom: 10 }}>
              Key Lease Terms
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>Lease Term</label>
                <input value={leaseTerm} onChange={(event) => setLeaseTerm(event.target.value)} placeholder="e.g. 10 years" className="glass-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>Commencement Date</label>
                <input value={commencementDate} onChange={(event) => setCommencementDate(event.target.value)} type="date" className="glass-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>Rent ($/SF or total)</label>
                <input value={rent} onChange={(event) => setRent(event.target.value)} placeholder="e.g. $28/SF" className="glass-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>TI Allowance ($/SF)</label>
                <input value={tiAllowance} onChange={(event) => setTiAllowance(event.target.value)} placeholder="e.g. $45/SF" className="glass-input w-full px-3 py-2 text-sm" />
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3" style={{ padding: "16px 24px", borderTop: "1px solid var(--border-divider)", background: "var(--bg-card)" }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13, fontWeight: 650, color: "var(--text-muted)", padding: "9px 14px", cursor: "pointer", background: "none", border: "none" }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || saving}
            onClick={handleConfirm}
            className="cta-primary"
            style={{
              minHeight: 38,
              opacity: canSubmit && !saving ? 1 : 0.55,
              cursor: canSubmit && !saving ? "pointer" : "not-allowed",
              ...(canSubmit ? {} : { background: "rgba(36,60,81,0.08)", color: "var(--text-muted)", boxShadow: "none" }),
            }}
          >
            {saving ? "Saving..." : "Mark as Signed"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DealDetail({ dealIdOverride }: { dealIdOverride?: string } = {}) {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const requestedDealId = dealIdOverride || dealId || "";
  const deal = getDealRecordById(requestedDealId);
  const [newNote, setNewNote] = useState("");
  const [status, setStatus] = useState(deal?.status || "Kick Off");
  const [activeTab, setActiveTab] = useState<DealTab>("project");
  const [showSignedModal, setShowSignedModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<DealStatusNew | null>(null);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showTakeAction, setShowTakeAction] = useState(false);
  const [showLinksEditor, setShowLinksEditor] = useState(false);
  const role = useUserRole();
  const user = useScopedUser();
  const profile = useCurrentProfile();
  useRuntimeDataVersion();
  const takeActionLabel = role === "deal" ? "Request from Reimagine" : "Take Action";
  type ActionRequest = {
    typeKey: string;
    typeLabel: string;
    message: string;
    recipients: string[];
    urgency: string;
    status: "pending" | "resolved";
  };
  type FeedEntry = { date: string; text: string; author?: string; action?: ActionRequest };
  const [localNotes, setLocalNotes] = useState<FeedEntry[]>(deal?.notes || []);
  const dealActionItems = useSyncExternalStore(
    (cb) => dealActionStore.subscribe(cb),
    () => (deal?.id ? dealActionStore.getByDeal(deal.id) : EMPTY_DEAL_ACTION_ITEMS),
    () => EMPTY_DEAL_ACTION_ITEMS,
  );
  const hasDealAccess = deal ? canAccessDeal(user ?? role, deal) : false;
  const canEditCurrentDeal = canEditDeal(user ?? role);

  useEffect(() => {
    if (deal?.id && deal?.brandId) recordDealVisit(deal.brandId, deal.id);
  }, [deal?.id, deal?.brandId]);

  useEffect(() => {
    setStatus(deal?.status || "Kick Off");
    setLocalNotes(deal?.notes || []);
  }, [deal?.id, deal?.notes, deal?.status]);

  useEffect(() => {
    if (!deal?.id || !hasDealAccess) return;
    void dealActionStore.loadByDeal(deal.id).catch((error) => {
      toast.error("Unable to load deal action items", {
        description: error instanceof Error ? error.message : "Please check Supabase permissions.",
      });
    });
  }, [deal?.id, hasDealAccess]);

  const persistDealChanges = async (overrides: Partial<DealMutationInput> = {}) => {
    if (!deal) throw new Error("Deal not found.");
    const updated = await updateDeal(deal.id, dealToMutationInput(deal, overrides));
    Object.assign(deal, updated);
    return updated;
  };

  const handleAddNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    const entry = { date: new Date().toISOString().slice(0, 10), text, author: "ME" };
    setNewNote("");
    try {
      if (!deal) throw new Error("Deal not found.");
      const savedNote = await createDealNote(deal.id, text);
      setLocalNotes((prev) => [savedNote ?? entry, ...prev]);
    } catch (error) {
      setNewNote(text);
      toast.error("Unable to save note", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const persistStatusChange = async (nextStatus: DealStatusNew, overrides: Partial<DealMutationInput> = {}) => {
    const previousStatus = status;
    setStatus(nextStatus);
    try {
      await persistDealChanges({ ...overrides, status: nextStatus });
    } catch (error) {
      setStatus(previousStatus);
      toast.error("Unable to save deal status", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      throw error;
    }
  };

  const handleSaveDealDocuments = async (documents: DealDocuments) => {
    try {
      await persistDealChanges({ documents });
      toast.success("Deal documents updated");
      setShowDocsModal(false);
    } catch (error) {
      toast.error("Unable to save deal documents", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      throw error;
    }
  };

  const handleSignedConfirm = async (values: SignedCompletionValues) => {
    if (!pendingStatus || !deal) return;

    const nextDocuments: DealDocuments = {
      ...deal.documents,
      signedLOI: values.signedLOI,
      signedLease: values.signedLease,
    };

    try {
      const signedSite = dealSites.find((site) => site.id === values.selectedProperty);
      if (signedSite) {
        await updateSite(signedSite.id, {
          ...siteToMutationInput(signedSite),
          stage: "Closed",
          loiUrl: values.signedLOI,
          leaseUrl: values.signedLease,
          leaseTerm: values.leaseTerm || signedSite.leaseTerm,
          commencementDate: values.commencementDate || signedSite.loiTerms.commencementDate,
          baseRent: values.rent || signedSite.loiTerms.baseRent,
          tiAllowance: values.tiAllowance || signedSite.loiTerms.tiAllowance,
        });
      }

      await persistStatusChange(pendingStatus, {
        documents: nextDocuments,
        dateLeaseSigned: deal.dateLeaseSigned ?? new Date().toISOString().slice(0, 10),
      });
      toast.success("Deal marked as signed");
      setShowSignedModal(false);
      setPendingStatus(null);
    } catch (error) {
      toast.error("Unable to mark deal as signed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleTakeActionSubmit = async (data: TakeActionSubmission) => {
    const entry: FeedEntry = {
      date: new Date().toISOString().slice(0, 10),
      text: data.message,
      author: "ME",
      action: {
        typeKey: data.actionTypeKey,
        typeLabel: data.actionTypeLabel,
        message: data.message,
        recipients: data.recipients,
        urgency: data.urgency,
        status: "pending",
      },
    };
    const noteBody = [
      `${data.actionTypeLabel}: ${data.message || "No message"}`,
      `Recipients: ${data.recipients.join(", ")}`,
    ].join("\n");
    try {
      if (!deal) throw new Error("Deal not found.");
      if (!profile) throw new Error("Current user profile is required.");
      await createDealActionItem({
        dealId: deal.id,
        audience: role === "deal" ? "internal" : "franchisee",
        title: data.actionTypeLabel,
        body: noteBody,
      });
      await dealActionStore.loadByDeal(deal.id);
      if (data.actionTypeKey === "tour") {
        await createTourBook({
          dealId: deal.id,
          title: `${dealDisplayName} Tour Book${data.tourDate ? ` - ${data.tourDate}` : ""}`,
          status: "generated",
          generatedUrl: `${window.location.origin}/tour-book-generator?deal=${deal.id}`,
        });
      }
      await createDealNote(deal.id, noteBody);
    } catch (error) {
      toast.error("Unable to save action", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      throw error;
    }
    setLocalNotes((prev) => [entry, ...prev]);
  };

  const toggleActionResolved = (idx: number) => {
    setLocalNotes((prev) =>
      prev.map((n, i) =>
        i === idx && n.action
          ? { ...n, action: { ...n.action, status: n.action.status === "pending" ? "resolved" : "pending" } }
          : n
      )
    );
  };

  const resolvePersistentAction = async (item: DealActionItem) => {
    try {
      await dealActionStore.resolve(item.id);
      toast.success("Action item resolved");
    } catch (error) {
      toast.error("Unable to resolve action item", {
        description: error instanceof Error ? error.message : "Please check Supabase permissions.",
      });
    }
  };

  if (!deal) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <p style={{ color: "var(--text-muted)", fontSize: 16 }}>Deal not found.</p>
        <button onClick={() => navigate("/deals")} className="mt-4 text-[14px] font-semibold" style={{ color: "var(--text-orange-ui)" }}>Back to Deals</button>
      </div>
    );
  }

  if (!hasDealAccess) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <p style={{ color: "var(--text-muted)", fontSize: 16 }}>You do not have access to this deal.</p>
        <button onClick={() => navigate(role === "deal" ? "/deal" : "/deals")} className="mt-4 text-[14px] font-semibold" style={{ color: "var(--text-orange-ui)" }}>
          Back
        </button>
      </div>
    );
  }

  const brand = getDealBrandById(deal.brandId);
  const dealDisplayName = deal.name || deal.franchisee;
  const dealSites = getSitesByDeal(deal.id);
  const signedSiteOptions = dealSites.map((site) => ({
    id: site.id,
    label: `${site.address || "Site"}${site.city || site.state ? ` — ${[site.city, site.state].filter(Boolean).join(", ")}` : ""}`,
  }));
  const actionSites = dealSites.map((site) => ({
    id: site.id,
    name: site.address || "Site",
    cityState: [site.city, site.state].filter(Boolean).join(", "),
    sf: site.stage,
  }));
  const days = daysToSign(deal);
  const active = daysActive(deal);

  // Treat empty or placeholder URLs as not set.
  const cleanUrl = (u: string | null | undefined) => {
    const t = (u || "").trim();
    if (!t || t === "#" || t === "https://") return undefined;
    return t;
  };
  const effectiveMarketStudyUrl = cleanUrl(deal.marketStudyLink);
  const userMapUrl = cleanUrl(deal.mapLink);
  const internalDealMapUrl = `/map?deal=${encodeURIComponent(deal.id)}`;
  const effectiveMapUrl =
    userMapUrl?.startsWith("/map") ? userMapUrl : internalDealMapUrl;

  const tourBookUrl = cleanUrl(deal.tourBookLink) ?? `/tour-book-generator?deal=${deal.id}`;

  const links = [
    { key: "territory",    label: "Territory Map", url: cleanUrl(deal.territoryMapLink), icon: Map,         missingTip: "No link added yet" },
    { key: "marketStudy",  label: "Market Study",  url: effectiveMarketStudyUrl,         icon: BarChart3,   missingTip: "No link added yet — edit deal to add" },
    { key: "map",          label: "Map",           url: effectiveMapUrl,                 icon: MapPin,      missingTip: "No link added yet — edit deal to add" },
    { key: "tourBook",     label: "Tour Book",     url: tourBookUrl,                     icon: BookOpen,    missingTip: "Generate a tour book for this deal" },
  ];

  const tabs: { key: DealTab; label: string }[] = [
    { key: "project", label: "Project Details" },
    { key: "topsites", label: "Top Sites" },
    { key: "loi", label: "LOI Comparison" },
    { key: "summary", label: "Deal Summary" },
  ];

  const kpiCards = [
    { label: "Stores Bought", value: deal.storesBought.toString(), icon: Store },
    { label: "Store Count", value: deal.storeCount.toString(), icon: Layers },
    { label: "Days to Sign", value: days !== null ? `${days}d` : "—", icon: Clock },
  ];

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "Signed" && status !== "Signed") {
      setPendingStatus(newStatus as DealStatusNew);
      setShowSignedModal(true);
    } else {
      void persistStatusChange(newStatus as DealStatusNew);
    }
  };

  const handleSaveDealLinks = async (vals: { marketStudyUrl: string; mapUrl: string }) => {
    try {
      await persistDealChanges({
        marketStudyLink: vals.marketStudyUrl,
        mapLink: vals.mapUrl,
      });
      toast.success("Deal links updated");
      setShowLinksEditor(false);
    } catch (error) {
      toast.error("Unable to save deal links", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      throw error;
    }
  };

  return (
    <div className="animate-fade-in">
    <div className="p-4 md:p-7" style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Signed Modal */}
      {showSignedModal && (
        <SignedCompletionModal
          deal={deal}
          onClose={() => { setShowSignedModal(false); setPendingStatus(null); }}
          onConfirm={handleSignedConfirm}
          sites={signedSiteOptions}
        />
      )}

      {/* Documents Modal */}
      <DealDocumentsManagerModal
        open={showDocsModal}
        onClose={() => setShowDocsModal(false)}
        documents={deal.documents}
        editable={role === "admin"}
        onSave={handleSaveDealDocuments}
        dealId={deal.id}
      />

      {/* Header Band */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3" style={{ marginBottom: 0 }}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
            <BrandAvatar name={brand?.name || "?"} size={28} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>{brand?.name}</span>
          </div>
          <h1 className="text-[24px] md:text-[32px]" style={{ fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2, marginTop: 2 }}>{dealDisplayName}</h1>
          <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
            <MapPin className="w-3 h-3" style={{ color: "#E18739" }} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{deal.city}, {deal.state}</span>
            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>·</span>
            <Clock className="w-3 h-3" style={{ color: active > 150 ? "#991b1b" : "var(--text-muted)" }} />
            <span style={{ fontSize: 12, color: active > 150 ? "#991b1b" : "var(--text-tertiary)" }}>Active {active} days</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 md:mt-2">
          <button
            onClick={() => setShowTakeAction(true)}
            className="cta-secondary flex items-center gap-1.5"
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{takeActionLabel}</span>
          </button>
          <DealHealthIndicator deal={deal} size="md" />
          {canEditCurrentDeal ? (
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-auto min-w-[110px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 12px", fontSize: 14, fontWeight: 600 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>{ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <span className="inline-flex items-center" style={{ minHeight: 34, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", padding: "6px 12px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between" style={{ borderBottom: "2px solid var(--border-divider)", marginBottom: 16, marginTop: 12 }}>
        <div className="flex overflow-x-auto shrink-0" style={hiddenScrollbarStyle}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="transition-all whitespace-nowrap shrink-0" style={{
                padding: "8px 16px", fontSize: 14, fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                borderBottom: isActive ? "3px solid #E18739" : "3px solid transparent",
                background: isActive ? "var(--tab-active-bg, rgba(36,60,81,0.04))" : "transparent",
                borderRadius: isActive ? "8px 8px 0 0" : undefined,
                cursor: "pointer", marginBottom: -2,
              }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "rgba(36,60,81,0.03)"; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; } }}>
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* Inline quick links — only show on Project Details tab, desktop only */}
        {activeTab === "project" && (
          <TooltipProvider delayDuration={150}>
            <div className="hidden lg:flex items-center gap-1 shrink-0" style={{ marginBottom: -2 }}>
              {links.map((link) => {
                const triggerStyle: React.CSSProperties = {
                  padding: "6px 10px", borderRadius: 6,
                  fontSize: 12, fontWeight: 500,
                  color: link.url ? "var(--text-secondary)" : "var(--text-muted)",
                  textDecoration: "none", cursor: link.url ? "pointer" : "default",
                  opacity: link.url ? 1 : 0.5,
                };
                const isInternalLink = Boolean(link.url?.startsWith("/"));
                const trigger = link.url ? (
                  <a
                    href={link.url}
                    target={isInternalLink ? "_self" : "_blank"}
                    rel={isInternalLink ? undefined : "noopener"}
                    className="flex items-center gap-1.5 transition-colors hover:text-[var(--text-orange-ui)] whitespace-nowrap"
                    style={triggerStyle}
                  >
                    <link.icon className="w-3.5 h-3.5" />
                    {link.label}
                  </a>
                ) : (
                  <span
                    className="flex items-center gap-1.5 transition-colors hover:text-[var(--text-orange-ui)] whitespace-nowrap"
                    style={triggerStyle}
                  >
                    <link.icon className="w-3.5 h-3.5" />
                    {link.label}
                  </span>
                );
                if (link.url) {
                  return <span key={link.key}>{trigger}</span>;
                }
                return (
                  <Tooltip key={link.key}>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} aria-label={`${link.label} — ${link.missingTip}`}>{trigger}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{link.missingTip}</TooltipContent>
                  </Tooltip>
                );
              })}
              {role === "admin" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowLinksEditor(true)}
                      aria-label="Edit deal links"
                      className="flex items-center justify-center transition-colors hover:text-[var(--text-orange-ui)]"
                      style={{
                        width: 24, height: 24, borderRadius: 8, marginLeft: 4,
                        background: "transparent", border: "1px solid var(--border-subtle)",
                        color: "var(--text-muted)", cursor: "pointer",
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Edit links</TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Edit Links Modal — Admin only */}
      {showLinksEditor && role === "admin" && (
        <DealLinksEditorModal
          dealId={requestedDealId}
          initial={{
            marketStudyUrl: cleanUrl(deal.marketStudyLink) || "",
            mapUrl: cleanUrl(deal.mapLink) || "",
          }}
          onClose={() => setShowLinksEditor(false)}
          onSave={handleSaveDealLinks}
        />
      )}

      {/* ═══ PROJECT DETAILS TAB ═══ */}
      {activeTab === "project" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[65%_35%]" style={{ gap: 24 }}>
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-4">
              {/* Activity Timeline — moved to top, directly below Links bar */}
              <div style={{ ...{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", borderRadius: 16, overflow: "hidden", transition: "background 0.30s ease" }, padding: 0, display: "flex", flexDirection: "column" }}>
                <div className="flex items-center justify-between" style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border-divider)" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--text-muted)" }}>Activity Timeline</span>
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{localNotes.length} entries</span>
                </div>
                <div style={{ padding: "12px 20px 16px" }}>
                <div className="flex gap-2" style={{ marginBottom: 16 }}>
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddNote(); } }}
                    placeholder="Add a note..."
                    className="glass-input flex-1 px-3 py-2 text-[14px]"
                  />
                  <button onClick={handleAddNote} disabled={!newNote.trim()} className="cta-secondary inline-flex items-center gap-1 shrink-0">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                <div className="flex flex-col gap-0">
                  {localNotes.map((note, i) => {
                    const isAction = !!note.action;
                    const isResolved = note.action?.status === "resolved";
                    const ActionIcon =
                      note.action?.typeKey === "update" ? RefreshCw
                      : note.action?.typeKey === "file" ? FileText
                      : note.action?.typeKey === "task" ? ClipboardList
                      : MessageSquare;
                    const accentColor = isAction ? (isResolved ? "#059669" : "#E18739") : "var(--text-primary)";
                    return (
                      <div key={i} className="flex gap-3 relative" style={{ opacity: isResolved ? 0.55 : 1, transition: "opacity 0.2s" }}>
                        <div className="flex flex-col items-center">
                          {isAction ? (
                            <div className="shrink-0" style={{
                              width: 20, height: 20, borderRadius: "50%",
                              background: isResolved ? "rgba(5,150,105,0.12)" : "rgba(225,135,57,0.12)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              marginTop: 2,
                            }}>
                              <ActionIcon className="w-3 h-3" style={{ color: accentColor as string }} />
                            </div>
                          ) : (
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--text-primary)", marginTop: 8 }} />
                          )}
                          {i < localNotes.length - 1 && <div className="w-px flex-1" style={{ background: "var(--border-divider)" }} />}
                        </div>
                        <div className="flex-1 min-w-0" style={{ paddingBottom: 16 }}>
                          {isAction ? (
                            <div style={{
                              borderLeft: `3px solid ${accentColor as string}`,
                              background: isResolved ? "rgba(5,150,105,0.04)" : "rgba(225,135,57,0.04)",
                              borderRadius: 8,
                              padding: "8px 12px",
                            }}>
                              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                                <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{note.action!.typeLabel}</span>
                                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>·</span>
                                <span className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>{new Date(note.date).toLocaleDateString()}</span>
                                <span
                                  className="text-[11px] font-semibold"
                                  style={{
                                    padding: "2px 8px", borderRadius: 999,
                                    background: isResolved ? "rgba(5,150,105,0.15)" : "rgba(225,135,57,0.15)",
                                    color: isResolved ? "#059669" : "#E18739",
                                    textTransform: "uppercase", letterSpacing: "0.06em",
                                  }}
                                >
                                  {isResolved ? "Resolved" : "Pending"}
                                </span>
                              </div>
                              <p className="text-[14px]" style={{ color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 6 }}>{note.text}</p>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                                  Sent to {note.action!.recipients.join(", ")}
                                </span>
                                {!isResolved && (
                                  <button
                                    onClick={() => toggleActionResolved(i)}
                                    className="inline-flex items-center gap-1 text-[12px] font-semibold transition-colors"
                                    style={{
                                      padding: "4px 10px", borderRadius: 8,
                                      border: "1px solid var(--border-subtle)",
                                      background: "var(--bg-card)",
                                      color: "#059669", cursor: "pointer",
                                    }}
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Mark as Resolved
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                                <span className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>{new Date(note.date).toLocaleDateString()}</span>
                                {note.author && <span className="text-[12px] px-2 py-1 rounded-full" style={{ background: "var(--bg-nav-hover)", color: "var(--text-tertiary)" }}>{note.author}</span>}
                              </div>
                              <p className="text-[14px]" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>{note.text}</p>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              </div>

              {/* KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
                {kpiCards.map((m) => (
                  <div
                    key={m.label}
                    className="relative transition-all duration-200 hover:-translate-y-px"
                    style={{
                       background: "var(--stat-card-bg)",
                       border: "0.56px solid var(--stat-card-border)",
                       boxShadow: "var(--shadow-card)",
                       borderRadius: 14,
                      padding: "14px 16px", minHeight: 90,
                      display: "flex", flexDirection: "column", justifyContent: "space-between",
                      transition: "background 0.30s ease, border-color 0.30s ease, box-shadow 0.30s ease",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div style={{ color: "#E18739" }}><m.icon className="w-4 h-4" /></div>
                    </div>
                    <p className="text-[22px] md:text-[32px] truncate" style={{ fontWeight: 800, color: "var(--stat-value-color)", letterSpacing: "-0.03em", lineHeight: 1, marginTop: 6 }}>
                      {m.value}
                    </p>
                    <div className="mt-auto pt-2">
                      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                        {m.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Deal Velocity — FULL WIDTH */}
              <DealVelocityWidget deal={deal} onViewKanban={() => navigate("/deals?view=kanban")} />

              {/* AI Summary */}
              <AIDealSummary deal={deal} />
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-4">
              {/* Document Completion */}
              <DocCompletionWidget deal={deal} onViewAll={() => setShowDocsModal(true)} />

              {/* Deal Info */}
              <div className="glass-card-static" style={{ padding: 20 }}>
                <h3 className="section-label" style={{ marginBottom: 12 }}>Deal Info</h3>
                <div className="flex flex-col gap-2">
                  {[
                    { label: "Broker", value: deal.broker, orange: true },
                    { label: "Associate", value: deal.associate || "—" },
                    { label: "Intro Call", value: deal.dateIntroCall ? new Date(deal.dateIntroCall).toLocaleDateString() : "—" },
                    { label: "Lease Executed", value: deal.dateLeaseSigned ? new Date(deal.dateLeaseSigned).toLocaleDateString() : "—" },
                    { label: "Days Active", value: `${active} days` },
                    { label: "Cell Phone", value: deal.cellPhone },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                      <span className="text-[12px] font-semibold" style={{ color: item.orange ? "var(--text-orange-ui)" : "var(--text-primary)" }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Broker Files moved into Deal Summary tab as a modal trigger */}

              <div className="glass-card-static" style={{ padding: 0 }}>
                <div className="flex items-center justify-between" style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-divider)" }}>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" style={{ color: "#E18739" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>Take Action</span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{dealActionItems.filter((item) => item.status !== "resolved").length} open</span>
                </div>
                <div className="flex flex-col" style={{ padding: 12, gap: 8 }}>
                  {dealActionItems.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)", padding: 8 }}>No action items yet.</p>
                  ) : (
                    dealActionItems.map((item) => {
                      const resolved = item.status === "resolved";
                      return (
                        <div key={item.id} style={{ border: "1px solid var(--border-subtle)", borderLeft: `4px solid ${resolved ? "#059669" : "#E18739"}`, borderRadius: 10, padding: 12, background: "var(--bg-card)", opacity: resolved ? 0.7 : 1 }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{new Date(item.timestamp).toLocaleDateString()} · {item.audience}</p>
                            </div>
                            <span className="text-[11px] font-semibold" style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: resolved ? "#059669" : "#E18739" }}>
                              {resolved ? "Resolved" : "Pending"}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-line text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.body}</p>
                          {!resolved && (
                            <button
                              type="button"
                              onClick={() => void resolvePersistentAction(item)}
                              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold"
                              style={{ color: "#059669" }}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Mark as Resolved
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Deal Documents */}
              <div className="glass-card-static" style={{ padding: 0 }}>
                <div className="flex items-center justify-between" style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-divider)" }}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" style={{ color: "#243c51" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>Deal Documents</span>
                    </div>
                    <span style={{ fontSize: 12, background: "rgba(36,60,81,0.07)", borderRadius: 4, padding: "4px 8px", color: "var(--text-muted)", display: "inline-block", marginTop: 4 }}>
                      Legal & Business
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#065f46" }}>
                      {Object.values(deal.documents).filter(Boolean).length} of {ALL_DOC_KEYS.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDocsModal(true)}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-orange-ui)",
                        background: "rgba(225,135,57,0.08)",
                        border: "1px solid rgba(225,135,57,0.16)",
                        borderRadius: 999,
                        padding: "5px 10px",
                        cursor: "pointer",
                      }}
                    >
                      {role === "admin" ? "Manage" : "View"}
                    </button>
                  </div>
                </div>
                {DEAL_DOCUMENT_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div style={{ padding: "8px 20px 4px" }}>
                      <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-faint)" }}>{group.label}</span>
                    </div>
                    {group.docs.map(({ key, label }) => {
                      const val = deal.documents[key];
                      const hasDoc = !!val;
                      return (
                        <div key={key} className="flex items-center justify-between transition-colors hover:bg-[rgba(36,60,81,0.02)]" style={{ padding: "8px 20px", borderBottom: "1px solid var(--border-divider)" }}>
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3" style={{ color: "#243c51" }} />
                            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                          </div>
                          {hasDoc ? (
                            <div className="flex items-center gap-2">
                              <Check className="w-3 h-3" style={{ color: "#065f46" }} />
                              <a href={val} target="_blank" rel="noopener" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)" }}>View</a>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", background: "rgba(100,116,139,0.08)", borderRadius: 9999, padding: "4px 8px" }}>
                              Not filed
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {deal.corporate && deal.corporateComments && (
                <div className="glass-card-static" style={{ padding: 20 }}>
                  <h3 className="section-label" style={{ marginBottom: 8 }}>Corporate Comments</h3>
                  <p className="text-[14px]" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>{deal.corporateComments}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ TOP SITES TAB ═══ */}
      {activeTab === "topsites" && <TopSitesTab deal={deal} />}

      {/* ═══ LOI COMPARISON TAB ═══ */}
      {activeTab === "loi" && <LOIComparisonTab deal={deal} />}

      {/* ═══ DEAL SUMMARY TAB ═══ */}
      {activeTab === "summary" && <DealSummaryTab deal={deal} />}

      {/* Take Action Drawer */}
      <TakeActionDrawer
        open={showTakeAction}
        onClose={() => setShowTakeAction(false)}
        dealName={dealDisplayName}
        broker={deal.broker}
        sites={actionSites}
        dealId={deal.id}
        onSubmit={handleTakeActionSubmit}
      />
    </div>
    </div>
  );
}
