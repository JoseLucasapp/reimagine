import { useState } from "react";
import { Columns3, Save } from "lucide-react";
import { toast } from "sonner";
import type { DealRecord } from "@/data/dealsData";
import { getSitesByDeal, type Site } from "@/data/mapRuntimeData";
import { siteToMutationInput, updateSite } from "@/application/data/runtimeMutations";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";

type LOIComparisonTabProps = {
  deal: DealRecord;
};

type LoiDraft = {
  baseRent: string;
  nnn: string;
  grossMonthlyRent: string;
  leaseTerm: string;
  commencementDate: string;
  tiAllowance: string;
  notes: string;
};

function siteDraft(site: Site): LoiDraft {
  return {
    baseRent: site.loiTerms.baseRent,
    nnn: site.loiTerms.nnn,
    grossMonthlyRent: site.loiTerms.grossMonthlyRent,
    leaseTerm: site.loiTerms.leaseTerm || site.leaseTerm,
    commencementDate: site.loiTerms.commencementDate,
    tiAllowance: site.loiTerms.tiAllowance,
    notes: site.loiTerms.notes,
  };
}

function setSiteDraftValue(drafts: Record<string, LoiDraft>, site: Site, key: keyof LoiDraft, value: string): Record<string, LoiDraft> {
  const current = drafts[site.id] ?? siteDraft(site);
  return { ...drafts, [site.id]: { ...current, [key]: value } };
}

function formatMoneyLabel(value: string): string {
  if (!value.trim()) return "—";
  return value.startsWith("$") ? value : `$${value}`;
}

