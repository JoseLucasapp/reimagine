import { useUserRole, roleStore, ROLE_LABELS, type UserRole } from "@/hooks/useUserRole";
import { Shield, Building2, Store, Check } from "lucide-react";
import { toast } from "sonner";

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

  const handleSelect = (next: UserRole) => {
    if (next === role) return;
    roleStore.set(next);
    toast.success(`Now viewing as ${ROLE_LABELS[next]}`);
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

        {/* Preview as Role */}
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
              Preview as Role
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Switch the active role to preview the platform exactly as that user would see it. The
              change applies immediately.
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
      </div>
    </div>
  );
}
