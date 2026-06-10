const BRAND_INITIAL_COLORS: Record<string, string> = {
  M: "#E18739",
  T: "#243c51",
  N: "#1a5276",
  G: "#1e6091",
  d: "#6d3a7a",
  D: "#6d3a7a",
};

const BROKER_COLORS: Record<string, string> = {
  SM: "#243c51",
  MC: "#1a5276",
  JR: "#065f46",
  AL: "#5b21b6",
};

function getColorForInitial(char: string): string {
  return BRAND_INITIAL_COLORS[char] || "#4a5568";
}

function getBrokerColor(code: string): string {
  return BROKER_COLORS[code] || getColorForInitial(code.charAt(0));
}

interface BrandAvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export function BrandAvatar({ name, size = 32, className = "" }: BrandAvatarProps) {
  const initial = name.charAt(0);
  const fontSize = size <= 32 ? 14 : size <= 40 ? 16 : 18;
  return (
    <div
      className={`flex items-center justify-center shrink-0 font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: getColorForInitial(initial),
        fontSize,
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {initial}
    </div>
  );
}

interface BrokerBadgeProps {
  code: string;
  className?: string;
}

export function BrokerBadge({ code, className = "" }: BrokerBadgeProps) {
  return (
    <div
      className={`flex items-center justify-center shrink-0 font-bold text-white ${className}`}
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: getBrokerColor(code),
        fontSize: 12,
      }}
    >
      {code}
    </div>
  );
}
