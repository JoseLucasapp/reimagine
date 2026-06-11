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

export const spaceRequirements: SpaceRequirement[] = [];

export const spaceTypes = ["Retail", "Retail+Flex", "Office", "Land", "Industrial"];

export function replaceSpaceRequirementsRuntimeData(records: SpaceRequirement[]): void {
  spaceRequirements.splice(0, spaceRequirements.length, ...records);
}
