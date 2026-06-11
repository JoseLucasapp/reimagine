import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import reimagineLogo from "@/assets/reimagine-logo-full.png";
import type { AuthSession } from "@/application/auth/session";
import { getRuntimeConfig } from "@/config/env";
import { signInWithSupabase, signUpWithSupabase } from "@/infrastructure/supabase/auth";

interface LoginPageProps {
  onLogin: (session: AuthSession) => void;
}

type AuthMode = "login" | "signup";

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
};

const fieldStyle: React.CSSProperties = {
  padding: "11px 14px",
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

function AuthField({ label, value, placeholder, type = "text", autoComplete, onChange }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={fieldStyle}
        onFocus={(event) => {
          event.currentTarget.style.borderColor = "rgba(36,60,81,0.40)";
        }}
        onBlur={(event) => {
          event.currentTarget.style.borderColor = "rgba(36,60,81,0.15)";
        }}
      />
    </div>
  );
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [credential, setCredential] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = mode === "login" ? "Welcome back" : "Create account";
  const subtitle = mode === "login" ? "Enter your details to access your account" : "Create your Reimagine IQ client portal account";
  const buttonLabel = useMemo(() => {
    if (isSubmitting) return mode === "login" ? "LOGGING IN..." : "CREATING ACCOUNT...";
    return mode === "login" ? "LOGIN" : "SIGN UP";
  }, [isSubmitting, mode]);

  const resetFeedback = () => {
    setError("");
    setMessage("");
  };

  const handleLogin = async () => {
    if (!getRuntimeConfig().isSupabaseConfigured) {
      setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    const result = await signInWithSupabase(credential, password);
    if (result.ok) {
      onLogin({ accessToken: result.session.accessToken, role: result.session.role });
      return;
    }
    setError(result.message);
  };

  const handleSignup = async () => {
    if (!getRuntimeConfig().isSupabaseConfigured) {
      setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!email.includes("@")) {
      setError("Use a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must have at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const result = await signUpWithSupabase({ fullName, email, password, username });
    if (result.ok) {
      onLogin({ accessToken: result.session.accessToken, role: result.session.role });
      return;
    }

    if (result.message.includes("confirmation")) {
      setMessage(result.message);
      setMode("login");
      return;
    }
    setError(result.message);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setIsSubmitting(true);
    const action = mode === "login" ? handleLogin() : handleSignup();
    void action.finally(() => setIsSubmitting(false));
  };

  const switchMode = () => {
    resetFeedback();
    setMode((current) => (current === "login" ? "signup" : "login"));
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
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 400,
          height: 400,
          bottom: -100,
          right: -60,
          background: "radial-gradient(circle, rgba(225,135,57,0.12), transparent)",
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
            {title}
          </h1>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28 }}>{subtitle}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            {mode === "login" ? (
              <AuthField
                label="Username"
                value={credential}
                onChange={setCredential}
                placeholder="Username"
                autoComplete="username"
              />
            ) : (
              <>
                <AuthField label="Full name" value={fullName} onChange={setFullName} placeholder="Full name" autoComplete="name" />
                <AuthField label="Email" value={email} onChange={setEmail} placeholder="email@company.com" type="email" autoComplete="email" />
                <AuthField label="Username" value={username} onChange={setUsername} placeholder="Optional username" autoComplete="username" />
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  style={{ ...fieldStyle, padding: "11px 40px 11px 14px" }}
                  onFocus={(event) => {
                    event.currentTarget.style.borderColor = "rgba(36,60,81,0.40)";
                  }}
                  onBlur={(event) => {
                    event.currentTarget.style.borderColor = "rgba(36,60,81,0.15)";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    style={{ fontSize: 14, color: "#6B7280", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.color = "#243c51";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.color = "#6B7280";
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {mode === "signup" && (
              <AuthField
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="••••••••"
                type="password"
                autoComplete="new-password"
              />
            )}

            {error && (
              <div
                role="alert"
                style={{
                  fontSize: 13,
                  color: "#b42318",
                  background: "#FEF3F2",
                  border: "1px solid #FECDCA",
                  padding: "8px 12px",
                  borderRadius: 8,
                }}
              >
                {error}
              </div>
            )}
            {message && (
              <div
                role="status"
                style={{
                  fontSize: 13,
                  color: "#065f46",
                  background: "#ecfdf3",
                  border: "1px solid #abefc6",
                  padding: "8px 12px",
                  borderRadius: 8,
                }}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              style={{
                background: "#243c51",
                color: "#ffffff",
                padding: "12px 0",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: "none",
                cursor: isSubmitting ? "wait" : "pointer",
                boxShadow: "0 4px 14px rgba(36,60,81,0.25)",
                transition: "background 0.2s",
                marginTop: 2,
                opacity: isSubmitting ? 0.75 : 1,
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#1a2f3f";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "#243c51";
              }}
            >
              {buttonLabel}
            </button>
          </form>

          {mode === "login" && (
            <>
              <div className="flex items-center" style={{ gap: 12, margin: "22px 0" }}>
                <div className="flex-1" style={{ height: 1, background: "rgba(36,60,81,0.08)" }} />
                <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>or</span>
                <div className="flex-1" style={{ height: 1, background: "rgba(36,60,81,0.08)" }} />
              </div>

              <div className="flex flex-col gap-2.5">
                <SocialButton label="Continue with Google" provider="google" onClick={() => setError("Google SSO is not configured yet.")} />
                <SocialButton label="Continue with Microsoft" provider="microsoft" onClick={() => setError("Microsoft SSO is not configured yet.")} />
              </div>
            </>
          )}

          <p className="text-center" style={{ fontSize: 14, color: "#6B7280", marginTop: 22 }}>
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={switchMode}
              style={{ fontWeight: 600, color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.color = "#E18739";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.color = "var(--text-primary)";
              }}
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function SocialButton({ label, provider, onClick }: { label: string; provider: "google" | "microsoft"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center"
      style={{
        gap: 10,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-input)",
        borderRadius: 10,
        padding: "10px 0",
        fontSize: 14,
        fontWeight: 500,
        color: "#374151",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = "var(--bg-nav-hover)";
        event.currentTarget.style.borderColor = "var(--border-card)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "var(--bg-surface)";
        event.currentTarget.style.borderColor = "var(--border-input)";
      }}
    >
      {provider === "google" ? (
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 000 24c0 3.77.9 7.34 2.44 10.51l8.09-5.92z" />
          <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
          <path fill="#f35325" d="M1 1h10v10H1z" />
          <path fill="#81bc06" d="M12 1h10v10H12z" />
          <path fill="#05a6f0" d="M1 12h10v10H1z" />
          <path fill="#ffba08" d="M12 12h10v10H12z" />
        </svg>
      )}
      {label}
    </button>
  );
}
