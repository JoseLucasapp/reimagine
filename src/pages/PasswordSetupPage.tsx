import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import reimagineLogo from "@/assets/reimagine-logo-full.png";
import type { AuthSession } from "@/application/auth/session";
import { completeSupabasePasswordSetup } from "@/infrastructure/supabase/auth";

interface PasswordSetupPageProps {
  onComplete: (session: AuthSession) => void;
}

function readLinkParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = window.location.hash.replace(/^#/, "");
  const search = window.location.search.replace(/^\?/, "");
  return new URLSearchParams(hash || search);
}

const fieldStyle: React.CSSProperties = {
  padding: "11px 40px 11px 14px",
  fontSize: 14,
  borderRadius: 10,
  border: "1px solid var(--border-input)",
  background: "var(--bg-surface)",
  outline: "none",
  color: "var(--text-primary)",
  width: "100%",
  transition: "border-color 0.15s",
  fontFamily: "Inter, system-ui, sans-serif",
};

export default function PasswordSetupPage({ onComplete }: PasswordSetupPageProps) {
  const params = useMemo(() => readLinkParams(), []);
  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token");
  const linkType = params.get("type");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasValidLink = Boolean(accessToken) && (!linkType || ["invite", "recovery", "signup", "magiclink"].includes(linkType));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!hasValidLink) {
      setError("This setup link is invalid or expired. Ask an admin to resend access.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = await completeSupabasePasswordSetup(accessToken, refreshToken, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage("Password set. Opening Reimagine IQ...");
    window.history.replaceState({}, "", "/");
    onComplete(result.session);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8"
      style={{ background: "var(--bg-main)", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 600,
          height: 600,
          top: -200,
          left: -100,
          background: "radial-gradient(circle, rgba(192,222,237,0.45), transparent)",
          filter: "blur(80px)",
        }}
      />
      <div className="relative z-10 w-full max-w-[440px]">
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(36,60,81,0.08), 0 1px 4px rgba(36,60,81,0.04)",
            padding: "40px 36px 36px",
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <img src={reimagineLogo} alt="Reimagine" style={{ height: 32 }} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.2 }}>
            Set your password
          </h1>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28 }}>
            Create a password to finish setting up your Reimagine IQ account.
          </p>

          {!hasValidLink ? (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(185,28,28,0.20)",
                background: "rgba(185,28,28,0.08)",
                color: "#b91c1c",
                padding: 14,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              This setup link is invalid or expired. Ask a Reimagine admin to resend access.
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-[18px]">
              <PasswordField
                label="New password"
                value={password}
                showPassword={showPassword}
                onChange={setPassword}
                onToggle={() => setShowPassword((current) => !current)}
              />
              <PasswordField
                label="Confirm password"
                value={confirmPassword}
                showPassword={showPassword}
                onChange={setConfirmPassword}
                onToggle={() => setShowPassword((current) => !current)}
              />

              {error && (
                <div style={{ color: "#b91c1c", background: "rgba(185,28,28,0.08)", border: "1px solid rgba(185,28,28,0.18)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                  {error}
                </div>
              )}
              {message && (
                <div className="flex items-center gap-2" style={{ color: "#047857", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                  <CheckCircle2 className="h-4 w-4" />
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  height: 46,
                  borderRadius: 10,
                  border: "none",
                  background: "#E18739",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: submitting ? "wait" : "pointer",
                  opacity: submitting ? 0.72 : 1,
                }}
              >
                {submitting ? "SETTING PASSWORD..." : "SET PASSWORD"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  showPassword,
  onChange,
  onToggle,
}: {
  label: string;
  value: string;
  showPassword: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>{label}</label>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          style={fieldStyle}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
