import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, ExternalLink, Inbox, MessageSquare, RefreshCw, Search, Send } from "lucide-react";
import { toast } from "sonner";
import {
  adminTakeActionStore,
  isOpenAdminAction,
  type AdminActionSource,
  type AdminTakeActionItem,
} from "@/lib/adminTakeActionStore";

type StatusFilter = "open" | "resolved" | "all";
type SourceFilter = "all" | AdminActionSource;

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusLabel(item: AdminTakeActionItem): string {
  if (item.status === "pending") return "Pending";
  return item.status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusStyles(item: AdminTakeActionItem) {
  if (isOpenAdminAction(item)) {
    return {
      background: "rgba(225,135,57,0.14)",
      color: "#E18739",
      border: "1px solid rgba(225,135,57,0.24)",
    };
  }
  if (item.status === "resolved") {
    return {
      background: "rgba(16,185,129,0.12)",
      color: "#10B981",
      border: "1px solid rgba(16,185,129,0.22)",
    };
  }
  return {
    background: "var(--bg-muted)",
    color: "var(--text-muted)",
    border: "1px solid var(--border-subtle)",
  };
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        minHeight: 260,
        borderRadius: 16,
        border: "1px dashed var(--border-subtle)",
        background: "var(--bg-surface)",
        color: "var(--text-muted)",
        padding: 24,
      }}
    >
      <Inbox style={{ width: 34, height: 34, marginBottom: 12, opacity: 0.72 }} />
      <h2 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>
        {hasFilters ? "No matching action items" : "No Take Action messages yet"}
      </h2>
      <p style={{ fontSize: 13, marginTop: 6, maxWidth: 420 }}>
        {hasFilters
          ? "Adjust the filters or search term to see more requests."
          : "Requests submitted from deal or brand Take Action flows will appear here."}
      </p>
    </div>
  );
}

