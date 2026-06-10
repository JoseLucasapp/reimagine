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
  "Beauty", "Pet Related", "Fitness", "Health & Wellness", "F&B",
  "Entertainment", "Automotive", "Service", "Medical", "Education", "Soft Goods",
];

export const bizDevStatuses: BizDevStatus[] = [
  "0 - Active Client", "1 - In-Active Client", "2 - Prospect", "3 - Dead",
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

export const bizDevRecords: BizDevRecord[] = [
  {
    id: "bd1", status: "0 - Active Client", owner: "Sarah Mitchell", dateAdded: "2025-03-15",
    companyName: "QuickBite", website: "https://quickbite.com", category: "F&B", subCategory: "QSR",
    isFranchise: true, reachOutMethod: "Email", mainContact: "Tom Reynolds", cell: "(214) 555-0101",
    mainContactPosition: "VP Development", mainContactEmail: "tom@quickbite.com",
    reachOut1: "2025-01-10", reachOut2: "2025-01-25", reachOut3: "2025-02-05", reachOut4: "",
  },
  {
    id: "bd2", status: "0 - Active Client", owner: "Sarah Mitchell", dateAdded: "2025-04-02",
    companyName: "FreshFit", website: "https://freshfit.com", category: "Fitness", subCategory: "Boutique Gym",
    isFranchise: true, reachOutMethod: "LinkedIn", mainContact: "Maria Santos", cell: "(303) 555-0202",
    mainContactPosition: "Director of RE", mainContactEmail: "maria@freshfit.com",
    reachOut1: "2025-02-15", reachOut2: "2025-03-01", reachOut3: "", reachOut4: "",
  },
  {
    id: "bd3", status: "0 - Active Client", owner: "Michael Chen", dateAdded: "2025-05-18",
    companyName: "UrbanGrind", website: "https://urbangrind.co", category: "F&B", subCategory: "Coffee",
    isFranchise: true, reachOutMethod: "Phone", mainContact: "Derek Liu", cell: "(312) 555-0303",
    mainContactPosition: "CEO", mainContactEmail: "derek@urbangrind.co",
    reachOut1: "2025-04-01", reachOut2: "2025-04-20", reachOut3: "2025-05-10", reachOut4: "2025-05-15",
  },
  {
    id: "bd4", status: "2 - Prospect", owner: "Michael Chen", dateAdded: "2025-11-20",
    companyName: "GlowUp Studio", website: "https://glowupstudio.com", category: "Beauty", subCategory: "Salon",
    isFranchise: true, reachOutMethod: "Email", mainContact: "Rachel Kim", cell: "(469) 555-0404",
    mainContactPosition: "Franchise Director", mainContactEmail: "rachel@glowupstudio.com",
    reachOut1: "2025-11-01", reachOut2: "2025-11-15", reachOut3: "", reachOut4: "",
  },
  {
    id: "bd5", status: "2 - Prospect", owner: "Sarah Mitchell", dateAdded: "2025-12-05",
    companyName: "PawPalace", website: "https://pawpalace.com", category: "Pet Related", subCategory: "Pet Grooming",
    isFranchise: true, reachOutMethod: "LinkedIn", mainContact: "Jake Morrison", cell: "(615) 555-0505",
    mainContactPosition: "Head of Expansion", mainContactEmail: "jake@pawpalace.com",
    reachOut1: "2025-12-01", reachOut2: "", reachOut3: "", reachOut4: "",
  },
  {
    id: "bd6", status: "1 - In-Active Client", owner: "Sarah Mitchell", dateAdded: "2024-08-10",
    companyName: "SpinCycle", website: "https://spincycle.fit", category: "Fitness", subCategory: "Cycling Studio",
    isFranchise: false, reachOutMethod: "Phone", mainContact: "Amy Tran", cell: "(720) 555-0606",
    mainContactPosition: "COO", mainContactEmail: "amy@spincycle.fit",
    reachOut1: "2024-06-15", reachOut2: "2024-07-01", reachOut3: "2024-07-20", reachOut4: "2024-08-05",
  },
  {
    id: "bd7", status: "3 - Dead", owner: "Michael Chen", dateAdded: "2024-05-12",
    companyName: "AutoShine Express", website: "https://autoshine.com", category: "Automotive", subCategory: "Car Wash",
    isFranchise: true, reachOutMethod: "Email", mainContact: "Bill Carter", cell: "(480) 555-0707",
    mainContactPosition: "President", mainContactEmail: "bill@autoshine.com",
    reachOut1: "2024-04-01", reachOut2: "2024-04-15", reachOut3: "2024-05-01", reachOut4: "2024-05-10",
  },
  {
    id: "bd8", status: "2 - Prospect", owner: "Michael Chen", dateAdded: "2026-01-10",
    companyName: "BrightSmile Dental", website: "https://brightsmile.com", category: "Medical", subCategory: "Dental",
    isFranchise: true, reachOutMethod: "Email", mainContact: "Dr. Susan Park", cell: "(512) 555-0808",
    mainContactPosition: "Managing Partner", mainContactEmail: "susan@brightsmile.com",
    reachOut1: "2026-01-05", reachOut2: "", reachOut3: "", reachOut4: "",
  },
  {
    id: "bd9", status: "2 - Prospect", owner: "Sarah Mitchell", dateAdded: "2026-02-01",
    companyName: "LittleGenius Academy", website: "https://littlegenius.edu", category: "Education", subCategory: "Childcare",
    isFranchise: true, reachOutMethod: "Phone", mainContact: "Karen White", cell: "(214) 555-0909",
    mainContactPosition: "VP Franchising", mainContactEmail: "karen@littlegenius.edu",
    reachOut1: "2026-01-28", reachOut2: "2026-02-10", reachOut3: "", reachOut4: "",
  },
  {
    id: "bd10", status: "0 - Active Client", owner: "Michael Chen", dateAdded: "2025-07-22",
    companyName: "CleanPress Laundry", website: "https://cleanpress.com", category: "Service", subCategory: "Laundromat",
    isFranchise: true, reachOutMethod: "LinkedIn", mainContact: "Steve Romero", cell: "(602) 555-1010",
    mainContactPosition: "Director of Development", mainContactEmail: "steve@cleanpress.com",
    reachOut1: "2025-06-15", reachOut2: "2025-07-01", reachOut3: "2025-07-15", reachOut4: "2025-07-20",
  },
];

export const bizDevOwners = [...new Set(bizDevRecords.map((r) => r.owner))];

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
