import { useLocation, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useUserRole, canSeeRoute, ROLE_LABELS, roleStore } from "@/hooks/useUserRole";

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Renders an access-denied placeholder when the active preview role cannot view
 * the current route. The recovery CTA intentionally switches back to Admin so
 * users cannot get stuck on a restricted deep link.
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const role = useUserRole();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (canSeeRoute(role, pathname)) return <>{children}</>;

  const switchToAdmin = () => {
    roleStore.resetToAdmin();
    navigate(pathname, { replace: true });
  };

  const goToSettings = () => {
    navigate("/settings", { replace: true });
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    roleStore.resetToAdmin();
    navigate("/", { replace: true });
  };

  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: 64, gap: 16, minHeight: "100vh", background: "var(--bg-main)" }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lock style={{ width: 24, height: 24, color: "var(--text-muted)" }} />
      </div>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          You don&apos;t have access to this section
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8, maxWidth: 520 }}>
          You&apos;re currently viewing as <strong>{ROLE_LABELS[role]}</strong>. Switch back to Admin to access
          this page, or open Settings to choose another preview role.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center" style={{ gap: 10, marginTop: 4 }}>
        <button
          type="button"
          onClick={switchToAdmin}
          style={{
            height: 40,
            padding: "0 16px",
            borderRadius: 10,
            border: "none",
            background: "#243c51",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Switch to Admin and continue
        </button>
        <button
          type="button"
          onClick={goToSettings}
          style={{
            height: 40,
            padding: "0 16px",
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Open Settings
        </button>
        <button
          type="button"
          onClick={goBack}
          style={{
            height: 40,
            padding: "0 16px",
            borderRadius: 10,
            border: "1px solid transparent",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Go back
        </button>
      </div>
    </div>
  );
}
