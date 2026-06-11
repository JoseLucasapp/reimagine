import { useState } from "react";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import type { Site } from "@/data/mapRuntimeData";
import { siteToMutationInput, updateSite } from "@/application/data/runtimeMutations";

export function PropertyNotes({ site }: { site: Site }) {
  const [showInput, setShowInput] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const notes = site.notes.split("\n").map((item) => item.trim()).filter(Boolean);

  const save = async () => {
    const text = note.trim();
    if (!text) return;
    setSaving(true);
    try {
      const timestamp = new Date().toLocaleDateString();
      await updateSite(site.id, { ...siteToMutationInput(site), notes: [site.notes, `${timestamp}: ${text}`].filter(Boolean).join("\n") });
      setNote("");
      setShowInput(false);
      toast.success("Property note saved");
    } catch (error) {
      toast.error("Unable to save property note", { description: error instanceof Error ? error.message : "Check Supabase permissions." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 16 }}>
      <div className="flex items-center justify-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border-divider)", marginBottom: 12 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <StickyNote className="w-3 h-3" style={{ color: "#E18739" }} />
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>Property Notes</span>
        </div>
        <button onClick={() => setShowInput((current) => !current)} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)", cursor: "pointer" }}>+ Add</button>
      </div>

      {notes.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>No notes have been saved for this property.</p>
      ) : (
        notes.map((item, index) => (
          <div key={`${item}-${index}`}>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{item}</p>
            {index < notes.length - 1 && <div style={{ borderBottom: "1px solid var(--border-divider)", margin: "12px 0" }} />}
          </div>
        ))
      )}

      {showInput && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a property note..."
            style={{ width: "100%", minHeight: 64, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input, var(--border-subtle))", background: "var(--bg-input, var(--bg-card))", fontSize: 12, color: "var(--text-primary)", resize: "none", outline: "none" }}
          />
          <div className="flex justify-end" style={{ marginTop: 8 }}>
            <button disabled={saving} onClick={save} style={{ background: "#E18739", color: "white", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.65 : 1 }}>{saving ? "Saving..." : "Save Note"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
