import { useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, UserPlus } from "lucide-react";
import reimagineLogo from "@/assets/reimagine-logo-full.png";
import type { AuthSession } from "@/application/auth/session";
import { getRuntimeConfig } from "@/config/env";
import { signInWithSupabase } from "@/infrastructure/supabase/auth";
import { createAccountRequest, requestedAccountRoleLabels, type RequestedAccountRole } from "@/lib/accountRequestStore";

interface LoginPageProps {
  onLogin: (session: AuthSession) => void;
}

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
};

type LoginMode = "login" | "request";

type AccountRequestForm = {
  fullName: string;
  email: string;
  requestedRole: RequestedAccountRole;
  company: string;
  brandName: string;
  dealName: string;
  message: string;
};

const emptyAccountRequestForm: AccountRequestForm = {
  fullName: "",
  email: "",
  requestedRole: "brand",
  company: "",
  brandName: "",
  dealName: "",
  message: "",
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
  const [mode, setMode] = useState<LoginMode>("login");
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requestForm, setRequestForm] = useState<AccountRequestForm>(emptyAccountRequestForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFeedback = () => {
    setError("");
    setMessage("");
  };

  const updateRequest = <K extends keyof AccountRequestForm>(key: K, value: AccountRequestForm[K]) => {
    setRequestForm((current) => ({ ...current, [key]: value }));
  };

  const handleLogin = async () => {
    if (!getRuntimeConfig().isSupabaseConfigured) {
      setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    const result = await signInWithSupabase(credential, password);
    if (result.ok) {
      onLogin(result.session);
      return;
    }
    setError(result.message);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setIsSubmitting(true);
    void handleLogin().finally(() => setIsSubmitting(false));
  };

  const handleRequestSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    if (!requestForm.fullName.trim() || !requestForm.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!getRuntimeConfig().isSupabaseConfigured) {
      setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setIsSubmitting(true);
    void createAccountRequest(requestForm)
      .then(() => {
        setRequestForm(emptyAccountRequestForm);
        setMessage("Request submitted. A Reimagine admin will review it before access is created.");
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to submit account request.");
      })
      .finally(() => setIsSubmitting(false));
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

          {mode === "login" ? (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.2 }}>
                Welcome back
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28 }}>Enter your details to access your account</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
                <AuthField
                  label="Username"
                  value={credential}
                  onChange={setCredential}
                  placeholder="Username"
                  autoComplete="username"
                />

                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
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
                  <div className="flex justify-end">
                    <button
                      type="button"
                      style={{ fontSize: 14, color: "#6B7280", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
                      onClick={() => setMessage("Password reset is managed by the Reimagine admin team.")}
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
                </div>

                <AuthFeedback error={error} message={message} />

                <PrimaryAuthButton submitting={isSubmitting} submittingLabel="LOGGING IN..." label="LOGIN" />
              </form>

              <button
                type="button"
                onClick={() => { resetFeedback(); setMode("request"); }}
                className="mt-5 flex w-full items-center justify-center gap-2"
                style={{
                  height: 42,
                  borderRadius: 10,
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-surface)",
                  color: "#374151",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <UserPlus className="h-4 w-4" />
                Request access
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { resetFeedback(); setMode("login"); }}
                className="mb-5 inline-flex items-center gap-2"
                style={{ background: "none", border: "none", padding: 0, color: "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </button>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.2 }}>
                Request access
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Submit your account details for admin review.</p>

              <form onSubmit={handleRequestSubmit} className="flex flex-col gap-[14px]">
                <AuthField label="Full name" value={requestForm.fullName} onChange={(value) => updateRequest("fullName", value)} placeholder="Your name" autoComplete="name" />
                <AuthField label="Email" value={requestForm.email} onChange={(value) => updateRequest("email", value)} placeholder="you@example.com" autoComplete="email" />
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Requested role</label>
                  <select
                    value={requestForm.requestedRole}
                    onChange={(event) => updateRequest("requestedRole", event.target.value as RequestedAccountRole)}
                    style={fieldStyle}
                  >
                    {(["brand", "deal", "broker"] as RequestedAccountRole[]).map((requestRole) => (
                      <option key={requestRole} value={requestRole}>{requestedAccountRoleLabels[requestRole]}</option>
                    ))}
                  </select>
                </div>
                <AuthField label="Company" value={requestForm.company} onChange={(value) => updateRequest("company", value)} placeholder="Company or team" autoComplete="organization" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AuthField label="Brand" value={requestForm.brandName} onChange={(value) => updateRequest("brandName", value)} placeholder="Brand name" />
                  <AuthField label="Deal" value={requestForm.dealName} onChange={(value) => updateRequest("dealName", value)} placeholder="Deal/site name" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Notes</label>
                  <textarea
                    value={requestForm.message}
                    onChange={(event) => updateRequest("message", event.target.value)}
                    placeholder="Add any context for the admin..."
                    rows={4}
                    style={{ ...fieldStyle, resize: "vertical", minHeight: 92 }}
                  />
                </div>

                <AuthFeedback error={error} message={message} />

                <PrimaryAuthButton submitting={isSubmitting} submittingLabel="SUBMITTING..." label="SUBMIT REQUEST" />
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthFeedback({ error, message }: { error: string; message: string }) {
  return (
    <>
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
          className="flex items-start gap-2"
          style={{
            fontSize: 13,
            color: "#065f46",
            background: "#ecfdf3",
            border: "1px solid #abefc6",
            padding: "8px 12px",
            borderRadius: 8,
          }}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}
    </>
  );
}

function PrimaryAuthButton({ submitting, submittingLabel, label }: { submitting: boolean; submittingLabel: string; label: string }) {
  return (
    <button
      type="submit"
      className="w-full"
      disabled={submitting}
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
        cursor: submitting ? "wait" : "pointer",
        boxShadow: "0 4px 14px rgba(36,60,81,0.25)",
        transition: "background 0.2s",
        marginTop: 2,
        opacity: submitting ? 0.75 : 1,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = "#1a2f3f";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "#243c51";
      }}
    >
      {submitting ? submittingLabel : label}
    </button>
  );
}
