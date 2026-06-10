import { useMemo } from "react";
import { calculatePipelineForecast } from "@/lib/dealIntelligence";

export function PipelineForecast() {
  const forecast = useMemo(() => calculatePipelineForecast(), []);
  const total = forecast.confirmed + forecast.projected;
  const confirmedPct = total > 0 ? (forecast.confirmed / total) * 100 : 0;

  return (
    <div
      className="glass-card-static"
      style={{
        background: "rgba(36, 60, 81, 0.04)",
        borderColor: "rgba(36, 60, 81, 0.09)",
      }}
    >
      <div className="flex items-center gap-[8px]" style={{ padding: "20px 20px 16px 20px", borderBottom: "1px solid rgba(36,60,81,0.06)" }}>
        <h2 className="section-label">
          Pipeline Forecast — Next 90 Days
        </h2>
        <span className="text-[12px] font-medium px-[8px] py-[4px] rounded-full" style={{ background: "rgba(36,60,81,0.06)", color: "#94a3b8" }}>AI</span>
      </div>
      <div style={{ padding: "20px 20px 20px 20px" }}>
        <div className="grid grid-cols-2 gap-[24px]" style={{ marginBottom: 20 }}>
          <div className="flex flex-col">
            <p className="text-[24px] font-bold" style={{ color: "#1b2326", lineHeight: 1 }}>
              ${forecast.confirmed.toLocaleString()}
            </p>
            <p className="text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.10em", color: "#059669", marginTop: 4 }}>
              Confirmed ({forecast.confirmedCount})
            </p>
          </div>
          <div className="flex flex-col">
            <p className="text-[24px] font-bold" style={{ color: "#1b2326", lineHeight: 1 }}>
              ${forecast.projected.toLocaleString()}
            </p>
            <p className="text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.10em", color: "#7bafc8", marginTop: 4 }}>
              Projected ({forecast.projectedCount})
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex overflow-hidden" style={{ height: 8, background: "rgba(36,60,81,0.08)", borderRadius: 4 }}>
          <div
            className="h-full transition-all"
            style={{ width: `${confirmedPct}%`, background: "linear-gradient(90deg, #059669, #10b981)", borderRadius: 4 }}
          />
          <div
            className="h-full transition-all"
            style={{ width: `${100 - confirmedPct}%`, background: "linear-gradient(90deg, #7bafc8, #c0deed)", opacity: 0.7 }}
          />
        </div>

        <p className="text-[12px]" style={{ color: "#94a3b8", marginTop: 12, lineHeight: 1.6 }}>
          Projection based on {forecast.pipelineDeals} active pipeline deal{forecast.pipelineDeals !== 1 ? "s" : ""} at historical 65% close rate
        </p>
      </div>
    </div>
  );
}
