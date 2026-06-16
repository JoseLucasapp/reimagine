import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, FileText, Link2, Loader2, Save, Upload, X } from "lucide-react";
import type { DealDocuments } from "@/data/dealsData";
import { fileNameFromStorageValue, uploadDealDocumentFile } from "@/infrastructure/supabase/storage";

export type DealDocumentKey = keyof DealDocuments;

type DealDocumentDescriptor = {
  key: DealDocumentKey;
  label: string;
};

type DealDocumentGroup = {
  label: string;
  docs: DealDocumentDescriptor[];
};

export const DEAL_DOCUMENT_GROUPS: DealDocumentGroup[] = [
  {
    label: "AGREEMENTS",
    docs: [
      { key: "engagementLetter", label: "Engagement Letter" },
      { key: "cobrokerAgreement", label: "Co-Broker Agreement" },
    ],
  },
  {
    label: "MARKETING",
    docs: [
      { key: "flyer", label: "Flyer" },
      { key: "demo", label: "Demo" },
    ],
  },
  {
    label: "TRANSACTION",
    docs: [
      { key: "signedLOI", label: "Signed LOI" },
      { key: "floorPlan", label: "Floor Plan" },
      { key: "approvalPackage", label: "Approval Package" },
      { key: "commissionAgreement", label: "Commission Agreement" },
      { key: "signedLease", label: "Signed Lease" },
    ],
  },
];

export const ALL_DEAL_DOCUMENTS = DEAL_DOCUMENT_GROUPS.flatMap((group) => group.docs);

function normalizeDocumentValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "https://") return null;
  return trimmed;
}

function fileNameFromValue(value: string): string {
  return fileNameFromStorageValue(value);
}

function isLikelyUrlOrPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function DealDocumentsManagerModal({
  open,
  onClose,
  documents,
  editable,
  onSave,
  dealId,
}: {
  open: boolean;
  onClose: () => void;
  documents: DealDocuments;
  editable: boolean;
  onSave: (documents: DealDocuments) => Promise<void> | void;
  dealId: string;
}) {
  const [draft, setDraft] = useState<DealDocuments>(documents);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<DealDocumentKey | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(documents);
    setSaving(false);
    setError(null);
    setUploadingKey(null);
  }, [documents, open]);

  const filedCount = useMemo(() => Object.values(draft).filter(Boolean).length, [draft]);
  const invalidKeys = useMemo(
    () => ALL_DEAL_DOCUMENTS.filter((doc) => !isLikelyUrlOrPath(draft[doc.key] ?? "")).map((doc) => doc.label),
    [draft],
  );

  if (!open) return null;

  const setDocumentValue = (key: DealDocumentKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };
  const handleUpload = async (key: DealDocumentKey, file: File | null) => {
    if (!file || !editable) return;

    setUploadingKey(key);
    setError(null);
    try {
      const publicUrl = await uploadDealDocumentFile({ dealId, documentKey: key, file });
      setDocumentValue(key, publicUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload file. Please try again.");
    } finally {
      setUploadingKey(null);
    }
  };


  const handleSave = async () => {
    if (!editable) return;
    if (invalidKeys.length > 0) {
      setError(`Use a valid URL or app path for: ${invalidKeys.join(", ")}.`);
      return;
    }

    const cleaned = ALL_DEAL_DOCUMENTS.reduce<DealDocuments>((acc, doc) => {
      acc[doc.key] = normalizeDocumentValue(draft[doc.key] ?? "");
      return acc;
    }, { ...draft });

    setSaving(true);
    try {
      await onSave(cleaned);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4" style={{ background: "rgba(15,23,42,0.50)", backdropFilter: "blur(4px)" }}>
      <button type="button" aria-label="Close documents" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxWidth: 760,
          maxHeight: "88vh",
          borderRadius: 18,
          background: "hsl(var(--background))",
          border: "1px solid var(--border-card)",
          boxShadow: "0 24px 80px rgba(15,23,42,0.22)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4" style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border-divider)" }}>
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(225,135,57,0.12)", color: "#E18739" }}
            >
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, lineHeight: 1.25, fontWeight: 750, color: "var(--text-primary)" }}>Deal Documents</h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {editable ? "Paste a document link or upload a file directly to Supabase Storage." : "Review the documents filed for this deal."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="transition-colors"
            style={{ width: 32, height: 32, border: "1px solid var(--border-subtle)", borderRadius: 10, background: "var(--bg-card)", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X className="w-4 h-4 mx-auto" />
          </button>
        </div>

        <div className="themed-scrollbar overflow-y-auto" style={{ maxHeight: "calc(88vh - 150px)", padding: "18px 24px 24px" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <div style={{ height: 8, flex: 1, borderRadius: 999, background: "rgba(36,60,81,0.08)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round((filedCount / ALL_DEAL_DOCUMENTS.length) * 100)}%`,
                  borderRadius: 999,
                  background: filedCount === ALL_DEAL_DOCUMENTS.length ? "#059669" : "linear-gradient(90deg, #243c51, #E18739)",
                }}
              />
            </div>
            <span style={{ marginLeft: 14, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
              {filedCount} of {ALL_DEAL_DOCUMENTS.length} filed
            </span>
          </div>

          {error && (
            <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(153,27,27,0.07)", border: "1px solid rgba(153,27,27,0.14)", color: "#991b1b", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-5">
            {DEAL_DOCUMENT_GROUPS.map((group) => (
              <section key={group.label}>
                <span style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 750, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  {group.label}
                </span>
                <div className="flex flex-col gap-2">
                  {group.docs.map((doc) => {
                    const value = draft[doc.key] ?? "";
                    const hasValue = Boolean(value.trim());
                    const invalid = !isLikelyUrlOrPath(value);
                    const uploading = uploadingKey === doc.key;
                    return (
                      <div
                        key={doc.key}
                        className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-center"
                        style={{
                          padding: "12px",
                          borderRadius: 12,
                          border: invalid ? "1px solid rgba(153,27,27,0.22)" : "1px solid var(--border-subtle)",
                          background: hasValue ? "rgba(5,150,105,0.035)" : "var(--bg-card)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="flex items-center justify-center"
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              background: hasValue ? "rgba(5,150,105,0.12)" : "rgba(100,116,139,0.10)",
                              color: hasValue ? "#059669" : "var(--text-muted)",
                            }}
                          >
                            {hasValue ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 650, color: "var(--text-primary)" }}>{doc.label}</span>
                        </div>

                        {editable ? (
                          <div className="flex flex-col gap-2">
                            <input
                              value={value}
                              onChange={(event) => setDocumentValue(doc.key, event.target.value)}
                              placeholder="Paste file URL or upload a file..."
                              className="glass-input w-full px-3 py-2 text-sm"
                              style={{ borderColor: invalid ? "rgba(153,27,27,0.35)" : undefined }}
                            />
                            <div className="flex items-center gap-2">
                              <label
                                className="inline-flex items-center gap-1.5"
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 9,
                                  border: "1px dashed var(--border-subtle)",
                                  background: "hsl(var(--background))",
                                  color: uploading ? "var(--text-muted)" : "var(--text-secondary)",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: uploading ? "not-allowed" : "pointer",
                                  opacity: uploading ? 0.65 : 1,
                                }}
                              >
                                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                {uploading ? "Uploading..." : hasValue ? "Replace file" : "Upload file"}
                                <input
                                  type="file"
                                  className="sr-only"
                                  disabled={uploading}
                                  onChange={(event) => {
                                    const file = event.currentTarget.files?.[0] ?? null;
                                    void handleUpload(doc.key, file);
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>
                              {hasValue && (
                                <span style={{ minWidth: 0, color: "var(--text-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {fileNameFromValue(value)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: hasValue ? "var(--text-secondary)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {hasValue ? fileNameFromValue(value) : "Not filed"}
                          </span>
                        )}

                        <div className="flex items-center justify-end gap-2">
                          {hasValue && isLikelyUrlOrPath(value) && (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1"
                              style={{ fontSize: 12, fontWeight: 700, color: "var(--text-orange-ui)" }}
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {editable && hasValue && (
                            <button
                              type="button"
                              onClick={() => setDocumentValue(doc.key, "")}
                              style={{ fontSize: 12, fontWeight: 650, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3" style={{ padding: "16px 24px", borderTop: "1px solid var(--border-divider)", background: "var(--bg-card)" }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 14px", border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 650, cursor: "pointer" }}>
            {editable ? "Cancel" : "Close"}
          </button>
          {editable && (
            <button type="button" onClick={handleSave} disabled={saving} className="cta-primary inline-flex items-center gap-2" style={{ minHeight: 38, opacity: saving ? 0.75 : 1 }}>
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save documents"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
