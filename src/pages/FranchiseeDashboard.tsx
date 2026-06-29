import { useEffect, useMemo, useState } from "react";
import DealDetail from "./DealDetail";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { dealRecords } from "@/data/dealsData";
import { getVisibleDealsForUser, useCurrentProfile, useRealUserRole, useScopedUser, useUserRole } from "@/hooks/useUserRole";

function EmptyDealState({ title, body }: { title: string; body: string }) {
  return (
    <div className="animate-fade-in p-8">
      <div className="glass-card-static mx-auto max-w-xl p-6 text-center">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{title}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{body}</p>
      </div>
    </div>
  );
}

export default function FranchiseeDashboard() {
  const runtimeDataVersion = useRuntimeDataVersion();
  const role = useUserRole();
  const realRole = useRealUserRole();
  const user = useScopedUser();
  const profile = useCurrentProfile();
  const visibleDeals = useMemo(() => {
    void runtimeDataVersion;
    return getVisibleDealsForUser(user ?? role, dealRecords).filter((deal) => !deal.isOneOff);
  }, [role, runtimeDataVersion, user]);
  const [previewDealId, setPreviewDealId] = useState("");

  useEffect(() => {
    if (realRole !== "admin") return;
    if (!previewDealId || !visibleDeals.some((deal) => deal.id === previewDealId)) {
      setPreviewDealId(visibleDeals[0]?.id ?? "");
    }
  }, [previewDealId, realRole, visibleDeals]);

  if (realRole !== "admin") {
    if (role === "deal" && !profile?.dealId) {
      return (
        <EmptyDealState
          title="Deal scope is not assigned"
          body="This profile is marked as Deal Level but does not have a `deal_id` in Supabase profiles."
        />
      );
    }

    const assignedDeal = visibleDeals.find((deal) => deal.id === profile?.dealId);
    if (!assignedDeal) {
      return (
        <EmptyDealState
          title="Assigned deal is unavailable"
          body="The assigned deal may not exist anymore or Supabase RLS did not grant access to it."
        />
      );
    }

    return <DealDetail dealIdOverride={assignedDeal.id} />;
  }

  if (!previewDealId) {
    return <EmptyDealState title="No deals available" body="No imported deals are available for admin preview." />;
  }

  return (
    <div className="animate-fade-in">
      <div className="px-4 pt-4 md:px-7">
        <div className="glass-card-static flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Admin Preview</p>
            <h1 className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>Deal User Experience</h1>
          </div>
          <Select value={previewDealId} onValueChange={setPreviewDealId}>
            <SelectTrigger className="w-full md:w-80 glass-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              {visibleDeals.map((deal) => (
                <SelectItem key={deal.id} value={deal.id}>
                  {deal.name || deal.franchisee} - {deal.city}, {deal.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DealDetail dealIdOverride={previewDealId} />
    </div>
  );
}
