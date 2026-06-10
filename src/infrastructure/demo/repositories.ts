import { dealBrands, dealRecords } from "@/data/dealsData";
import { bizDevRecords } from "@/data/bizDevData";
import type { Brand, Deal, Prospect, TakeActionItem, TourBook } from "@/domain/entities";
import type { ReimagineRepositories } from "@/infrastructure/supabase/repositories";

function nowIso(): string {
  return new Date().toISOString();
}

function toBrand(): Brand[] {
  return dealBrands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    category: brand.category,
    logoColor: brand.logoColor,
    corporateLink: brand.corporateLink,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
}

function toDeals(): Deal[] {
  return dealRecords.map((deal) => ({
    id: deal.id,
    brandId: deal.brandId,
    franchisee: deal.franchisee,
    broker: deal.broker,
    associate: deal.associate || null,
    city: deal.city,
    state: deal.state,
    stage: deal.status,
    storeCount: deal.storeCount,
    storesBought: deal.storesBought,
    estimatedCommission: deal.estimatedCommission,
    introCallDate: deal.dateIntroCall,
    leaseSignedDate: deal.dateLeaseSigned,
    isOneOff: deal.isOneOff,
    corporate: deal.corporate,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
}

function toProspects(): Prospect[] {
  return bizDevRecords.map((record) => ({
    id: record.id,
    companyName: record.companyName,
    category: record.category,
    status: record.status === "0 - Active Client" ? "active_client" : record.status === "1 - In-Active Client" ? "inactive_client" : record.status === "3 - Dead" ? "dead" : "prospect",
    owner: record.owner || null,
    website: record.website || null,
    mainContact: record.mainContact || null,
    mainContactEmail: record.mainContactEmail || null,
    createdAt: record.dateAdded,
    updatedAt: record.dateAdded,
  }));
}

const demoTourBooks: TourBook[] = [];
const demoTakeActions: TakeActionItem[] = [];

export function createDemoRepositories(): ReimagineRepositories {
  return {
    brands: { list: async () => toBrand() },
    deals: { list: async () => toDeals() },
    prospects: { list: async () => toProspects() },
    tourBooks: { list: async () => demoTourBooks },
    takeActions: {
      list: async () => demoTakeActions,
      create: async (input) => {
        const timestamp = nowIso();
        const item: TakeActionItem = {
          ...input,
          id: `ta_${Date.now()}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        demoTakeActions.unshift(item);
        return item;
      },
    },
  };
}
