import { useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { useUserRole, canSeeRoute, ROLE_LABELS } from "@/hooks/useUserRole";

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Renders an access-denied placeholder when the active role cannot view the
 * current route. Wraps <Routes> so it covers every page in one place.
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const role = useUserRole();
  const { pathname } = useLocation();

  if (canSeeRoute(role, pathname)) return <>{children}</>;

  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: 64, gap: 16, minHeight: "60vh" }}
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
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8, maxWidth: 480 }}>
          You&apos;re currently viewing as <strong>{ROLE_LABELS[role]}</strong>. Switch back to Admin in
          Settings to access this page.
        </p>
      </div>
    </div>
  );
}
