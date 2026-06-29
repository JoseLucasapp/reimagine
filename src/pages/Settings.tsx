import { useState, type FormEvent } from "react";
import { useCurrentProfile, useRealUserRole, useUserRole, roleStore, ROLE_LABELS, type UserRole } from "@/hooks/useUserRole";
import { Shield, Building2, Store, Check, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { changeSupabasePassword, signOutOfSupabase } from "@/infrastructure/supabase/auth";

interface RoleOption {
  key: UserRole;
  label: string;
  icon: typeof Shield;
  description: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    key: "admin",
    label: "Admin",
    icon: Shield,
    description:
      "Full access to every brand, deal, and broker file. Can edit all fields, view commissions, and manage the team.",
  },
  {
    key: "brand",
    label: "Brand Level",
    icon: Building2,
    description:
      "Sees their own brand and its deals. Can request actions from Reimagine, upload files, and view (but not edit) most deal details. Financials hidden.",
  },
  {
    key: "deal",
    label: "Deal Level",
    icon: Store,
    description:
      "Sees only the deal they are working on, including Top Sites. Can upload site photos and request updates. Financials and broker files hidden.",
  },
];

export default function SettingsPage() {
  const role = useUserRole();
  const realRole = useRealUserRole();
  const profile = useCurrentProfile();
  const canPreview = realRole === "admin";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSelect = (next: UserRole) => {
    if (next === role) return;
    roleStore.set(next);
    toast.success(`Now viewing as ${ROLE_LABELS[next]}`);
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isChangingPassword) return;
    if (!currentPassword.trim()) {
      toast.error("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from your current password.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changeSupabasePassword(currentPassword, newPassword);
      if (!result.ok) {
        toast.error("Unable to change password", { description: result.message });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOutOfSupabase();
  };

  return (
    <div className="animate-fade-in">
      <div
        style={{
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <div className="flex items-center justify-between">
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            Settings
          </h1>
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>
            Application settings and preferences
          </span>
        </div>

        <section
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-card)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div className="flex items-start" style={{ gap: 12, marginBottom: 18 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(225,135,57,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <KeyRound style={{ width: 18, height: 18, color: "#E18739" }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                Change Password
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                Update the password for {profile?.email || "your current account"}.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange}>
            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
              {[
                {
                  label: "Current password",
                  value: currentPassword,
                  onChange: setCurrentPassword,
                  autoComplete: "current-password",
                },
                {
                  label: "New password",
                  value: newPassword,
                  onChange: setNewPassword,
                  autoComplete: "new-password",
                },
                {
                  label: "Confirm new password",
                  value: confirmPassword,
                  onChange: setConfirmPassword,
                  autoComplete: "new-password",
                },
              ].map((field) => (
                <label key={field.label} className="flex flex-col" style={{ gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
                    {field.label}
                  </span>
                  <input
                    type="password"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    autoComplete={field.autoComplete}
                    disabled={isChangingPassword}
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
              ))}
            </div>

            <div className="flex items-center justify-between" style={{ gap: 12, marginTop: 16 }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                Minimum 8 characters. Your current password is verified before saving.
              </p>
              <button
                type="submit"
                disabled={isChangingPassword}
                style={{
                  height: 40,
                  padding: "0 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#243c51",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isChangingPassword ? "wait" : "pointer",
                  opacity: isChangingPassword ? 0.72 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {isChangingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>

        <section
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-card)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start" style={{ gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(185,28,28,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <LogOut style={{ width: 18, height: 18, color: "#b91c1c" }} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                  Session
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                  Sign out of this browser session and return to the login screen.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 10,
                border: "1px solid rgba(185,28,28,0.20)",
                background: "rgba(185,28,28,0.08)",
                color: "#b91c1c",
                fontSize: 13,
                fontWeight: 700,
                cursor: isSigningOut ? "wait" : "pointer",
                opacity: isSigningOut ? 0.72 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {isSigningOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </section>

        {!canPreview && (
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-card)",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                Platform Access
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                Your access is assigned from your Supabase profile.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
              {[
                { label: "Role", value: ROLE_LABELS[realRole] },
                { label: "Email", value: profile?.email || "Not set" },
                { label: "Brand scope", value: profile?.brandId || "Not assigned" },
                { label: "Deal scope", value: profile?.dealId || "Not assigned" },
              ].map((item) => (
                <div key={item.label} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{item.label}</span>
                  <span style={{ display: "block", marginTop: 4, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {canPreview && (
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-card)",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                Admin Preview
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                Temporarily preview role-level navigation. Your real persisted profile remains Admin.
              </p>
            </div>

          <div
            className="grid grid-cols-1 md:grid-cols-3"
            style={{ gap: 16 }}
            role="radiogroup"
            aria-label="Preview as role"
          >
            {ROLE_OPTIONS.map((opt) => {
              const selected = role === opt.key;
              const Icon = opt.icon;
              return (
                <div
                  key={opt.key}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  onClick={() => handleSelect(opt.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(opt.key);
                    }
                  }}
                  style={{
                    position: "relative",
                    padding: 16,
                    borderRadius: 12,
                    border: selected
                      ? "1px solid #E18739"
                      : "1px solid var(--border-subtle)",
                    background: selected ? "rgba(225,135,57,0.06)" : "var(--bg-card)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    outline: "none",
                    transition: "border-color 0.2s ease, background 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 4px rgba(225,135,57,0.16)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: selected
                          ? "linear-gradient(135deg, #E18739, #c4622a)"
                          : "var(--bg-surface)",
                        border: selected ? "none" : "1px solid var(--border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon
                        style={{
                          width: 16,
                          height: 16,
                          color: selected ? "#fff" : "var(--text-muted)",
                        }}
                      />
                    </div>
                    {selected && (
                      <span
                        className="flex items-center"
                        style={{
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: "rgba(225,135,57,0.15)",
                          color: "#E18739",
                        }}
                      >
                        <Check style={{ width: 12, height: 12 }} />
                        Active
                      </span>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: 4,
                      }}
                    >
                      {opt.label}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {opt.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(opt.key);
                    }}
                    disabled={selected}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: selected ? "none" : "1px solid var(--border-subtle)",
                      background: selected ? "transparent" : "var(--bg-surface)",
                      color: selected ? "var(--text-muted)" : "var(--text-primary)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: selected ? "default" : "pointer",
                      width: "100%",
                    }}
                  >
                    {selected ? "Currently Active" : `Preview as ${opt.label.split(" ")[0]}`}
                  </button>
                </div>
              );
            })}
          </div>
          </section>
        )}
      </div>
    </div>
  );
}
