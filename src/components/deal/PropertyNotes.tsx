import { useState } from "react";
import { StickyNote } from "lucide-react";

const MOCK_NOTES = [
  { date: "11/15/2025 · SM", text: "Site visit complete. Parking is tight during peak hours — flagged with landlord. Good visibility from McKinney Ave." },
  { date: "10/8/2025 · SM", text: "Confirmed HVAC capacity meets brand spec. Landlord agreed to TI allowance of $45/SF." },
];

export function PropertyNotes() {
  const [showInput, setShowInput] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="glass-card-static" style={{ padding: 20, borderRadius: 12 }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border-divider)", marginBottom: 12 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <StickyNote className="w-3 h-3" style={{ color: "#E18739" }} />
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>Property Notes</span>
        </div>
        <button onClick={() => setShowInput(!showInput)} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)", cursor: "pointer" }}>+ Add</button>
      </div>

      {/* Notes list */}
      {MOCK_NOTES.map((n, i) => (
        <div key={i}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{n.date}</span>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{n.text}</p>
          {i < MOCK_NOTES.length - 1 && <div style={{ borderBottom: "1px solid var(--border-divider)", margin: "12px 0 12px 0" }} />}
        </div>
      ))}

      {/* Add note input */}
      {showInput && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Add a property note..."
            style={{
              width: "100%", minHeight: 64, padding: "8px 12px 8px 12px", borderRadius: 8,
              border: "1px solid var(--border-input, var(--border-subtle))", background: "var(--bg-input, var(--bg-card))",
              fontSize: 12, color: "var(--text-primary)", resize: "none", outline: "none",
            }}
          />
          <div className="flex justify-end" style={{ marginTop: 8 }}>
            <button style={{
              background: "#E18739", color: "white", borderRadius: 8,
              padding: "8px 16px 8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>Save Note</button>
          </div>
        </div>
      )}
    </div>
  );
}
