import { useUserRole } from "@/hooks/useUserRole";
import Dashboard from "./Dashboard";
import FranchisorDashboard from "./FranchisorDashboard";
import FranchiseeDashboard from "./FranchiseeDashboard";

export default function PlatformHome() {
  const role = useUserRole();

  if (role === "brand") return <FranchisorDashboard />;
  if (role === "deal") return <FranchiseeDashboard />;
  return <Dashboard />;
}
