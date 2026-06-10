import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import reimagineLogo from "@/assets/reimagine-logo-full.png";
import type { AuthSession } from "@/application/auth/session";
import { getRuntimeConfig } from "@/config/env";
import { signInWithSupabase } from "@/infrastructure/supabase/auth";

interface LoginPageProps {
  onLogin: (session: AuthSession) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const VALID_USER = "Reimagine";
  const VALID_PASS = "Imagine#12345";

  const attemptLogin = async () => {
    setIsSubmitting(true);
    try {
      const username = email.trim();
      if (getRuntimeConfig().isSupabaseConfigured && username.includes("@")) {
        const result = await signInWithSupabase(username, password);
        if (result.ok) {
          setError("");
          onLogin({ accessToken: result.session.accessToken, role: result.session.role });
          return;
        }
        setError(result.message);
        return;
      }

      if (username === VALID_USER && password === VALID_PASS) {
        setError("");
        onLogin({ accessToken: null, role: "admin" });
      } else {
        setError("Invalid username or password");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void attemptLogin();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "var(--bg-main)" }}
    >
      {/* Decorative orbs */}
      <div className="absolute rounded-full pointer-events-none" style={{ width: 600, height: 600, top: -200, left: -100, background: "radial-gradient(circle, rgba(192,222,237,0.45), transparent)", filter: "blur(80px)" }} />
      <div className="absolute rounded-full pointer-events-none" style={{ width: 400, height: 400, bottom: -100, right: -60, background: "radial-gradient(circle, rgba(225,135,57,0.12), transparent)", filter: "blur(80px)" }} />

      <div className="relative z-10 w-full max-w-[440px] mx-4">
        {/* Card */}
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(36,60,81,0.08), 0 1px 4px rgba(36,60,81,0.04)",
          padding: "40px 36px 36px",
        }}>
          {/* Logo */}
          <div style={{ marginBottom: 28 }}>
            <img src={reimagineLogo} alt="Reimagine" style={{ height: 32 }} />
          </div>

          {/* Heading */}
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.2 }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28 }}>Enter your details to access your account</p>

          <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 18 }}>
            {/* Username */}
            <div className="flex flex-col" style={{ gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                style={{
                  padding: "11px 14px", fontSize: 14, borderRadius: 10,
                  border: "1px solid var(--border-input)", background: "var(--bg-surface)",
                  outline: "none", color: "var(--text-primary)", width: "100%",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(36,60,81,0.40)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(36,60,81,0.15)"; }}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col" style={{ gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    padding: "11px 40px 11px 14px", fontSize: 14, borderRadius: 10,
                    border: "1px solid var(--border-input)", background: "var(--bg-surface)",
                    outline: "none", color: "var(--text-primary)", width: "100%",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(36,60,81,0.40)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(36,60,81,0.15)"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <button type="button" style={{ fontSize: 14, color: "#6B7280", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#243c51"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#6B7280"; }}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" style={{
                fontSize: 13, color: "#b42318", background: "#FEF3F2",
                border: "1px solid #FECDCA", padding: "8px 12px", borderRadius: 8,
              }}>
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              className="w-full"
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
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(36,60,81,0.25)",
                transition: "background 0.2s",
                marginTop: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#1a2f3f"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#243c51"; }}
            >
              {isSubmitting ? "LOGGING IN..." : "LOGIN"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center" style={{ gap: 12, margin: "22px 0" }}>
            <div className="flex-1" style={{ height: 1, background: "rgba(36,60,81,0.08)" }} />
            <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>or</span>
            <div className="flex-1" style={{ height: 1, background: "rgba(36,60,81,0.08)" }} />
          </div>

          {/* SSO Buttons */}
          <div className="flex flex-col" style={{ gap: 10 }}>
            <button
              type="button"
              onClick={() => { void attemptLogin(); }}
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
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-nav-hover)"; e.currentTarget.style.borderColor = "var(--border-card)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; e.currentTarget.style.borderColor = "var(--border-input)"; }}
            >
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 000 24c0 3.77.9 7.34 2.44 10.51l8.09-5.92z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => { void attemptLogin(); }}
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
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-nav-hover)"; e.currentTarget.style.borderColor = "var(--border-card)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; e.currentTarget.style.borderColor = "var(--border-input)"; }}
            >
              <svg width="16" height="16" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
              Continue with Microsoft
            </button>
          </div>

          {/* Sign up link */}
          <p className="text-center" style={{ fontSize: 14, color: "#6B7280", marginTop: 22 }}>
            Don't have an account?{" "}
            <button type="button" style={{ fontWeight: 600, color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#E18739"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
