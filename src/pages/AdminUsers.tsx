import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { RefreshCw, Search, ShieldCheck, UserCheck, UserCog, UserPlus, UserX } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentProfile, useUserRole } from "@/hooks/useUserRole";
import { SupabaseHttpError } from "@/infrastructure/supabase/client";
import type { UserRole } from "@/domain/entities";
import {
  adminUserRoleLabels,
  adminUserRoleOptions,
  loadAdminUsers,
  loadAdminUserScopeOptions,
  saveAdminUser,
  setAdminUserDisabled,
  type AdminUserProfile,
  type AdminUserScopeOptions,
} from "@/lib/adminUserStore";

const NEW_USER_ID = "__new__";

const cardStyle: CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  boxShadow: "var(--shadow-card)",
  borderRadius: 16,
  overflow: "hidden",
};

type UserDraft = {
  id: string | null;
  email: string;
  fullName: string;
  username: string;
  role: UserRole;
  brandId: string;
  dealId: string;
  brokerName: string;
};

const emptyDraft: UserDraft = {
  id: null,
  email: "",
  fullName: "",
  username: "",
  role: "deal",
  brandId: "",
  dealId: "",
  brokerName: "",
};

function draftFromProfile(profile: AdminUserProfile | null): UserDraft {
  if (!profile) return emptyDraft;
  return {
    id: profile.id,
    email: profile.email ?? "",
    fullName: profile.fullName ?? "",
    username: profile.username ?? "",
    role: profile.role,
    brandId: profile.brandId ?? "",
    dealId: profile.dealId ?? "",
    brokerName: profile.brokerName ?? "",
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof SupabaseHttpError) {
    const details = error.details as { error?: unknown };
    if (typeof details.error === "string") return details.error;
  }
  return error instanceof Error ? error.message : fallback;
}

