import { useEffect, useRef, useState } from "react";
import { X, Send, RefreshCw, FileText, MessageSquare, Sparkles, Users, Shield, BarChart3, BookOpen, Info } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { teamMembers, type TeamMember } from "@/data/teamData";

export interface TakeActionSubmission {
  actionTypeKey: string;
  actionTypeLabel: string;
  recipients: string[]; // member names
  message: string;
  urgency: string;
  siteIds: string[];
  tourDate: string;
  reportFormat: "pdf" | "csv";
  reportSections: string[];
}

interface TakeActionDrawerProps {
  open: boolean;
  onClose: () => void;
  dealName: string;
  broker: string;
  dealId?: string;
  sites?: ActionSite[];
  onSubmit?: (data: TakeActionSubmission) => void | Promise<void>;
}

type ActionKey = "update" | "file" | "note" | "custom" | "report" | "tour";

const ACTION_TYPES: { key: ActionKey; label: string; icon: typeof RefreshCw }[] = [
  { key: "update", label: "Request Update", icon: RefreshCw },
  { key: "file", label: "Request File", icon: FileText },
  { key: "note", label: "Send Note", icon: MessageSquare },
  { key: "custom", label: "Custom", icon: Sparkles },
  { key: "report", label: "Generate Report", icon: BarChart3 },
  { key: "tour", label: "Tour Book", icon: BookOpen },
];

interface ReportOption { key: string; label: string; desc: string; }
const REPORT_OPTIONS: ReportOption[] = [
  { key: "summary", label: "Deal Summary", desc: "All deals for this brand/deal" },
  { key: "pipeline", label: "Pipeline Status", desc: "Current stage breakdown" },
  { key: "active", label: "Active Deals List", desc: "Table of active deals" },
  { key: "signed", label: "Signed Deals List", desc: "Table of signed deals" },
  { key: "sites", label: "Site Details", desc: "Top sites per deal" },
  { key: "activity", label: "Activity Log", desc: "Recent activity entries" },
];

interface ActionSite {
  id: string;
  name: string;
  cityState: string;
  sf: string;
}

const ROLE_COLORS: Record<TeamMember["role"], string> = {
  Admin: "#E18739",
  Franchisor: "#3b82f6",
  Franchisee: "#059669",
};

const MAX_CHARS = 500;
const MIN_TA_HEIGHT = 80;
const MAX_TA_HEIGHT = 160;

