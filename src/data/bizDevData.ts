export type BizDevStatus = "0 - Active Client" | "1 - In-Active Client" | "2 - Prospect" | "3 - Dead";

export type BizDevCategory =
  | "Beauty"
  | "Pet Related"
  | "Fitness"
  | "Health & Wellness"
  | "F&B"
  | "Entertainment"
  | "Automotive"
  | "Service"
  | "Medical"
  | "Education"
  | "Soft Goods";

export const bizDevCategories: BizDevCategory[] = [
  "Beauty",
  "Pet Related",
  "Fitness",
  "Health & Wellness",
  "F&B",
  "Entertainment",
  "Automotive",
  "Service",
  "Medical",
  "Education",
  "Soft Goods",
];

export const bizDevStatuses: BizDevStatus[] = [
  "0 - Active Client",
  "1 - In-Active Client",
  "2 - Prospect",
  "3 - Dead",
];

export interface BizDevRecord {
  id: string;
  status: BizDevStatus;
  owner: string;
  dateAdded: string;
  companyName: string;
  website: string;
  category: BizDevCategory;
  subCategory: string;
  isFranchise: boolean;
  reachOutMethod: string;
  mainContact: string;
  cell: string;
  mainContactPosition: string;
  mainContactEmail: string;
  reachOut1: string;
  reachOut2: string;
  reachOut3: string;
  reachOut4: string;
}

export const bizDevRecords: BizDevRecord[] = [];
export const bizDevOwners: string[] = [];

export function replaceBizDevRuntimeData(records: BizDevRecord[]): void {
  bizDevRecords.splice(0, bizDevRecords.length, ...records);
  bizDevOwners.splice(0, bizDevOwners.length, ...new Set(records.map((r) => r.owner).filter(Boolean)));
}

export const statusBadgeClasses: Record<BizDevStatus, string> = {
  "0 - Active Client": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "1 - In-Active Client": "bg-muted text-muted-foreground",
  "2 - Prospect": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "3 - Dead": "bg-red-500/15 text-red-600 dark:text-red-400",
};

export const statusDotClasses: Record<BizDevStatus, string> = {
  "0 - Active Client": "bg-emerald-500",
  "1 - In-Active Client": "bg-muted-foreground",
  "2 - Prospect": "bg-blue-500",
  "3 - Dead": "bg-red-500",
};

export const statusLabels: Record<BizDevStatus, string> = {
  "0 - Active Client": "Active Client",
  "1 - In-Active Client": "In-Active",
  "2 - Prospect": "Prospect",
  "3 - Dead": "Dead",
};
