import { useState } from "react";
import { X, Link2 } from "lucide-react";

export interface DealLinksEditorValues {
  marketStudyUrl: string;
  mapUrl: string;
}

interface DealLinksEditorModalProps {
  dealId: string;
  initial: DealLinksEditorValues;
  onClose: () => void;
  onSave: (values: DealLinksEditorValues) => void | Promise<void>;
}

const LINK_DEFAULT = "https://";

function isValidUrl(u: string): boolean {
  const t = u.trim();
  if (!t || t === LINK_DEFAULT) return true;
  try {
    const parsed = new URL(t);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function DealLinksEditorModal({ initial, onClose, onSave }: DealLinksEditorModalProps) {
  const [marketStudyUrl, setMarketStudyUrl] = useState(initial.marketStudyUrl || LINK_DEFAULT);
  const [mapUrl, setMapUrl] = useState(initial.mapUrl || LINK_DEFAULT);
  const [saving, setSaving] = useState(false);

  const marketValid = isValidUrl(marketStudyUrl);
  const mapValid = isValidUrl(mapUrl);
  const canSave = marketValid && mapValid && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ marketStudyUrl: marketStudyUrl.trim(), mapUrl: mapUrl.trim() });
    } catch {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit deal links"
        style={{
          position: "relative",
          background: "var(--bg-surface)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-divider)" }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <Link2 className="w-4 h-4" style={{ color: "#E18739" }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Edit Deal Links</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
          >
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label htmlFor="market-study-url" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
              Market Study URL
            </label>
            <input
              id="market-study-url"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={marketStudyUrl}
              onChange={(e) => setMarketStudyUrl(e.target.value)}
              className="app-input"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 14,
                color: "var(--text-primary)",
                borderRadius: 8,
                border: `1px solid ${marketValid ? "var(--border-subtle)" : "#991b1b"}`,
                background: "var(--bg-input)",
              }}
            />
            {!marketValid && (
              <span style={{ fontSize: 12, color: "#991b1b" }}>Enter a valid URL starting with http:// or https://</span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label htmlFor="map-url" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
              Map URL
            </label>
            <input
              id="map-url"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              className="app-input"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 14,
                color: "var(--text-primary)",
                borderRadius: 8,
                border: `1px solid ${mapValid ? "var(--border-subtle)" : "#991b1b"}`,
                background: "var(--bg-input)",
              }}
            />
            {!mapValid && (
              <span style={{ fontSize: 12, color: "#991b1b" }}>Enter a valid URL starting with http:// or https://</span>
            )}
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              If left empty, the Map button opens Google Maps with the deal address.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end" style={{ gap: 8, padding: 16, borderTop: "1px solid var(--border-divider)" }}>
          <button
            type="button"
            onClick={onClose}
            className="cta-secondary"
            style={{ padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              background: "#E18739",
              color: "#fff",
              border: "none",
              cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.5,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
