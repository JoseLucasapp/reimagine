import { Lock } from "lucide-react";

interface LockableFieldLabelProps {
  label: string;
  locked: boolean;
  className?: string;
}

/**
 * Field label with an inline 12px lock icon when the field is read-only
 * for the current role. Pure presentation — the input itself should be
 * conditionally rendered as plain text by the caller when `locked` is true.
 */
export function LockableFieldLabel({ label, locked, className = "" }: LockableFieldLabelProps) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: 4 }}>
      <span>{label}</span>
      {locked && (
        <Lock
          aria-label="Read only"
          style={{ width: 12, height: 12, color: "var(--text-muted)", flexShrink: 0 }}
        />
      )}
    </span>
  );
}

interface ReadOnlyValueProps {
  value: React.ReactNode;
  className?: string;
}

/** Plain-text presentation used in place of an input when a field is locked. */
export function ReadOnlyValue({ value, className = "" }: ReadOnlyValueProps) {
  return (
    <span
      className={className}
      style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5, display: "inline-block" }}
    >
      {value || "—"}
    </span>
  );
}

interface ConfidentialValueProps {
  hidden: boolean;
  children: React.ReactNode;
  /** What to render when hidden. Defaults to an em-dash. */
  fallback?: React.ReactNode;
}

/**
 * Wraps a financial / sensitive value. When `hidden` is true (e.g. franchisee
 * role viewing commission), renders a neutral fallback instead of the value.
 */
export function ConfidentialValue({ hidden, children, fallback = "—" }: ConfidentialValueProps) {
  if (hidden) {
    return (
      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }} aria-label="Restricted">
        {fallback}
      </span>
    );
  }
  return <>{children}</>;
}
