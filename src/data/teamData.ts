import type { UserRole } from "@/domain/entities";

export type TeamMemberRole = "Admin" | "Franchisor" | "Franchisee";

export interface TeamMember {
  id: string;
  name: string;
  role: TeamMemberRole;
  initials: string;
}

export const teamMembers: TeamMember[] = [];

const roleLabels: Record<UserRole, TeamMemberRole> = {
  admin: "Admin",
  franchisor: "Franchisor",
  franchisee: "Franchisee",
};

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function replaceTeamRuntimeData(
  profiles: { id: string; fullName: string | null; username: string | null; role: UserRole }[],
): void {
  const next = profiles
    .map((profile) => {
      const name = profile.fullName || profile.username || "Unnamed User";
      return {
        id: profile.id,
        name,
        role: roleLabels[profile.role],
        initials: initialsForName(name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  teamMembers.splice(0, teamMembers.length, ...next);
}
