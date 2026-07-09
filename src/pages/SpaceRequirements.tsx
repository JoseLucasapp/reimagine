import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Download, Check, X, Pencil } from "lucide-react";
import { spaceRequirements, SpaceRequirement } from "@/data/spaceReqData";
import { dealBrands } from "@/data/dealsData";
import { cn } from "@/lib/utils";
import { createSpaceRequirement, updateSpaceRequirement } from "@/application/data/runtimeMutations";
import { toast } from "sonner";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";

const columns: { key: keyof SpaceRequirement; label: string; width: string }[] = [
  { key: "spaceType", label: "Space Type", width: "w-28" },
  { key: "minSF", label: "Min SF", width: "w-20" },
  { key: "maxSF", label: "Max SF", width: "w-20" },
  { key: "idealSF", label: "Ideal SF", width: "w-20" },
  { key: "minStorefrontWidth", label: "Storefront", width: "w-24" },
  { key: "power", label: "Power", width: "w-32" },
  { key: "hvac", label: "HVAC", width: "w-32" },
  { key: "gas", label: "Gas", width: "w-20" },
  { key: "waterLineSize", label: "Water", width: "w-20" },
  { key: "sewerLineSize", label: "Sewer", width: "w-20" },
  { key: "slab", label: "Slab", width: "w-28" },
  { key: "greaseTrap", label: "Grease", width: "w-20" },
  { key: "secondFloor", label: "2nd Floor", width: "w-24" },
  { key: "parking", label: "Parking", width: "w-48" },
];

export default function SpaceRequirementsPage() {
  const navigate = useNavigate();
  const runtimeDataVersion = useRuntimeDataVersion();
  const [data, setData] = useState<SpaceRequirement[]>(() => [...spaceRequirements]);
  const [editCell, setEditCell] = useState<{ rowId: string; col: keyof SpaceRequirement } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);

  useEffect(() => {
    setData([...spaceRequirements]);
  }, [runtimeDataVersion]);

  const startEdit = (rowId: string, col: keyof SpaceRequirement, value: SpaceRequirement[keyof SpaceRequirement]) => { setEditCell({ rowId, col }); setEditValue(String(value)); };
  const saveEdit = useCallback(async () => {
    if (!editCell) return;
    const current = data.find((row) => row.id === editCell.rowId);
    if (!current) return;
    const val = ["minSF", "maxSF", "idealSF"].includes(editCell.col) ? Number(editValue) || 0 : editValue;
    const next = { ...current, [editCell.col]: val } as SpaceRequirement;
    try {
      const saved = await updateSpaceRequirement(next.id, {
        brandId: next.brandId,
        brandName: next.brandName,
        spaceType: next.spaceType,
        minSF: next.minSF,
        maxSF: next.maxSF,
        idealSF: next.idealSF,
        minStorefrontWidth: next.minStorefrontWidth,
        power: next.power,
        hvac: next.hvac,
        gas: next.gas,
        waterLineSize: next.waterLineSize,
        sewerLineSize: next.sewerLineSize,
        slab: next.slab,
        greaseTrap: next.greaseTrap,
        secondFloor: next.secondFloor,
        parking: next.parking,
      });
      setData((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
      setEditCell(null);
    } catch (error) {
      toast.error("Unable to save space requirement", {
        description: error instanceof Error ? error.message : "Check Supabase permissions and try again.",
      });
    }
  }, [data, editCell, editValue]);
  const cancelEdit = () => setEditCell(null);

  const addRow = async () => {
    const brand = dealBrands.find((candidate) => !data.some((row) => row.brandId === candidate.id)) ?? dealBrands[0];
    if (!brand) {
      toast.error("Create a brand before adding space requirements.");
      return;
    }
    setSavingAdd(true);
    try {
      const newRow = await createSpaceRequirement({
        brandName: brand.name, brandId: brand.id,
        spaceType: "Retail", minSF: 0, maxSF: 0, idealSF: 0,
        minStorefrontWidth: "", power: "", hvac: "", gas: "No",
        waterLineSize: "", sewerLineSize: "", slab: "", greaseTrap: "No",
        secondFloor: "Not Allowed", parking: "",
      });
      setData((prev) => [...prev, newRow]);
      startEdit(newRow.id, "spaceType", newRow.spaceType);
    } catch (error) {
      toast.error("Unable to add space requirement", {
        description: error instanceof Error ? error.message : "Check Supabase permissions and try again.",
      });
    } finally {
      setSavingAdd(false);
    }
  };

  const handleExport = () => {
    const header = ["Brand", ...columns.map((c) => c.label)].join("\t");
    const rows = data.map((r) => [r.brandName, ...columns.map((c) => String(r[c.key]))].join("\t"));
    const text = [header, ...rows].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "space_requirements.tsv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1600, margin: "0 auto" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: -4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Space Requirements</h1>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>
            {data.length} brand specification{data.length !== 1 ? "s" : ""}
          </span>
          <button onClick={handleExport} className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide rounded-[11px] transition-colors" style={{ border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", background: "var(--bg-surface)" }}>
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={addRow} disabled={savingAdd} className="cta-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60">
            <Plus className="w-4 h-4" /> {savingAdd ? "Adding..." : "Add Brand"}
          </button>
        </div>
      </div>

      <div className="glass-table">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 sticky left-0 z-20 min-w-[160px]" style={{ background: "var(--bg-table-header)", borderRight: "1px solid var(--border-divider)" }}>Brand</th>
                {columns.map((col) => (
                  <th key={col.key} className={cn("text-left px-3 py-3 whitespace-nowrap", col.width)}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 sticky left-0 z-10" style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border-divider)" }}>
                    {editCell?.rowId === row.id && editCell.col === "brandName" ? (
                      <InlineEdit value={editValue} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} />
                    ) : (
                      <button
                        onClick={() => row.brandId ? navigate(`/brands`) : startEdit(row.id, "brandName", row.brandName)}
                        className="text-sm font-semibold text-left group flex items-center gap-1.5"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {row.brandName}
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </button>
                    )}
                  </td>
                  {columns.map((col) => {
                    const val = row[col.key];
                    const isEditing = editCell?.rowId === row.id && editCell.col === col.key;
                    return (
                      <td key={col.key} className={cn("px-3 py-3", col.width)}>
                        {isEditing ? (
                          <InlineEdit value={editValue} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} />
                        ) : (
                          <button onClick={() => startEdit(row.id, col.key, val)} className="text-sm text-left w-full group flex items-center gap-1 transition-colors" style={{ color: "var(--text-secondary)" }}>
                            <span className="truncate">{String(val)}</span>
                            <Pencil className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-30 transition-opacity" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  );
}

function InlineEdit({ value, onChange, onSave, onCancel }: { value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; }) {
  return (
    <div className="flex items-center gap-1">
      <input autoFocus value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        className="glass-input px-2 py-1 text-sm w-full min-w-[60px]"
      />
      <button onClick={onSave} className="p-0.5" style={{ color: "#059669" }}><Check className="w-3.5 h-3.5" /></button>
      <button onClick={onCancel} className="p-0.5" style={{ color: "#94a3b8" }}><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}
