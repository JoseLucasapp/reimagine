import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Download, Check, X, Pencil } from "lucide-react";
import { spaceRequirements, SpaceRequirement } from "@/data/spaceReqData";
import { dealBrands } from "@/data/dealsData";
import { createSpaceRequirement, updateSpaceRequirement } from "@/application/data/runtimeMutations";
import { toast } from "sonner";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";

const columns: { key: keyof SpaceRequirement; label: string; defaultWidth: number }[] = [
  { key: "spaceType", label: "Space Type", defaultWidth: 150 },
  { key: "minSF", label: "Min SF", defaultWidth: 90 },
  { key: "maxSF", label: "Max SF", defaultWidth: 90 },
  { key: "idealSF", label: "Ideal SF", defaultWidth: 90 },
  { key: "minStorefrontWidth", label: "Storefront", defaultWidth: 118 },
  { key: "power", label: "Power", defaultWidth: 190 },
  { key: "hvac", label: "HVAC", defaultWidth: 180 },
  { key: "gas", label: "Gas", defaultWidth: 90 },
  { key: "waterLineSize", label: "Water", defaultWidth: 90 },
  { key: "sewerLineSize", label: "Sewer", defaultWidth: 90 },
  { key: "slab", label: "Slab", defaultWidth: 150 },
  { key: "greaseTrap", label: "Grease", defaultWidth: 100 },
  { key: "secondFloor", label: "2nd Floor", defaultWidth: 120 },
  { key: "parking", label: "Parking", defaultWidth: 260 },
];

const MIN_COLUMN_WIDTH = 72;
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  brandName: 190,
  ...Object.fromEntries(columns.map((column) => [column.key, column.defaultWidth])),
};

export default function SpaceRequirementsPage() {
  const navigate = useNavigate();
  const runtimeDataVersion = useRuntimeDataVersion();
  const [data, setData] = useState<SpaceRequirement[]>(() => [...spaceRequirements]);
  const [editCell, setEditCell] = useState<{ rowId: string; col: keyof SpaceRequirement } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => ({ ...DEFAULT_COLUMN_WIDTHS }));

  useEffect(() => {
    setData([...spaceRequirements]);
  }, [runtimeDataVersion]);

  const getColumnWidth = useCallback(
    (key: string) => columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? 120,
    [columnWidths],
  );

  const startColumnResize = useCallback((key: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? 120;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX);
      setColumnWidths((prev) => ({ ...prev, [key]: nextWidth }));
    };

    const handleMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [columnWidths]);

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

  const tableWidth = getColumnWidth("brandName") + columns.reduce((total, column) => total + getColumnWidth(String(column.key)), 0);

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
          <table className="table-fixed border-separate border-spacing-0" style={{ width: tableWidth, minWidth: "100%" }}>
            <thead>
              <tr>
                <th
                  className="text-left px-4 py-3 sticky left-0 z-30"
                  style={{
                    width: getColumnWidth("brandName"),
                    minWidth: getColumnWidth("brandName"),
                    background: "var(--bg-table-header-solid)",
                    boxShadow: "1px 0 0 var(--border-divider), 8px 0 14px -8px rgba(36,60,81,0.28)",
                    color: "var(--text-primary)",
                    position: "sticky",
                  }}
                >
                  Brand
                  <ColumnResizeHandle onMouseDown={(event) => startColumnResize("brandName", event)} />
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-3 py-3 whitespace-nowrap bg-[var(--bg-table-header-solid)] relative"
                    style={{
                      width: getColumnWidth(String(col.key)),
                      minWidth: getColumnWidth(String(col.key)),
                      color: "var(--text-primary)",
                    }}
                  >
                    {col.label}
                    <ColumnResizeHandle onMouseDown={(event) => startColumnResize(String(col.key), event)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={row.id}>
                  <td
                    className="px-4 py-3 sticky left-0 z-30 overflow-hidden"
                    style={{
                      width: getColumnWidth("brandName"),
                      minWidth: getColumnWidth("brandName"),
                      background: idx % 2 === 0 ? "var(--bg-table-row-solid)" : "var(--bg-table-row-alt-solid)",
                      boxShadow: "1px 0 0 var(--border-divider), 8px 0 14px -8px rgba(36,60,81,0.28)",
                    }}
                  >
                    {editCell?.rowId === row.id && editCell.col === "brandName" ? (
                      <InlineEdit value={editValue} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} />
                    ) : (
                      <button
                        onClick={() => row.brandId ? navigate(`/brands`) : startEdit(row.id, "brandName", row.brandName)}
                        className="text-sm font-semibold text-left group flex items-center gap-1.5 max-w-full"
                        style={{ color: "var(--text-primary)" }}
                        title={row.brandName}
                      >
                        <span className="truncate">{row.brandName}</span>
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </button>
                    )}
                  </td>
                  {columns.map((col) => {
                    const val = row[col.key];
                    const isEditing = editCell?.rowId === row.id && editCell.col === col.key;
                    return (
                      <td
                        key={col.key}
                        className="px-3 py-3 overflow-hidden"
                        style={{
                          width: getColumnWidth(String(col.key)),
                          minWidth: getColumnWidth(String(col.key)),
                          background: idx % 2 === 0 ? "var(--bg-table-row-solid)" : "var(--bg-table-row-alt-solid)",
                        }}
                      >
                        {isEditing ? (
                          <InlineEdit value={editValue} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} />
                        ) : (
                          <button
                            onClick={() => startEdit(row.id, col.key, val)}
                            className="text-sm text-left w-full group flex items-center gap-1 transition-colors"
                            style={{ color: "var(--text-secondary)" }}
                            title={String(val)}
                          >
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

function ColumnResizeHandle({ onMouseDown }: { onMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      aria-label="Resize column"
      className="space-req-resize-handle"
      onMouseDown={onMouseDown}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    />
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
