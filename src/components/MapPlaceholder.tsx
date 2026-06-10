interface MapPlaceholderProps {
  city: string;
  state: string;
  address?: string;
  className?: string;
}

export function MapPlaceholder({ city, state, address, className = "" }: MapPlaceholderProps) {
  const label = address ? `${address} · ${city}, ${state}` : `${city}, ${state}`;

  return (
    <div className={`relative overflow-hidden w-full h-full ${className}`}>
      {/* Layer 1: base gradient */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(145deg, #e8eff5 0%, #dce8f0 50%, #d4e2ec 100%)" }} />

      {/* Layer 2: street grid SVG */}
      <svg className="absolute inset-0 w-full h-full">
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 40} x2="100%" y2={i * 40} stroke="rgba(36,60,81,0.07)" strokeWidth="1" />
        ))}
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 64} y1="0" x2={i * 64} y2="100%" stroke="rgba(36,60,81,0.07)" strokeWidth="1" />
        ))}
        <line x1="0" y1="30%" x2="100%" y2="70%" stroke="rgba(255,255,255,0.60)" strokeWidth="4" />
        <line x1="20%" y1="0" x2="80%" y2="100%" stroke="rgba(255,255,255,0.60)" strokeWidth="4" />
      </svg>

      {/* Layer 3: building block shapes */}
      <div className="absolute" style={{ top: "15%", left: "10%", width: 80, height: 40, borderRadius: 8, background: "rgba(36,60,81,0.06)" }} />
      <div className="absolute" style={{ top: "60%", left: "65%", width: 64, height: 48, borderRadius: 8, background: "rgba(36,60,81,0.06)" }} />
      <div className="absolute" style={{ top: "25%", left: "72%", width: 72, height: 32, borderRadius: 8, background: "rgba(36,60,81,0.06)" }} />
      <div className="absolute" style={{ top: "70%", left: "20%", width: 56, height: 48, borderRadius: 8, background: "rgba(36,60,81,0.06)" }} />

      {/* Center pin */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full"
            style={{
              width: 40, height: 40,
              background: "rgba(225,135,57,0.15)",
              animation: "mapPulse 2s ease-in-out infinite",
            }}
          />
          <div
            className="relative rounded-full flex items-center justify-center"
            style={{
              width: 20, height: 20,
              background: "#E18739",
              boxShadow: "0 4px 16px rgba(225,135,57,0.45)",
            }}
          >
            <div className="rounded-full bg-white" style={{ width: 8, height: 8 }} />
          </div>
        </div>

        <div
          className="bg-white"
          style={{
            padding: "4px 16px 4px 16px",
            borderRadius: 9999,
            boxShadow: "0 2px 12px rgba(36,60,81,0.12)",
            fontSize: 12, fontWeight: 600,
            color: "var(--text-primary)",
            marginTop: 8,
          }}
        >
          {label}
        </div>
      </div>

      {/* Bottom-right corner label */}
      <div
        className="absolute z-10"
        style={{
          bottom: 12, right: 12,
          background: "rgba(255,255,255,0.82)",
          padding: "4px 12px 4px 12px",
          borderRadius: 4,
          fontSize: 12, color: "var(--text-muted)",
        }}
      >
        Map · {city}, {state}
      </div>

      <style>{`
        @keyframes mapPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
