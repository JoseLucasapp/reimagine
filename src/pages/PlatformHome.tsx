import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";

export default function PlatformHome() {
  const role = useUserRole();

  if (role === "brand") return <Navigate to="/brand" replace />;
  if (role === "broker") return <Navigate to="/deals" replace />;
  if (role === "deal") return <Navigate to="/deal" replace />;
  return <Dashboard />;
}
