import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, Clock3, RefreshCw, Search, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { SupabaseHttpError } from "@/infrastructure/supabase/client";
import {
  approveAccountRequest,
  loadAccountRequests,
  loadAccountRequestScopeOptions,
  requestedAccountRoleLabels,
  updateAccountRequest,
  type AccountRequest,
  type AccountRequestScopeOptions,
  type AccountRequestStatus,
  type RequestedAccountRole,
} from "@/lib/accountRequestStore";

const cardStyle: CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  boxShadow: "var(--shadow-card)",
  borderRadius: 16,
  overflow: "hidden",
};

const requestRoles: RequestedAccountRole[] = ["broker", "brand", "deal"];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusStyles(status: AccountRequestStatus): CSSProperties {
  if (status === "approved") {
    return { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.22)", color: "#10B981" };
  }
  if (status === "rejected") {
    return { background: "rgba(185,28,28,0.10)", border: "1px solid rgba(185,28,28,0.20)", color: "#ef4444" };
  }
  return { background: "rgba(225,135,57,0.14)", border: "1px solid rgba(225,135,57,0.24)", color: "#E18739" };
}

function statusLabel(status: AccountRequestStatus): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

type RequestDraft = {
  fullName: string;
  email: string;
  requestedRole: RequestedAccountRole;
  company: string;
  brandName: string;
  dealName: string;
  brandId: string;
  dealId: string;
  brokerName: string;
  message: string;
  adminNotes: string;
};

function draftFromRequest(request: AccountRequest | null): RequestDraft {
  return {
    fullName: request?.fullName ?? "",
    email: request?.email ?? "",
    requestedRole: request?.requestedRole ?? "brand",
    company: request?.company ?? "",
    brandName: request?.brandName ?? "",
    dealName: request?.dealName ?? "",
    brandId: request?.brandId ?? "",
    dealId: request?.dealId ?? "",
    brokerName: request?.brokerName ?? "",
    message: request?.message ?? "",
    adminNotes: request?.adminNotes ?? "",
  };
}

function requestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof SupabaseHttpError) {
    const details = error.details as { error?: unknown };
    if (typeof details.error === "string") return details.error;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function AdminAccountRequests() {
  const role = useUserRole();
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RequestDraft>(() => draftFromRequest(null));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountRequestStatus | "all">("pending");
  const [scopeOptions, setScopeOptions] = useState<AccountRequestScopeOptions>({ brands: [], deals: [] });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [rows, options] = await Promise.all([
        loadAccountRequests(),
        loadAccountRequestScopeOptions(),
      ]);
      setRequests(rows);
      setScopeOptions(options);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load account requests.", {
        description: error instanceof Error ? error.message : "Check Supabase permissions.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (!term) return true;
      return [
        request.fullName,
        request.email,
        request.company ?? "",
        request.brandName ?? "",
        request.dealName ?? "",
        request.message ?? "",
        requestedAccountRoleLabels[request.requestedRole],
        request.brokerName ?? "",
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [requests, search, statusFilter]);

  const selected = useMemo(
    () => filtered.find((request) => request.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  useEffect(() => {
    setSelectedId(selected?.id ?? null);
    setDraft(draftFromRequest(selected));
  }, [selected?.id]);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((request) => request.status === "pending").length,
    approved: requests.filter((request) => request.status === "approved").length,
    rejected: requests.filter((request) => request.status === "rejected").length,
  }), [requests]);
  const selectedIsFinalized = selected?.status === "approved" || selected?.status === "rejected";

  const saveSelected = async (status?: AccountRequestStatus) => {
    if (!selected || saving) return;
    if (selected.status !== "pending") {
      toast.info(`This request is already ${statusLabel(selected.status).toLowerCase()} and is read-only.`);
      return;
    }
    if (!draft.fullName.trim() || !draft.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateAccountRequest(selected.id, {
        fullName: draft.fullName,
        email: draft.email,
        requestedRole: draft.requestedRole,
        company: draft.company,
        brandName: draft.brandName,
        dealName: draft.dealName,
        brandId: draft.brandId,
        dealId: draft.dealId,
        brokerName: draft.brokerName,
        message: draft.message,
        adminNotes: draft.adminNotes,
        status,
      });
      setRequests((current) => current.map((request) => (request.id === updated.id ? updated : request)));
      setSelectedId(updated.id);
      toast.success(status ? `Request ${status}.` : "Request updated.");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update request.", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const approveSelected = async () => {
    if (!selected || saving) return;
    if (selected.status !== "pending") {
      toast.info(`This request is already ${statusLabel(selected.status).toLowerCase()} and is read-only.`);
      return;
    }
    if (!draft.fullName.trim() || !draft.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await approveAccountRequest(selected.id, {
        fullName: draft.fullName,
        email: draft.email,
        requestedRole: draft.requestedRole,
        company: draft.company,
        brandName: draft.brandName,
        dealName: draft.dealName,
        brandId: draft.brandId,
        dealId: draft.dealId,
        brokerName: draft.brokerName,
        message: draft.message,
        adminNotes: draft.adminNotes,
      });
      setRequests((current) => current.map((request) => (request.id === updated.id ? updated : request)));
      setSelectedId(updated.id);
      toast.success("Request approved and password setup email sent.");
    } catch (error) {
      console.error(error);
      toast.error("Unable to approve request.", {
        description: requestErrorMessage(error, "Check request scope and Supabase Auth email settings."),
      });
    } finally {
      setSaving(false);
    }
  };

  if (role !== "admin") {
    return (
      <div className="p-7">
        <div style={{ ...cardStyle, padding: 28, color: "var(--text-primary)" }}>
          Account requests are only available to admins.
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="p-4 md:p-7" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1500, margin: "0 auto" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Account Requests
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
              Review requested access. Approving creates the Supabase user, platform profile, and password setup email.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-px"
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 12,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 700,
              cursor: refreshing ? "wait" : "pointer",
              opacity: refreshing ? 0.72 : 1,
            }}
          >
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12 }}>
          {[
            ["Total", stats.total],
            ["Pending", stats.pending],
            ["Approved", stats.approved],
            ["Rejected", stats.rejected],
          ].map(([label, value]) => (
            <div key={label} style={{ ...cardStyle, padding: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
              <p style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginTop: 8 }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr]" style={{ gap: 16 }}>
          <section style={cardStyle}>
            <div className="flex flex-col gap-3" style={{ padding: 16, borderBottom: "1px solid var(--border-divider)" }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search requests..."
                  className="w-full"
                  style={{
                    height: 40,
                    borderRadius: 12,
                    border: "1px solid var(--border-input)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    padding: "0 12px 0 36px",
                    outline: "none",
                    fontSize: 13,
                  }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as AccountRequestStatus | "all")}
                style={{
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  padding: "0 12px",
                  outline: "none",
                  fontSize: 13,
                }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All requests</option>
              </select>
            </div>

            <div className="themed-scrollbar overflow-y-auto" style={{ maxHeight: "min(620px, calc(100vh - 360px))", padding: 10 }}>
              {loading ? (
                <div className="flex items-center justify-center gap-2" style={{ minHeight: 220, color: "var(--text-muted)", fontSize: 13 }}>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading requests...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 220, color: "var(--text-muted)", padding: 24 }}>
                  <UserPlus className="h-8 w-8" style={{ marginBottom: 10 }} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>No account requests</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>New sign-up requests will appear here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map((request) => {
                    const active = selected?.id === request.id;
                    return (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() => setSelectedId(request.id)}
                        className="text-left transition-colors"
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          border: active ? "1px solid rgba(225,135,57,0.40)" : "1px solid var(--border-subtle)",
                          background: active ? "rgba(225,135,57,0.08)" : "var(--bg-card)",
                          cursor: "pointer",
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span style={{ fontSize: 14, fontWeight: 750, color: "var(--text-primary)" }}>{request.fullName}</span>
                          <span style={{ fontSize: 11, fontWeight: 750, borderRadius: 999, padding: "4px 8px", ...statusStyles(request.status) }}>
                            {statusLabel(request.status)}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{request.email}</p>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                          {requestedAccountRoleLabels[request.requestedRole]} · {formatDateTime(request.createdAt)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section style={{ ...cardStyle, minHeight: 540 }}>
            {selected ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between gap-3" style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-divider)" }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 750, color: "var(--text-primary)" }}>{selected.fullName}</h2>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      Requested {requestedAccountRoleLabels[selected.requestedRole]} on {formatDateTime(selected.createdAt)}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 750, borderRadius: 999, padding: "5px 10px", ...statusStyles(selected.status) }}>
                    {statusLabel(selected.status)}
                  </span>
                </div>

                <div className="themed-scrollbar overflow-y-auto" style={{ padding: 20, flex: 1 }}>
                  <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
                    <Field label="Full name" value={draft.fullName} disabled={selectedIsFinalized} onChange={(value) => setDraft((current) => ({ ...current, fullName: value }))} />
                    <Field label="Email" value={draft.email} disabled={selectedIsFinalized} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} />
                    <label className="flex flex-col gap-1.5">
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Requested role</span>
                      <select
                        value={draft.requestedRole}
                        disabled={selectedIsFinalized}
                        onChange={(event) => setDraft((current) => ({ ...current, requestedRole: event.target.value as RequestedAccountRole }))}
                        style={{
                          height: 40,
                          borderRadius: 10,
                          border: "1px solid var(--border-input)",
                          background: "var(--bg-card)",
                          color: "var(--text-primary)",
                          padding: "0 12px",
                          outline: "none",
                          fontSize: 14,
                          opacity: selectedIsFinalized ? 0.72 : 1,
                          cursor: selectedIsFinalized ? "not-allowed" : "default",
                        }}
                      >
                        {requestRoles.map((requestRole) => (
                          <option key={requestRole} value={requestRole}>{requestedAccountRoleLabels[requestRole]}</option>
                        ))}
                      </select>
                    </label>
                    <Field label="Company" value={draft.company} disabled={selectedIsFinalized} onChange={(value) => setDraft((current) => ({ ...current, company: value }))} />
                    <Field label="Brand context" value={draft.brandName} disabled={selectedIsFinalized} onChange={(value) => setDraft((current) => ({ ...current, brandName: value }))} />
                    <Field label="Deal context" value={draft.dealName} disabled={selectedIsFinalized} onChange={(value) => setDraft((current) => ({ ...current, dealName: value }))} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
                    {(draft.requestedRole === "brand" || draft.requestedRole === "deal") && (
                      <SelectField
                        label="Brand scope"
                        value={draft.brandId}
                        onChange={(value) => setDraft((current) => ({
                          ...current,
                          brandId: value,
                          dealId: current.dealId && scopeOptions.deals.some((deal) => deal.id === current.dealId && deal.brandId === value) ? current.dealId : "",
                        }))}
                        options={scopeOptions.brands.map((brand) => ({ value: brand.id, label: brand.name }))}
                        placeholder="Auto-match or choose a brand"
                        disabled={selectedIsFinalized}
                      />
                    )}
                    {draft.requestedRole === "deal" && (
                      <SelectField
                        label="Deal scope"
                        value={draft.dealId}
                        onChange={(value) => {
                          const deal = scopeOptions.deals.find((option) => option.id === value);
                          setDraft((current) => ({ ...current, dealId: value, brandId: deal?.brandId ?? current.brandId }));
                        }}
                        options={scopeOptions.deals
                          .filter((deal) => !draft.brandId || deal.brandId === draft.brandId)
                          .map((deal) => ({ value: deal.id, label: `${deal.label} · ${deal.city}, ${deal.state}` }))}
                        placeholder="Auto-match or choose a deal"
                        disabled={selectedIsFinalized}
                      />
                    )}
                    {draft.requestedRole === "broker" && (
                      <Field
                        label="Broker code"
                        value={draft.brokerName}
                        onChange={(value) => setDraft((current) => ({ ...current, brokerName: value }))}
                        placeholder="Example: QC"
                        disabled={selectedIsFinalized}
                      />
                    )}
                  </div>

                  <TextAreaField label="Request message" value={draft.message} disabled={selectedIsFinalized} onChange={(value) => setDraft((current) => ({ ...current, message: value }))} />
                  <TextAreaField label="Admin notes" value={draft.adminNotes} disabled={selectedIsFinalized} onChange={(value) => setDraft((current) => ({ ...current, adminNotes: value }))} />

                  <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
                    {selectedIsFinalized
                      ? `This request is ${statusLabel(selected.status).toLowerCase()} and locked to prevent duplicate invites or accidental role changes.`
                      : "Approve will create or update the Auth user, write the platform profile, and send the Supabase password setup email. If no scope is selected, the system tries to match by the request context text."}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2" style={{ padding: 16, borderTop: "1px solid var(--border-divider)" }}>
                  {selectedIsFinalized ? (
                    <span style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 650 }}>
                      Final status: {statusLabel(selected.status)}
                    </span>
                  ) : (
                    <>
                      <button type="button" onClick={() => void saveSelected()} disabled={saving} className="cta-secondary disabled:opacity-60">
                        Save edits
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveSelected("rejected")}
                        disabled={saving}
                        className="inline-flex items-center gap-2 disabled:opacity-60"
                        style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid rgba(185,28,28,0.20)", background: "rgba(185,28,28,0.08)", color: "#ef4444", fontSize: 13, fontWeight: 750, cursor: saving ? "wait" : "pointer" }}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => void approveSelected()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 disabled:opacity-60"
                        style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "#243c51", color: "#ffffff", fontSize: 13, fontWeight: 750, cursor: saving ? "wait" : "pointer" }}
                      >
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 540, color: "var(--text-muted)", padding: 32 }}>
                <Clock3 className="h-10 w-10" style={{ marginBottom: 12 }} />
                <h2 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 750 }}>Select a request</h2>
                <p style={{ fontSize: 13, marginTop: 6 }}>Choose an account request from the list to review it.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={{
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--border-input)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          padding: "0 12px",
          outline: "none",
          fontSize: 14,
          opacity: disabled ? 0.72 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={{
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--border-input)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          padding: "0 12px",
          outline: "none",
          fontSize: 14,
          opacity: disabled ? 0.72 : 1,
          cursor: disabled ? "not-allowed" : "default",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-4 flex flex-col gap-1.5">
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        style={{
          borderRadius: 10,
          border: "1px solid var(--border-input)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          padding: 12,
          outline: "none",
          fontSize: 14,
          resize: "vertical",
          opacity: disabled ? 0.72 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
    </label>
  );
}
