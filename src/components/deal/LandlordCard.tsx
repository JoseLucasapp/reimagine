import { useState } from "react";
import { Plus } from "lucide-react";

export function LandlordCard() {
  const [actionHover, setActionHover] = useState<string | null>(null);

  const actions = [
    { label: "📞 Call", key: "call" },
    { label: "✉ Email", key: "email" },
    { label: "📝 Note", key: "note" },
  ];

  return (
    <div className="glass-card-static" style={{ padding: 20, borderRadius: 12, marginTop: 12 }}>
      {/* Header */}
      <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid var(--border-divider)" }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>Landlord</span>
      </div>

      {/* Landlord info */}
      <div className="flex items-center" style={{ gap: 12 }}>
        <div className="flex items-center justify-center" style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg, #243c51, #1a5276)",
          color: "white", fontSize: 16, fontWeight: 700, flexShrink: 0,
        }}>C</div>
        <div className="flex flex-col">
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Crow Holdings</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Landlord</span>
        </div>
      </div>

      {/* Contact */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-divider)" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Landlord Contact</span>
        <button className="flex items-center" style={{ gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)", cursor: "pointer" }}>
          <Plus className="w-3 h-3" /> Add contact
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex" style={{ gap: 8, marginTop: 12 }}>
        {actions.map((a) => (
          <button key={a.key} className="flex-1"
            onMouseEnter={() => setActionHover(a.key)} onMouseLeave={() => setActionHover(null)}
            style={{
              background: "var(--bg-card)", border: `1px solid ${actionHover === a.key ? "#E18739" : "var(--border-subtle)"}`,
              borderRadius: 8, padding: "8px 8px 8px 8px", fontSize: 12, fontWeight: 600,
              color: actionHover === a.key ? "var(--text-orange-ui)" : "var(--text-secondary)",
              textAlign: "center", cursor: "pointer", transition: "all 0.15s",
            }}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}
