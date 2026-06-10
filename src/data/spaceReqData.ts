export type SecondFloor = "Allowed" | "Maybe" | "Not Allowed";
export type GasReq = "Yes" | "No" | "Preferred";

export interface SpaceRequirement {
  id: string;
  brandName: string;
  brandId: string;
  spaceType: string;
  minSF: number;
  maxSF: number;
  idealSF: number;
  minStorefrontWidth: string;
  power: string;
  hvac: string;
  gas: GasReq;
  waterLineSize: string;
  sewerLineSize: string;
  slab: string;
  greaseTrap: "Yes" | "No";
  secondFloor: SecondFloor;
  parking: string;
}

export const spaceRequirements: SpaceRequirement[] = [
  {
    id: "sr1", brandName: "QuickBite", brandId: "b1", spaceType: "Retail",
    minSF: 1200, maxSF: 2000, idealSF: 1600, minStorefrontWidth: "25'",
    power: "200A / 1-Phase", hvac: "1 ton per 200 SF", gas: "Yes",
    waterLineSize: "1\"", sewerLineSize: "4\"", slab: "4\" reinforced",
    greaseTrap: "Yes", secondFloor: "Not Allowed", parking: "15 spaces min, drive-thru preferred",
  },
  {
    id: "sr2", brandName: "FreshFit", brandId: "b2", spaceType: "Retail+Flex",
    minSF: 2500, maxSF: 5000, idealSF: 3500, minStorefrontWidth: "30'",
    power: "400A / 3-Phase", hvac: "1 ton per 250 SF", gas: "Preferred",
    waterLineSize: "1.5\"", sewerLineSize: "4\"", slab: "6\" reinforced",
    greaseTrap: "No", secondFloor: "Maybe", parking: "20 spaces, street parking OK",
  },
  {
    id: "sr3", brandName: "UrbanGrind", brandId: "b3", spaceType: "Retail",
    minSF: 800, maxSF: 1500, idealSF: 1100, minStorefrontWidth: "20'",
    power: "200A / 1-Phase", hvac: "1 ton per 200 SF", gas: "Preferred",
    waterLineSize: "3/4\"", sewerLineSize: "3\"", slab: "4\" standard",
    greaseTrap: "Yes", secondFloor: "Allowed", parking: "10 spaces, walkable area preferred",
  },
  {
    id: "sr4", brandName: "GlowUp Studio", brandId: "b4", spaceType: "Retail",
    minSF: 1000, maxSF: 1800, idealSF: 1400, minStorefrontWidth: "22'",
    power: "200A / 1-Phase", hvac: "1 ton per 300 SF", gas: "No",
    waterLineSize: "1\"", sewerLineSize: "3\"", slab: "4\" standard",
    greaseTrap: "No", secondFloor: "Maybe", parking: "12 spaces",
  },
  {
    id: "sr5", brandName: "CleanPress Laundry", brandId: "b5", spaceType: "Retail+Flex",
    minSF: 2000, maxSF: 4000, idealSF: 3000, minStorefrontWidth: "35'",
    power: "600A / 3-Phase", hvac: "1 ton per 350 SF", gas: "Yes",
    waterLineSize: "2\"", sewerLineSize: "6\"", slab: "6\" reinforced w/ drainage",
    greaseTrap: "No", secondFloor: "Not Allowed", parking: "25 spaces, loading area required",
  },
];

export const spaceTypes = ["Retail", "Retail+Flex", "Office", "Land", "Industrial"];