export function LOIComparisonTab({ deal }: LOIComparisonTabProps) {
  useRuntimeDataVersion();
  const sites = getSitesByDeal(deal.id);
  const [drafts, setDrafts] = useState<Record<string, LoiDraft>>({});
  const [savingSiteId, setSavingSiteId] = useState<string | null>(null);

  const saveSite = async (site: Site) => {
    const draft = drafts[site.id] ?? siteDraft(site);
    setSavingSiteId(site.id);
    try {
      await updateSite(site.id, {
        ...siteToMutationInput(site),
        leaseTerm: draft.leaseTerm,
        baseRent: draft.baseRent,
        nnn: draft.nnn,
        grossMonthlyRent: draft.grossMonthlyRent,
        commencementDate: draft.commencementDate,
        tiAllowance: draft.tiAllowance,
        loiNotes: draft.notes,
      });
      toast.success("LOI terms saved", { description: site.name || site.address });
    } catch (error) {
      toast.error("Unable to save LOI terms", {
        description: error instanceof Error ? error.message : "Check your Supabase permissions and try again.",
      });
    } finally {
      setSavingSiteId(null);
    }
  };

  const bestGrossRent = sites
    .map((site) => Number((site.loiTerms.grossMonthlyRent || "").replace(/[^0-9.]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)[0];

  return (
    <div className="space-y-5">
      <div className="glass-card-static" style={{ padding: 24, borderRadius: 16, position: "relative", overflow: "hidden" }}>
        <div className="absolute top-0 left-0 right-0" style={{ height: 3, background: "linear-gradient(to right, #E18739, #c0deed)" }} />
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(225,135,57,0.12)", color: "#b85c1a" }}>
              <Columns3 className="h-5 w-5" />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>LOI Comparison</h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, maxWidth: 620, lineHeight: 1.6 }}>
                Compare real LOI terms stored for each site in this deal. Changes are saved directly to Supabase.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <SummaryPill label="Sites" value={String(sites.length)} />
            <SummaryPill label="With LOI" value={String(sites.filter((site) => site.loiUrl || site.loiTerms.baseRent || site.loiTerms.grossMonthlyRent).length)} />
            <SummaryPill label="Best Rent" value={bestGrossRent ? `$${bestGrossRent.toLocaleString()}` : "—"} />
          </div>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="glass-card-static flex flex-col items-center justify-center text-center" style={{ padding: 48, borderRadius: 16, minHeight: 280 }}>
          <Columns3 className="h-10 w-10" style={{ color: "var(--text-muted)" }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 14 }}>No sites available for comparison</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, maxWidth: 420, lineHeight: 1.6 }}>
            Add sites in the Top Sites tab first. Once saved, their lease and LOI terms appear here automatically.
          </p>
        </div>
      ) : (
        <div className="glass-card-static overflow-hidden" style={{ borderRadius: 16 }}>
          <div className="themed-scrollbar overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr style={{ background: "rgba(36,60,81,0.04)", borderBottom: "1px solid var(--border-divider)" }}>
                  <HeaderCell>Property</HeaderCell>
                  <HeaderCell>Base Rent</HeaderCell>
                  <HeaderCell>NNN</HeaderCell>
                  <HeaderCell>Gross Monthly</HeaderCell>
                  <HeaderCell>Lease Term</HeaderCell>
                  <HeaderCell>Commencement</HeaderCell>
                  <HeaderCell>TI Allowance</HeaderCell>
                  <HeaderCell>Notes</HeaderCell>
                  <HeaderCell>Action</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const draft = drafts[site.id] ?? siteDraft(site);
                  return (
                    <tr key={site.id} style={{ borderBottom: "1px solid var(--border-divider)" }}>
                      <td className="px-4 py-4 align-top">
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{site.name || site.address}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{site.city}, {site.state}</div>
                        <div className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(36,60,81,0.07)", color: "var(--text-secondary)" }}>
                          {site.statusLabel || site.stage}
                        </div>
                      </td>
                      <InputCell value={draft.baseRent} placeholder="$0" onChange={(value) => setDrafts((prev) => setSiteDraftValue(prev, site, "baseRent", value))} />
                      <InputCell value={draft.nnn} placeholder="$0" onChange={(value) => setDrafts((prev) => setSiteDraftValue(prev, site, "nnn", value))} />
                      <InputCell value={draft.grossMonthlyRent} placeholder="$0" helper={formatMoneyLabel(draft.grossMonthlyRent)} onChange={(value) => setDrafts((prev) => setSiteDraftValue(prev, site, "grossMonthlyRent", value))} />
                      <InputCell value={draft.leaseTerm} placeholder="10 years" onChange={(value) => setDrafts((prev) => setSiteDraftValue(prev, site, "leaseTerm", value))} />
                      <InputCell value={draft.commencementDate} type="date" onChange={(value) => setDrafts((prev) => setSiteDraftValue(prev, site, "commencementDate", value))} />
                      <InputCell value={draft.tiAllowance} placeholder="$0" onChange={(value) => setDrafts((prev) => setSiteDraftValue(prev, site, "tiAllowance", value))} />
                      <td className="px-3 py-4 align-top">
                        <textarea
                          value={draft.notes}
                          onChange={(event) => setDrafts((prev) => setSiteDraftValue(prev, site, "notes", event.target.value))}
                          className="glass-input themed-scrollbar min-h-[76px] w-56 resize-none px-3 py-2 text-xs"
                          placeholder="LOI notes"
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => saveSite(site)}
                          disabled={savingSiteId === site.id}
                          className="inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-60"
                          style={{ background: "#243c51", color: "white" }}
                        >
                          <Save className="h-3.5 w-3.5" />
                          {savingSiteId === site.id ? "Saving" : "Save"}
                        </button>
                        {site.loiUrl && (
                          <a href={site.loiUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-semibold" style={{ color: "var(--text-orange-ui)" }}>
                            View LOI
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "rgba(36,60,81,0.04)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>{children}</th>;
}

function InputCell({ value, onChange, placeholder, type = "text", helper }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string; helper?: string }) {
  return (
    <td className="px-3 py-4 align-top">
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="glass-input w-36 px-3 py-2 text-xs"
      />
      {helper && <div className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>{helper}</div>}
    </td>
  );
}
