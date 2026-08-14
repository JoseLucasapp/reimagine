import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";

export default function PlatformHome() {
  const role = useUserRole();

  if (role === "brand") return <Navigate to="/brand" replace />;
  if (role === "deal") return <Navigate to="/deal" replace />;
  if (role === "mapiq") return <Navigate to="/map" replace />;
  return <Dashboard />;
}