function roleStyles(role: UserRole): CSSProperties {
  if (role === "admin") return { color: "#E18739", background: "rgba(225,135,57,0.14)", border: "1px solid rgba(225,135,57,0.24)" };
  if (role === "mapiq") return { color: "#60a5fa", background: "rgba(96,165,250,0.13)", border: "1px solid rgba(96,165,250,0.22)" };
  if (role === "broker") return { color: "#c084fc", background: "rgba(192,132,252,0.13)", border: "1px solid rgba(192,132,252,0.22)" };
  if (role === "brand") return { color: "#10b981", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.22)" };
  return { color: "#5E9ED6", background: "rgba(94,158,214,0.13)", border: "1px solid rgba(94,158,214,0.22)" };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminUsers() {
  const role = useUserRole();
  const currentProfile = useCurrentProfile();
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);
  const [scopeOptions, setScopeOptions] = useState<AdminUserScopeOptions>({ brands: [], deals: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [togglingDisabled, setTogglingDisabled] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");

  const isCreating = selectedId === NEW_USER_ID;
  const selectedUser = useMemo(
    () => isCreating ? null : users.find((user) => user.id === selectedId) ?? users[0] ?? null,
    [isCreating, selectedId, users],
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [rows, options] = await Promise.all([
        loadAdminUsers(),
        loadAdminUserScopeOptions(),
      ]);
      setUsers(rows);
      setScopeOptions(options);
      setSelectedId((current) => current ?? rows[0]?.id ?? NEW_USER_ID);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load users.", {
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

  useEffect(() => {
    setDraft(isCreating ? emptyDraft : draftFromProfile(selectedUser));
  }, [isCreating, selectedUser?.id]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!term) return true;
      return [
        user.fullName ?? "",
        user.email ?? "",
        user.username ?? "",
        user.brokerName ?? "",
        user.disabledAt ? "disabled" : "active",
        adminUserRoleLabels[user.role],
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [roleFilter, search, users]);

  const stats = useMemo(() => ({
    total: users.length,
    admin: users.filter((user) => user.role === "admin").length,
    internal: users.filter((user) => user.role === "broker" || user.role === "mapiq").length,
    disabled: users.filter((user) => user.disabledAt).length,
  }), [users]);

  const isEditingSelf = Boolean(!isCreating && draft.id && currentProfile?.id === draft.id);
  const isOnlyAdmin = Boolean(!isCreating && selectedUser?.role === "admin" && stats.admin <= 1);
  const selectedUserDisabled = Boolean(selectedUser?.disabledAt);
  const canToggleDisabled = Boolean(selectedUser && !isCreating && selectedUser.role !== "admin");
  const roleLocked = isEditingSelf || isOnlyAdmin;
  const roleLockMessage = isEditingSelf
    ? "You cannot change your own role from this screen."
    : isOnlyAdmin
      ? "At least one admin must remain in the system."
      : "";
  const draftBrandName = useMemo(
    () => scopeOptions.brands.find((brand) => brand.id === draft.brandId)?.name ?? "Not selected",
    [draft.brandId, scopeOptions.brands],
  );
  const draftDealName = useMemo(() => {
    const deal = scopeOptions.deals.find((option) => option.id === draft.dealId);
    return deal ? `${deal.label} · ${deal.city}, ${deal.state}` : "Not selected";
  }, [draft.dealId, scopeOptions.deals]);
  const draftScopeLabel = useMemo(() => {
    if (draft.role === "brand") return draftBrandName;
    if (draft.role === "deal") return draftDealName;
    if (draft.role === "broker") return draft.brokerName.trim() || "Not selected";
    return "Global";
  }, [draft.brokerName, draft.role, draftBrandName, draftDealName]);

  const startCreate = () => {
    setSelectedId(NEW_USER_ID);
    setDraft(emptyDraft);
  };

  const updateRole = (nextRole: UserRole) => {
    if (roleLocked) {
      toast.error(roleLockMessage || "This user's role is locked.");
      return;
    }
    if (selectedUserDisabled && nextRole === "admin") {
      toast.error("Reactivate this user before assigning admin access.");
      return;
    }
    setDraft((current) => ({
      ...current,
      role: nextRole,
      brandId: nextRole === "brand" || nextRole === "deal" ? current.brandId : "",
      dealId: nextRole === "deal" ? current.dealId : "",
      brokerName: nextRole === "broker" ? current.brokerName : "",
    }));
  };

  const validateDraft = () => {
    if (!draft.email.trim() || !draft.fullName.trim()) return "Full name and email are required.";
    if (isEditingSelf && selectedUser && draft.role !== selectedUser.role) return "You cannot change your own role.";
    if (isOnlyAdmin && draft.role !== "admin") return "At least one admin must remain in the system.";
    if (selectedUserDisabled && draft.role === "admin") return "Reactivate this user before assigning admin access.";
    if (draft.role === "brand" && !draft.brandId) return "Brand Level users require a brand scope.";
    if (draft.role === "deal" && !draft.dealId) return "Deal Level users require a deal scope.";
    if (draft.role === "broker" && !draft.brokerName.trim()) return "Broker users require a broker code.";
    return "";
  };

  const requestSave = () => {
    if (saving) return;
    const validationError = validateDraft();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setConfirmOpen(true);
  };

  const save = async () => {
    if (saving) return;
    const validationError = validateDraft();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setConfirmOpen(false);
    setSaving(true);
    try {
      const saved = await saveAdminUser({
        id: draft.id,
        email: draft.email,
        fullName: draft.fullName,
        username: draft.username,
        role: draft.role,
        brandId: draft.brandId,
        dealId: draft.dealId,
        brokerName: draft.brokerName,
      });
      setUsers((current) => {
        const exists = current.some((user) => user.id === saved.id);
        const next = exists ? current.map((user) => user.id === saved.id ? saved : user) : [saved, ...current];
        return next.sort((a, b) => (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""));
      });
      setSelectedId(saved.id);
      toast.success(isCreating ? "User created and password setup email sent." : "User access updated.");
    } catch (error) {
      console.error(error);
      toast.error("Unable to save user.", {
        description: errorMessage(error, "Check role scope and Supabase Auth settings."),
      });
    } finally {
      setSaving(false);
    }
  };

  const requestToggleDisabled = () => {
    if (!selectedUser || isCreating || togglingDisabled) return;
    if (selectedUser.role === "admin") {
      toast.error("Admin users cannot be deactivated.");
      return;
    }
    setDisableConfirmOpen(true);
  };

  const toggleDisabled = async () => {
    if (!selectedUser || togglingDisabled) return;
    if (selectedUser.role === "admin") {
      toast.error("Admin users cannot be deactivated.");
      setDisableConfirmOpen(false);
      return;
    }
    const nextDisabled = !selectedUser.disabledAt;
    setTogglingDisabled(true);
    setDisableConfirmOpen(false);
    try {
      const saved = await setAdminUserDisabled(selectedUser, nextDisabled);
      setUsers((current) => current.map((user) => user.id === saved.id ? saved : user));
      toast.success(nextDisabled ? "User deactivated." : "User reactivated.");
    } catch (error) {
      console.error(error);
      toast.error(nextDisabled ? "Unable to deactivate user." : "Unable to reactivate user.", {
        description: errorMessage(error, "Check Supabase Auth function settings."),
      });
    } finally {
      setTogglingDisabled(false);
    }
  };

  if (role !== "admin") {
    return (
      <div className="p-7">
        <div style={{ ...cardStyle, padding: 28, color: "var(--text-primary)" }}>
          User administration is only available to admins.
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="animate-fade-in">
      <div className="p-4 md:p-7" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1500, margin: "0 auto" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Users
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
              Manage user roles, brand/deal scopes, broker access, and create new platform users.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="cta-secondary inline-flex items-center gap-2 disabled:opacity-60">
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </button>
            <button type="button" onClick={startCreate} className="cta-primary inline-flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create User
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12 }}>
          {[
            ["Total", stats.total],
            ["Admins", stats.admin],
            ["Internal", stats.internal],
            ["Disabled", stats.disabled],
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
                  placeholder="Search users..."
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
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as UserRole | "all")}
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
                <option value="all">All roles</option>
                {adminUserRoleOptions.map((option) => (
                  <option key={option} value={option}>{adminUserRoleLabels[option]}</option>
                ))}
              </select>
            </div>

            <div className="themed-scrollbar overflow-y-auto" style={{ maxHeight: "min(640px, calc(100vh - 350px))", padding: 10 }}>
              {loading ? (
                <div className="flex items-center justify-center gap-2" style={{ minHeight: 220, color: "var(--text-muted)", fontSize: 13 }}>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading users...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 220, color: "var(--text-muted)", padding: 24 }}>
                  <UserCog className="h-8 w-8" style={{ marginBottom: 10 }} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>No users found</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Try a different search or role filter.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredUsers.map((user) => {
                    const active = selectedId === user.id && !isCreating;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedId(user.id)}
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
                          <span style={{ fontSize: 14, fontWeight: 750, color: "var(--text-primary)" }}>{user.fullName || user.email || "Unnamed User"}</span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {user.disabledAt ? (
                              <span style={{ fontSize: 11, fontWeight: 750, borderRadius: 999, padding: "4px 8px", color: "#fca5a5", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
                                Disabled
                              </span>
                            ) : null}
                            <span style={{ fontSize: 11, fontWeight: 750, borderRadius: 999, padding: "4px 8px", ...roleStyles(user.role) }}>
                              {adminUserRoleLabels[user.role]}
                            </span>
                          </div>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{user.email || "No email"}</p>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                          Updated {formatDate(user.updatedAt)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section style={{ ...cardStyle, minHeight: 560 }}>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between gap-3" style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-divider)" }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 750, color: "var(--text-primary)" }}>
                    {isCreating ? "Create User" : draft.fullName || draft.email || "User Access"}
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {isCreating ? "Creates a Supabase Auth user, profile, and password setup email." : `Profile ID: ${draft.id}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span style={{ fontSize: 11, fontWeight: 750, borderRadius: 999, padding: "5px 10px", ...roleStyles(draft.role) }}>
                    {adminUserRoleLabels[draft.role]}
                  </span>
                  {selectedUserDisabled ? (
                    <span style={{ fontSize: 11, fontWeight: 750, borderRadius: 999, padding: "5px 10px", color: "#fca5a5", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
                      Disabled
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="themed-scrollbar overflow-y-auto" style={{ padding: 20, flex: 1 }}>
                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
                  <Field label="Full name" value={draft.fullName} onChange={(value) => setDraft((current) => ({ ...current, fullName: value }))} />
                  <Field label="Email" value={draft.email} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} />
                  <Field label="Username" value={draft.username} placeholder="Defaults to email prefix" onChange={(value) => setDraft((current) => ({ ...current, username: value }))} />
                  <label className="flex flex-col gap-1.5">
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Role</span>
                    <select
                      value={draft.role}
                      onChange={(event) => updateRole(event.target.value as UserRole)}
                      disabled={roleLocked}
                      style={{
                        height: 40,
                        borderRadius: 10,
                        border: "1px solid var(--border-input)",
                        background: "var(--bg-card)",
                        color: "var(--text-primary)",
                        padding: "0 12px",
                        outline: "none",
                        fontSize: 14,
                        cursor: roleLocked ? "not-allowed" : "default",
                        opacity: roleLocked ? 0.68 : 1,
                      }}
                    >
                      {adminUserRoleOptions.map((option) => (
                        <option key={option} value={option}>{adminUserRoleLabels[option]}</option>
                      ))}
                    </select>
                    {roleLockMessage ? (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{roleLockMessage}</span>
                    ) : null}
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
                  {(draft.role === "brand" || draft.role === "deal") && (
                    <SelectField
                      label="Brand scope"
                      value={draft.brandId}
                      onChange={(value) => setDraft((current) => ({
                        ...current,
                        brandId: value,
                        dealId: current.dealId && scopeOptions.deals.some((deal) => deal.id === current.dealId && deal.brandId === value) ? current.dealId : "",
                      }))}
                      options={scopeOptions.brands.map((brand) => ({ value: brand.id, label: brand.name }))}
                      placeholder="Choose a brand"
                    />
                  )}
                  {draft.role === "deal" && (
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
                      placeholder="Choose a deal"
                    />
                  )}
                  {draft.role === "broker" && (
                    <Field
                      label="Broker code"
                      value={draft.brokerName}
                      placeholder="Example: QC"
                      onChange={(value) => setDraft((current) => ({ ...current, brokerName: value }))}
                    />
                  )}
                </div>

                <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
                  <ShieldCheck className="mr-2 inline h-4 w-4" />
                  {isCreating
                    ? "Creating a user sends the Supabase password setup email automatically."
                    : "Saving updates the Supabase Auth metadata and the platform profile access scope."}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2" style={{ padding: 16, borderTop: "1px solid var(--border-divider)" }}>
                {!isCreating ? (
                  <button
                    type="button"
                    onClick={requestToggleDisabled}
                    disabled={!canToggleDisabled || togglingDisabled}
                    className="cta-secondary inline-flex items-center gap-2 disabled:opacity-50"
                    style={canToggleDisabled && !selectedUserDisabled ? { color: "#fca5a5", borderColor: "rgba(239,68,68,0.35)" } : undefined}
                    title={!canToggleDisabled ? "Admin users cannot be deactivated." : undefined}
                  >
                    {togglingDisabled ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : selectedUserDisabled ? (
                      <UserCheck className="h-4 w-4" />
                    ) : (
                      <UserX className="h-4 w-4" />
                    )}
                    {selectedUserDisabled ? "Reactivate User" : "Deactivate User"}
                  </button>
                ) : null}
                <button type="button" onClick={requestSave} disabled={saving} className="cta-primary inline-flex items-center gap-2 disabled:opacity-60">
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
                  {isCreating ? "Create User" : "Save Access"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
    <Dialog open={confirmOpen} onOpenChange={(open) => !saving && setConfirmOpen(open)}>
      <DialogContent
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
        }}
      >
        <DialogHeader>
          <DialogTitle>{isCreating ? "Create this user?" : "Save access changes?"}</DialogTitle>
          <DialogDescription style={{ color: "var(--text-muted)" }}>
            Confirm the role and scope before applying this access change.
          </DialogDescription>
        </DialogHeader>
        <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>
          {[
            ["User", draft.fullName || draft.email || "Unnamed user"],
            ["Email", draft.email || "No email"],
            ["Role", adminUserRoleLabels[draft.role]],
            ["Status", selectedUserDisabled ? "Disabled" : "Active"],
            ["Scope", draftScopeLabel],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4" style={{ padding: "10px 12px", borderBottom: label === "Scope" ? 0 : "1px solid var(--border-divider)" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{label}</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
            </div>
          ))}
        </div>
        {isCreating ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Supabase will create the Auth user and send the password setup email automatically.
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:space-x-0">
          <button type="button" onClick={() => setConfirmOpen(false)} disabled={saving} className="cta-secondary disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="cta-primary inline-flex items-center gap-2 disabled:opacity-60">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Confirm
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={disableConfirmOpen} onOpenChange={(open) => !togglingDisabled && setDisableConfirmOpen(open)}>
      <DialogContent
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
        }}
      >
        <DialogHeader>
          <DialogTitle>{selectedUserDisabled ? "Reactivate this user?" : "Deactivate this user?"}</DialogTitle>
          <DialogDescription style={{ color: "var(--text-muted)" }}>
            {selectedUserDisabled
              ? "This will restore login access for this account."
              : "This will block login access for this account. Admin accounts are protected from this action."}
          </DialogDescription>
        </DialogHeader>
        <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>
          {[
            ["User", selectedUser?.fullName || selectedUser?.email || "Unnamed user"],
            ["Email", selectedUser?.email || "No email"],
            ["Role", selectedUser ? adminUserRoleLabels[selectedUser.role] : ""],
            ["New status", selectedUserDisabled ? "Active" : "Disabled"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4" style={{ padding: "10px 12px", borderBottom: label === "New status" ? 0 : "1px solid var(--border-divider)" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{label}</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:space-x-0">
          <button type="button" onClick={() => setDisableConfirmOpen(false)} disabled={togglingDisabled} className="cta-secondary disabled:opacity-60">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void toggleDisabled()}
            disabled={togglingDisabled}
            className="cta-primary inline-flex items-center gap-2 disabled:opacity-60"
            style={!selectedUserDisabled ? { background: "#dc2626", borderColor: "#dc2626" } : undefined}
          >
            {togglingDisabled ? <RefreshCw className="h-4 w-4 animate-spin" /> : selectedUserDisabled ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
            {selectedUserDisabled ? "Reactivate" : "Deactivate"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{label}</span>
      <select
        value={value}
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
