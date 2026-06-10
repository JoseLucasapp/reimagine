export type UserRole = "admin" | "franchisor" | "franchisee";

export type DealStage =
  | "Kick Off"
  | "Market Study"
  | "Site Tours"
  | "First LOI(s) Submitted"
  | "LOI Negotiations"
  | "Lease Negotiations"
  | "Signed"
  | "On Hold";

export type TakeActionAudience = "internal" | "franchisor" | "franchisee";
export type TakeActionStatus = "open" | "in_progress" | "resolved" | "archived";

export type Brand = {
  id: string;
  name: string;
  category: string;
  logoColor: string;
  corporateLink: string;
  createdAt: string;
  updatedAt: string;
};

export type Deal = {
  id: string;
  brandId: string;
  franchisee: string;
  broker: string;
  associate: string | null;
  city: string;
  state: string;
  stage: DealStage;
  storeCount: number;
  storesBought: number;
  estimatedCommission: number;
  introCallDate: string | null;
  leaseSignedDate: string | null;
  isOneOff: boolean;
  corporate: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Prospect = {
  id: string;
  companyName: string;
  category: string;
  status: "active_client" | "inactive_client" | "prospect" | "dead";
  owner: string | null;
  website: string | null;
  mainContact: string | null;
  mainContactEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TourBook = {
  id: string;
  dealId: string;
  title: string;
  status: "draft" | "generated" | "sent";
  generatedUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TakeActionItem = {
  id: string;
  dealId: string;
  audience: TakeActionAudience;
  status: TakeActionStatus;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
