import { useLocation, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useIsRolePreview, useScopedUser, useUserRole, canSeeRoute, ROLE_LABELS, roleStore } from "@/hooks/useUserRole";
import { roleToHomeRoute } from "@/domain/permissions";

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Renders an access-denied placeholder when the active profile role cannot view
 * the current route. Admin preview can exit back to the real admin role.
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const role = useUserRole();
  const user = useScopedUser();
  const isPreviewing = useIsRolePreview();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (canSeeRoute(user ?? role, pathname)) return <>{children}</>;

  const switchToAdmin = () => {
    roleStore.resetToAdmin();
    navigate(pathname, { replace: true });
  };

  const goToSettings = () => {
    navigate("/settings", { replace: true });
  };

  const goHome = () => {
    navigate(roleToHomeRoute(role), { replace: true });
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(roleToHomeRoute(role), { replace: true });
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
          You&apos;re currently signed in as <strong>{ROLE_LABELS[role]}</strong>. This section is outside
          your assigned platform scope.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center" style={{ gap: 10, marginTop: 4 }}>
        {isPreviewing ? (
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
            Exit preview
          </button>
        ) : (
          <button
            type="button"
            onClick={goHome}
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
            Go to my dashboard
          </button>
        )}
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
