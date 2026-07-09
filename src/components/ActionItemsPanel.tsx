import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Inbox,
  Clock,
  CheckCircle2,
  RefreshCw,
  FileText,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { brandActionStore, type BrandActionItem } from "@/lib/brandActionStore";
import { toast } from "sonner";

interface ActionItemsPanelProps {
  open: boolean;
  onClose: () => void;
  items: BrandActionItem[];
  contextLabel?: string; // brand or deal name
  /** When true, deal name on each row is clickable */
  enableDealLinks?: boolean;
  /** Optional resolver for deal id from a deal name (used for navigation). */
  resolveDealHref?: (dealName: string) => string | null;
}

type FilterTab = "all" | "pending" | "resolved";

const ICON_BY_TYPE: Record<string, typeof RefreshCw> = {
  update: RefreshCw,
  file: FileText,
  note: MessageSquare,
  general: MessageSquare,
  task: Sparkles,
  custom: Sparkles,
};

const ROLE_PALETTE = ["#E18739", "#3b82f6", "#059669", "#6d3a7a", "#d97706"];

function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ROLE_PALETTE[h % ROLE_PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function MessageBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // Truncate to ~140 chars when collapsed (close to 2 lines on most widths).
  const limit = 140;
  const tooLong = text.length > limit;
  const display = expanded || !tooLong ? text : text.slice(0, limit).trimEnd() + "…";

  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-primary)",
          lineHeight: 1.5,
          ...(expanded || !tooLong
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }),
        }}
      >
        {display}
      </p>
      {tooLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 4,
            fontSize: 12,
            fontWeight: 600,
            color: "#E18739",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export function ActionItemsPanel({
  open,
  onClose,
  items,
  contextLabel,
  enableDealLinks = false,
  resolveDealHref,
}: ActionItemsPanelProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending").length;
    const resolved = items.filter((i) => i.status === "resolved").length;
    return { all: items.length, pending, resolved };
  }, [items]);

  const sorted = useMemo(() => {
    // Pending first (most recent first), then resolved (most recent first).
    const p = items
      .filter((i) => i.status === "pending")
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    const r = items
      .filter((i) => i.status === "resolved")
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    if (filter === "pending") return p;
    if (filter === "resolved") return r;
    return [...p, ...r];
  }, [items, filter]);

  if (!open) return null;

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "resolved", label: "Resolved", count: counts.resolved },
  ];

  const emptyCopy: Record<FilterTab, { title: string; sub: string }> = {
    all: { title: "No action items", sub: contextLabel ? `Nothing logged for ${contextLabel} yet.` : "Nothing here yet." },
    pending: { title: "No pending actions", sub: contextLabel ? `No pending actions for ${contextLabel}.` : "Everything is resolved." },
    resolved: { title: "No resolved items", sub: "Resolved actions will appear here." },
  };

  return (
    <>
      {/* Overlay — translucent so background remains visible */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.32)",
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(400px, 100vw)",
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
              <Inbox className="w-4 h-4" style={{ color: "#fff" }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
                Action Items
              </h2>
              {contextLabel && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{contextLabel}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Filter tabs */}
        <div
          className="shrink-0"
          style={{ padding: "12px 24px", borderBottom: "1px solid var(--border-divider)" }}
        >
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
            {TABS.map((t) => {
              const sel = filter === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={sel}
                  onClick={() => setFilter(t.key)}
                  className="flex items-center justify-center transition-all"
                  style={{
                    gap: 4,
                    padding: "8px 4px",
                    borderRadius: 8,
                    border: "none",
                    background: sel ? "hsl(var(--background))" : "transparent",
                    boxShadow: sel ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    color: sel ? "#E18739" : "var(--text-muted)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "0 8px",
                      borderRadius: 999,
                      background: sel ? "rgba(225,135,57,0.15)" : "var(--bg-card)",
                      color: sel ? "#E18739" : "var(--text-muted)",
                    }}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px 24px" }}>
          {sorted.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{ padding: 32, gap: 12, height: "100%" }}
            >
              <Inbox className="w-8 h-8" style={{ color: "var(--text-muted)", opacity: 0.5 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {emptyCopy[filter].title}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {emptyCopy[filter].sub}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {sorted.map((item) => {
                const Icon = ICON_BY_TYPE[item.actionTypeKey] || MessageSquare;
                const isPending = item.status === "pending";
                const accent = isPending ? "#E18739" : "#059669";
                const dealHref = enableDealLinks && item.dealName
                  ? resolveDealHref?.(item.dealName) ?? null
                  : null;

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-card)",
                      borderLeft: `4px solid ${accent}`,
                      opacity: isPending ? 1 : 0.7,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {/* Top row: icon + label + status pill */}
                    <div className="flex items-center justify-between" style={{ gap: 8 }}>
                      <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
                        <Icon className="w-4 h-4" style={{ color: accent, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.actionTypeLabel}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: isPending ? "rgba(225,135,57,0.15)" : "rgba(5,150,105,0.15)",
                          color: accent,
                          flexShrink: 0,
                        }}
                      >
                        {isPending ? "Pending" : "Resolved"}
                      </span>
                    </div>

                    {/* Deal name (clickable when applicable) */}
                    {item.dealName && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Deal:{" "}
                        {dealHref ? (
                          <button
                            type="button"
                            onClick={() => {
                              navigate(dealHref);
                              onClose();
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#E18739",
                              cursor: "pointer",
                              textDecoration: "underline",
                              textUnderlineOffset: 2,
                            }}
                          >
                            {item.dealName}
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.dealName}</span>
                        )}
                      </div>
                    )}

                    {/* Message */}
                    {item.message && <MessageBlock text={item.message} />}

                    {item.responseBody && (
                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(5,150,105,0.18)",
                          background: "rgba(5,150,105,0.08)",
                          padding: 10,
                        }}
                      >
                        <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Reimagine Response
                          </span>
                          {item.respondedAt && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                              {formatTimestamp(item.respondedAt)}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          {item.responseBody}
                        </p>
                      </div>
                    )}

                    {/* Meta row: avatars + timestamp + resolve action */}
                    <div className="flex items-center justify-between flex-wrap" style={{ gap: 8 }}>
                      <div className="flex items-center" style={{ gap: 12 }}>
                        {/* Overlapping recipient avatars */}
                        <div className="flex items-center" style={{ paddingLeft: 4 }}>
                          {item.recipients.slice(0, 3).map((name, idx) => {
                            const c = colorForName(name);
                            return (
                              <div
                                key={`${item.id}-${name}-${idx}`}
                                title={name}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: "50%",
                                  background: `${c}24`,
                                  color: c,
                                  border: "2px solid hsl(var(--background))",
                                  marginLeft: idx === 0 ? -4 : -8,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                {initials(name)}
                              </div>
                            );
                          })}
                          {item.recipients.length > 3 && (
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                background: "var(--bg-surface)",
                                color: "var(--text-muted)",
                                border: "2px solid hsl(var(--background))",
                                marginLeft: -8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              +{item.recipients.length - 3}
                            </div>
                          )}
                        </div>
                        <span
                          className="flex items-center"
                          style={{ gap: 4, fontSize: 11, color: "var(--text-muted)" }}
                        >
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                      {isPending && (
                        <button
                          onClick={() => {
                            void brandActionStore.resolve(item.id).catch((err) => {
                              toast.error("Unable to resolve action item", {
                                description: err instanceof Error ? err.message : "Check Supabase schema and permissions.",
                              });
                            });
                          }}
                          className="flex items-center transition-all"
                          style={{
                            gap: 4,
                            padding: "4px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--border-subtle)",
                            background: "transparent",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#059669",
                            cursor: "pointer",
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Mark as Resolved
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