export default function AdminActionItems() {
  const [items, setItems] = useState<AdminTakeActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const loadItems = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const loaded = await adminTakeActionStore.loadAll();
      setItems(loaded);
      setSelectedId((current) => current ?? loaded[0]?.id ?? null);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load Take Action messages.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === "open" && !isOpenAdminAction(item)) return false;
      if (statusFilter === "resolved" && item.status !== "resolved") return false;
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      if (!term) return true;
      return [
        item.title,
        item.body,
        item.contextName,
        item.requestedBy,
        item.recipients.join(" "),
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [items, search, sourceFilter, statusFilter]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedId],
  );
  const selectedItemId = selectedItem?.id ?? null;
  const selectedItemStatus = selectedItem?.status ?? null;
  const selectedItemResponseBody = selectedItem?.responseBody ?? null;

  useEffect(() => {
    if (!selectedItemId) {
      setResponseText("");
      return;
    }
    setSelectedId(selectedItemId);
    setResponseText(selectedItemStatus === "resolved" ? selectedItemResponseBody ?? "" : "");
  }, [selectedItemId, selectedItemResponseBody, selectedItemStatus]);

  const stats = useMemo(() => {
    const open = items.filter(isOpenAdminAction).length;
    const resolved = items.filter((item) => item.status === "resolved").length;
    return {
      total: items.length,
      open,
      resolved,
    };
  }, [items]);

  const handleRespond = async () => {
    if (!selectedItem || responding) return;
    const trimmed = responseText.trim();
    if (!trimmed) {
      toast.error("Write a response before resolving this item.");
      return;
    }
    setResponding(true);
    try {
      await adminTakeActionStore.respond(selectedItem, trimmed);
      toast.success("Response saved and item resolved.");
      const loaded = await adminTakeActionStore.loadAll();
      setItems(loaded);
      setSelectedId(selectedItem.id);
    } catch (error) {
      console.error(error);
      toast.error("Unable to save the response.");
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div
        className="p-4 md:p-7"
        style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1500, margin: "0 auto" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Action Items
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
              Review and respond to Take Action requests from deals and brand dashboards.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadItems(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2"
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 700,
              cursor: refreshing ? "wait" : "pointer",
              opacity: refreshing ? 0.72 : 1,
            }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
          {[
            { label: "Open", value: stats.open, icon: Clock3, color: "#E18739" },
            { label: "Resolved", value: stats.resolved, icon: CheckCircle2, color: "#10B981" },
            { label: "Total", value: stats.total, icon: Inbox, color: "#60A5FA" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-card)",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {stat.label}
                </span>
                <stat.icon style={{ width: 18, height: 18, color: stat.color }} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginTop: 12 }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-card)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search action items..."
                className="glass-input w-full pl-9 pr-4 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              {([
                ["open", "Open"],
                ["resolved", "Resolved"],
                ["all", "All"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  style={{
                    height: 38,
                    padding: "0 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border-subtle)",
                    background: statusFilter === value ? "#243c51" : "var(--bg-card)",
                    color: statusFilter === value ? "#ffffff" : "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {([
                ["all", "All Sources"],
                ["deal", "Deals"],
                ["brand", "Brands"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSourceFilter(value)}
                  style={{
                    height: 38,
                    padding: "0 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border-subtle)",
                    background: sourceFilter === value ? "rgba(225,135,57,0.16)" : "var(--bg-card)",
                    color: sourceFilter === value ? "#E18739" : "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div
            className="flex min-h-[320px] items-center justify-center"
            style={{ color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}
          >
            Loading Take Action messages...
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState hasFilters={items.length > 0} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.88fr)_minmax(420px,0.62fr)]" style={{ gap: 18, alignItems: "start" }}>
            <section
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-card)",
                borderRadius: 16,
                padding: 12,
              }}
            >
              <div className="flex flex-col" style={{ gap: 10 }}>
                {filteredItems.map((item) => {
                  const active = selectedItem?.id === item.id;
                  return (
                    <button
                      key={`${item.source}-${item.id}`}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        textAlign: "left",
                        borderRadius: 12,
                        border: active ? "1px solid rgba(225,135,57,0.34)" : "1px solid var(--border-subtle)",
                        background: active ? "rgba(225,135,57,0.08)" : "var(--bg-card)",
                        padding: 14,
                        cursor: "pointer",
                      }}
                    >
                      <div className="flex items-start justify-between" style={{ gap: 12 }}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#E18739", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                              {item.sourceLabel}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(item.timestamp)}</span>
                          </div>
                          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginTop: 6 }}>
                            {item.title}
                          </h2>
                          <p className="truncate" style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                            {item.contextName}
                          </p>
                        </div>
                        <span
                          style={{
                            ...getStatusStyles(item),
                            borderRadius: 999,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {statusLabel(item)}
                        </span>
                      </div>
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: 13,
                          lineHeight: 1.5,
                          marginTop: 10,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.body || "No message body."}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-card)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {selectedItem && (
                <>
                  <div
                    className="flex items-start justify-between"
                    style={{ gap: 16, padding: 20, borderBottom: "1px solid var(--border-divider)" }}
                  >
                    <div>
                      <div className="flex items-center" style={{ gap: 8 }}>
                        <MessageSquare style={{ width: 18, height: 18, color: "#E18739" }} />
                        <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>
                          {selectedItem.sourceLabel} Request
                        </span>
                      </div>
                      <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginTop: 10 }}>
                        {selectedItem.title}
                      </h2>
                    </div>
                    <span
                      style={{
                        ...getStatusStyles(selectedItem),
                        borderRadius: 999,
                        padding: "5px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusLabel(selectedItem)}
                    </span>
                  </div>

                  <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                      {[
                        { label: "Requested By", value: selectedItem.requestedBy },
                        { label: "Created", value: formatDateTime(selectedItem.timestamp) },
                        { label: "Recipients", value: selectedItem.recipients.length > 0 ? selectedItem.recipients.join(", ") : "None listed" },
                        { label: "Urgency", value: selectedItem.urgency ?? "normal" },
                      ].map((detail) => (
                        <div key={detail.label}>
                          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            {detail.label}
                          </p>
                          <p style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 4, overflowWrap: "anywhere" }}>
                            {detail.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                        Context
                      </p>
                      <Link
                        to={selectedItem.contextHref}
                        className="inline-flex items-center"
                        style={{ gap: 6, color: "#E18739", fontSize: 14, fontWeight: 800, marginTop: 6 }}
                      >
                        {selectedItem.contextName}
                        <ExternalLink style={{ width: 14, height: 14 }} />
                      </Link>
                    </div>

                    <div>
                      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                        Message
                      </p>
                      <div
                        style={{
                          borderRadius: 12,
                          border: "1px solid var(--border-subtle)",
                          background: "var(--bg-card)",
                          color: "var(--text-secondary)",
                          fontSize: 14,
                          lineHeight: 1.6,
                          padding: 14,
                          marginTop: 8,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {selectedItem.body || "No message body."}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between" style={{ gap: 12 }}>
                        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                          Admin Response
                        </p>
                        {selectedItem.respondedAt && (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {formatDateTime(selectedItem.respondedAt)}
                          </span>
                        )}
                      </div>
                      {selectedItem.status === "resolved" ? (
                        <div
                          style={{
                            borderRadius: 12,
                            border: "1px solid var(--border-subtle)",
                            background: "rgba(16,185,129,0.07)",
                            color: "var(--text-secondary)",
                            fontSize: 14,
                            lineHeight: 1.6,
                            padding: 14,
                            marginTop: 8,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {selectedItem.responseBody || "Resolved before response text was enabled."}
                          {selectedItem.respondedBy && (
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
                              Responded by {selectedItem.respondedBy}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <textarea
                            value={responseText}
                            onChange={(event) => setResponseText(event.target.value)}
                            placeholder="Write the response to this request..."
                            rows={6}
                            style={{
                              width: "100%",
                              borderRadius: 12,
                              border: "1px solid var(--border-input)",
                              background: "var(--bg-card)",
                              color: "var(--text-primary)",
                              fontSize: 14,
                              lineHeight: 1.5,
                              padding: 12,
                              marginTop: 8,
                              outline: "none",
                              resize: "vertical",
                            }}
                          />
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                              Saves in the app and marks the item resolved. Email can be enabled later with Resend.
                            </p>
                            <button
                              type="button"
                              onClick={handleRespond}
                              disabled={responding}
                              className="inline-flex items-center justify-center"
                              style={{
                                gap: 8,
                                height: 40,
                                padding: "0 16px",
                                borderRadius: 10,
                                border: "none",
                                background: "#243c51",
                                color: "#ffffff",
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: responding ? "wait" : "pointer",
                                opacity: responding ? 0.72 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <Send style={{ width: 15, height: 15 }} />
                              {responding ? "Saving..." : "Save Response"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