export function TakeActionDrawer({ open, onClose, dealName, dealId, sites = [], onSubmit }: TakeActionDrawerProps) {
  const [actionType, setActionType] = useState<ActionKey | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [reportSelected, setReportSelected] = useState<string[]>(["summary", "pipeline", "active", "signed"]);
  const [reportFormat, setReportFormat] = useState<"pdf" | "csv">("pdf");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [tourSites, setTourSites] = useState<string[]>([]);
  const [tourDate, setTourDate] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const role = useUserRole();
  const navigate = useNavigate();
  const isFranchisee = role === "franchisee";

  const allSelected = teamMembers.length > 0 && selectedTeam.length === teamMembers.length;
  const allSitesSelected = sites.length > 0 && tourSites.length === sites.length;

  // auto-grow textarea
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = `${MIN_TA_HEIGHT}px`;
    const next = Math.min(MAX_TA_HEIGHT, Math.max(MIN_TA_HEIGHT, el.scrollHeight));
    el.style.height = `${next}px`;
  }, [message, open, actionType]);

  const reset = () => {
    setActionType(null);
    setCustomLabel("");
    setSelectedTeam([]);
    setMessage("");
    setReportSelected(["summary", "pipeline", "active", "signed"]);
    setReportFormat("pdf");
    setReportFrom("");
    setReportTo("");
    setTourSites([]);
    setTourDate("");
  };

  const handleSelectAll = () => {
    if (allSelected) setSelectedTeam([]);
    else setSelectedTeam(teamMembers.map((t) => t.id));
  };

  const toggleMember = (id: string) => {
    setSelectedTeam((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const toggleReport = (k: string) =>
    setReportSelected((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const toggleSite = (id: string) =>
    setTourSites((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const resolvedLabel =
    actionType === "custom"
      ? customLabel.trim() || "Custom Action"
      : ACTION_TYPES.find((a) => a.key === actionType)?.label ?? "";

  const hasRecipients = isFranchisee || selectedTeam.length > 0;
  const canSend =
    !!actionType &&
    hasRecipients &&
    (actionType !== "custom" || customLabel.trim().length > 0) &&
    (actionType !== "tour" || tourSites.length > 0);

  const handleSend = async () => {
    if (!actionType) return;
    if (actionType === "tour" && tourSites.length === 0) {
      toast.error("Select at least one site to generate a tour book");
      return;
    }
    if (!hasRecipients) {
      toast.error(
        actionType === "report"
          ? "Select at least one recipient to send the report"
          : actionType === "tour"
            ? "Select at least one recipient to send"
            : "Select at least one recipient",
      );
      return;
    }
    const recipientNames = isFranchisee
      ? ["Reimagine Team"]
      : teamMembers.filter((m) => selectedTeam.includes(m.id)).map((m) => m.name);
    try {
      await onSubmit?.({
        actionTypeKey: actionType,
        actionTypeLabel: resolvedLabel,
        recipients: recipientNames,
        message: message.trim(),
        urgency: "normal",
        siteIds: actionType === "tour" ? tourSites : [],
        tourDate,
        reportFormat,
        reportSections: actionType === "report" ? reportSelected : [],
      });
    } catch {
      return;
    }
    if (actionType === "report") {
      toast.success(
        reportFormat === "pdf"
          ? `Report generated and sent to ${recipientNames.length} recipient${recipientNames.length === 1 ? "" : "s"}`
          : `CSV export sent to ${recipientNames.length} recipient${recipientNames.length === 1 ? "" : "s"}`,
      );
    } else if (actionType === "tour") {
      toast.success(`Tour book generated and sent to ${recipientNames.length} recipient${recipientNames.length === 1 ? "" : "s"}`);
    } else {
      toast.success(`Action sent to ${recipientNames.length} ${recipientNames.length === 1 ? "person" : "people"}`);
    }
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  const selectedMembers = teamMembers.filter((m) => selectedTeam.includes(m.id));
  const charCount = message.length;

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)" }}
        onClick={handleClose}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100vw)",
          zIndex: 1001,
          background: "hsl(var(--background))",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s ease",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-divider)" }}
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #E18739, #c4622a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send className="w-4 h-4" style={{ color: "#fff" }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
                Take Action
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{dealName}</p>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="themed-scrollbar flex-1 overflow-y-auto" style={{ padding: "16px 24px 24px", background: "var(--bg-main)" }}>
          {/* Action type — segmented control */}
          <div style={{ marginBottom: 24 }}>
            <span className="section-label" style={{ display: "block", marginBottom: 8 }}>
              Action type
            </span>
            <div
              role="tablist"
              className="grid grid-cols-3"
              style={{
                gap: 4,
                padding: 4,
                borderRadius: 12,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {ACTION_TYPES.map((a) => {
                const sel = actionType === a.key;
                return (
                  <button
                    key={a.key}
                    role="tab"
                    aria-selected={sel}
                    onClick={() => setActionType(a.key)}
                    className="flex flex-col items-center justify-center transition-all"
                    style={{
                      gap: 4,
                      padding: "8px 4px",
                      borderRadius: 8,
                      border: "none",
                      background: sel ? "hsl(var(--background))" : "transparent",
                      boxShadow: sel ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                      color: sel ? "#E18739" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <a.icon className="w-4 h-4" />
                    <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, textAlign: "center" }}>
                      {a.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {actionType === "custom" && (
              <input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Custom action label..."
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "8px 12px",
                  fontSize: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            )}
          </div>

          {/* Report settings */}
          {actionType === "report" && (
            <div style={{ marginBottom: 24 }}>
              <span className="section-label" style={{ display: "block", marginBottom: 8 }}>
                Report Settings
              </span>
              <div style={{ borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", overflow: "hidden" }}>
                {REPORT_OPTIONS.map((opt, i) => {
                  const sel = reportSelected.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleReport(opt.key)}
                      className="flex items-center w-full text-left transition-colors"
                      style={{
                        gap: 12,
                        padding: "8px 12px",
                        minHeight: 40,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        borderBottom: i < REPORT_OPTIONS.length - 1 ? "1px solid rgba(36,60,81,0.06)" : "none",
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                        border: sel ? "none" : "1.5px solid var(--border-input)",
                        background: sel ? "rgb(36,60,81)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {sel && (
                          <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.2 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Format segmented control */}
              <div className="grid grid-cols-2" style={{ gap: 4, marginTop: 12, padding: 4, borderRadius: 12, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                {([
                  { k: "pdf" as const, label: "PDF Report", icon: FileText },
                  { k: "csv" as const, label: "CSV Export", icon: BarChart3 },
                ]).map((f) => {
                  const sel = reportFormat === f.k;
                  return (
                    <button
                      key={f.k}
                      type="button"
                      onClick={() => setReportFormat(f.k)}
                      className="flex items-center justify-center transition-all"
                      style={{
                        gap: 6, padding: "8px 4px", borderRadius: 8, border: "none",
                        background: sel ? "hsl(var(--background))" : "transparent",
                        boxShadow: sel ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                        color: sel ? "#E18739" : "var(--text-muted)",
                        cursor: "pointer", fontSize: 12, fontWeight: 600,
                      }}
                    >
                      <f.icon className="w-3.5 h-3.5" />
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Date range */}
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Date Range</span>
                <div className="grid grid-cols-2" style={{ gap: 8 }}>
                  <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} placeholder="All time"
                    style={{ height: 32, padding: "0 10px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }} />
                  <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} placeholder="All time"
                    style={{ height: 32, padding: "0 10px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }} />
                </div>
              </div>
            </div>
          )}

          {/* Tour book settings */}
          {actionType === "tour" && (
            <div style={{ marginBottom: 24 }}>
              <span className="section-label" style={{ display: "block", marginBottom: 8 }}>
                Tour Book Settings
              </span>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Select sites to include</span>
                <button
                  type="button"
                  onClick={() => setTourSites(allSitesSelected ? [] : sites.map((s) => s.id))}
                  style={{ fontSize: 11, fontWeight: 600, color: "#E18739", background: "none", border: "none", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em" }}
                >
                  {allSitesSelected ? "Clear" : "Select all"}
                </button>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", overflow: "hidden" }}>
                {sites.length === 0 && (
                  <div style={{ padding: 12, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    No real sites are attached to this deal yet.
                  </div>
                )}
                {sites.map((s, i) => {
                  const sel = tourSites.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSite(s.id)}
                      className="flex items-center w-full text-left transition-colors"
                      style={{
                        gap: 8, padding: "8px 12px", minHeight: 40, border: "none", background: "transparent", cursor: "pointer",
                        borderBottom: i < sites.length - 1 ? "1px solid rgba(36,60,81,0.06)" : "none",
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                        border: sel ? "none" : "1.5px solid var(--border-input)",
                        background: sel ? "rgb(36,60,81)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {sel && (
                          <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.cityState}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 6px", borderRadius: 999, background: "rgba(36,60,81,0.06)" }}>{s.sf}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Tour Date</span>
                <input
                  value={tourDate}
                  onChange={(e) => setTourDate(e.target.value)}
                  placeholder="e.g. January 20, 2026"
                  style={{ width: "100%", height: 36, padding: "0 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }}
                />
              </div>

              <div className="flex items-start" style={{ gap: 6, marginTop: 12 }}>
                <Info className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)", marginTop: 2 }} />
                <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                  This will generate a tour book PDF using the selected sites and send it to the chosen recipients. Full customization available in the{" "}
                  <button
                    type="button"
                    onClick={() => { reset(); onClose(); navigate(`/tour-book-generator${dealId ? `?deal=${dealId}` : ""}`); }}
                    style={{ background: "none", border: "none", padding: 0, color: "#E18739", fontWeight: 600, cursor: "pointer", fontSize: 11 }}
                  >
                    Tour Book Generator
                  </button>
                  .
                </p>
              </div>
            </div>
          )}

          {/* Recipients */}
          <div style={{ marginBottom: 24 }}>
            {isFranchisee ? (
              <>
                <span className="section-label" style={{ display: "block", marginBottom: 8 }}>
                  Send to
                </span>
                <div
                  className="flex items-center"
                  style={{
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-card)",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #E18739, #c4622a)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Shield style={{ width: 16, height: 16, color: "#fff" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      Reimagine Team
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      Your request will be routed to your Reimagine contact.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span className="section-label">Send to</span>
              <button
                onClick={handleSelectAll}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#E18739",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="flex flex-col" style={{ gap: 4 }}>
              {teamMembers.length === 0 && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-card)",
                    color: "var(--text-muted)",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  No team members found in Supabase profiles.
                </div>
              )}
              {teamMembers.map((member) => {
                const selected = selectedTeam.includes(member.id);
                const roleColor = ROLE_COLORS[member.role];
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className="flex items-center transition-all"
                    style={{
                      gap: 12,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: selected ? "rgba(225,135,57,0.06)" : "transparent",
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        flexShrink: 0,
                        border: selected ? "none" : "1.5px solid var(--border-input)",
                        background: selected ? "#E18739" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: `${roleColor}24`,
                        color: roleColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {member.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", display: "block" }}>
                        {member.name}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{member.role}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 12 }}>
                {selectedMembers.map((m) => {
                  const roleColor = ROLE_COLORS[m.role];
                  return (
                    <div
                      key={`chip-${m.id}`}
                      className="flex items-center"
                      style={{
                        gap: 8,
                        padding: "4px 12px 4px 4px",
                        borderRadius: 999,
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: `${roleColor}24`,
                          color: roleColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {m.initials}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{m.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMember(m.id);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          color: "var(--text-muted)",
                        }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
              </>
            )}
          </div>

          {/* Message */}
          <div>
            <span className="section-label" style={{ display: "block", marginBottom: 8 }}>
              Message
            </span>
            <textarea
              ref={taRef}
              value={message}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS) setMessage(e.target.value);
              }}
              placeholder="Add a message or details..."
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 14,
                borderRadius: 12,
                border: "1px solid var(--border-input)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                resize: "none",
                outline: "none",
                lineHeight: 1.5,
                fontFamily: "inherit",
                minHeight: MIN_TA_HEIGHT,
                maxHeight: MAX_TA_HEIGHT,
                overflowY: "auto",
                display: "block",
              }}
            />
            <div className="flex justify-end" style={{ marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {charCount} / {MAX_CHARS}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="shrink-0 flex items-center justify-between"
          style={{ padding: "16px 24px", borderTop: "1px solid var(--border-divider)", gap: 12 }}
        >
          <div className="flex items-center" style={{ gap: 8 }}>
            {actionType === "report" ? (
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#E18739",
                background: "rgba(225,135,57,0.12)", padding: "4px 10px", borderRadius: 999,
              }}>
                {reportFormat === "pdf" ? "PDF Report" : "CSV Export"}
              </span>
            ) : actionType === "tour" ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {tourSites.length} site{tourSites.length !== 1 ? "s" : ""} selected
              </span>
            ) : (
              <>
                <Users className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {selectedTeam.length} recipient{selectedTeam.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: "8px 16px",
                borderRadius: 12,
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="cta-primary flex items-center"
              style={{
                gap: 8,
                opacity: canSend ? 1 : 0.4,
                pointerEvents: canSend ? "auto" : "none",
              }}
            >
              <Send className="w-4 h-4" />
              {actionType === "report" || actionType === "tour" ? "Generate & Send" : "Send"}
            </button>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
