import type { AiFeedbackRating } from "@/application/ai/types";
import type { CSSProperties } from "react";

type AIInsightFeedbackProps = {
  value: AiFeedbackRating | null;
  onChange: (rating: AiFeedbackRating) => void;
  size?: "sm" | "md";
};

function buttonStyle(active: boolean, hasSelection: boolean, size: "sm" | "md"): CSSProperties {
  const dimension = size === "sm" ? 22 : 28;

  return {
    alignItems: "center",
    background: active ? "rgba(225, 135, 57, 0.14)" : "transparent",
    border: `1px solid ${active ? "rgba(225, 135, 57, 0.45)" : "transparent"}`,
    borderRadius: 999,
    display: "inline-flex",
    filter: hasSelection && !active ? "grayscale(0.75) saturate(0.45)" : "none",
    fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
    fontSize: size === "sm" ? 12 : 16,
    height: dimension,
    justifyContent: "center",
    lineHeight: 1,
    opacity: hasSelection ? (active ? 1 : 0.28) : 0.72,
    padding: 0,
    transition: "background 0.15s ease, border-color 0.15s ease, filter 0.15s ease, opacity 0.15s ease, transform 0.15s ease",
    width: dimension,
  };
}

export function AIInsightFeedback({ value, onChange, size = "sm" }: AIInsightFeedbackProps) {
  const hasSelection = value !== null;

  return (
    <div className="flex items-center" style={{ gap: size === "sm" ? 4 : 8 }}>
      <button
        type="button"
        aria-label="Helpful"
        aria-pressed={value === "up"}
        onClick={() => onChange("up")}
        className="hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E18739]/40"
        style={buttonStyle(value === "up", hasSelection, size)}
      >
        👍
      </button>
      <button
        type="button"
        aria-label="Not helpful"
        aria-pressed={value === "down"}
        onClick={() => onChange("down")}
        className="hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E18739]/40"
        style={buttonStyle(value === "down", hasSelection, size)}
      >
        👎
      </button>
    </div>
  );
}
