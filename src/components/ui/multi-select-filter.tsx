import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  triggerClassName?: string;
  /** Width of the dropdown panel; defaults to match trigger min-width. */
  panelMinWidth?: number;
}

/**
 * Multi-select filter dropdown with checkboxes, OR-logic.
 * Empty `value` array = no filter applied (shows all).
 */
export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  className,
  triggerClassName,
  panelMinWidth = 240,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const count = value.length;

  const triggerLabel =
    count === 0
      ? label
      : count === 1
      ? `${label}: ${options.find((o) => o.value === value[0])?.label ?? value[0]}`
      : `${label}: ${count} selected`;

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const clear = () => onChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "glass-input flex items-center justify-between truncate",
            triggerClassName,
          )}
          style={{
            height: 36,
            padding: "0 12px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-primary)",
            gap: 8,
          }}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("p-0", className)}
        style={{
          minWidth: panelMinWidth,
          borderRadius: 12,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--border-divider)",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {label}
          </span>
          {count > 0 && (
            <button
              type="button"
              onClick={clear}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#E18739",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div
          className="flex flex-col"
          style={{ maxHeight: 320, overflowY: "auto", padding: 4 }}
        >
          {options.length === 0 && (
            <div
              style={{
                padding: "12px 12px",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              No options
            </div>
          )}
          {options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex items-center transition-colors"
                style={{
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(36,60,81,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: checked ? "1px solid #E18739" : "1px solid var(--border-strong, #cbd5e1)",
                    background: checked ? "#E18739" : "transparent",
                  }}
                >
                  {checked && <Check className="w-3 h-3" style={{ color: "white" }} strokeWidth={3} />}
                </span>
                <span
                  className="truncate"
                  style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
