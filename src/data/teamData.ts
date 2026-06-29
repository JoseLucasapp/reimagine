import type { UserRole } from "@/domain/entities";

export type TeamMemberRole = "Admin" | "Brand Level" | "Deal Level";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamMemberRole;
  initials: string;
}

export const teamMembers: TeamMember[] = [];

const roleLabels: Record<UserRole, TeamMemberRole> = {
  admin: "Admin",
  brand: "Brand Level",
  deal: "Deal Level",
};

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function replaceTeamRuntimeData(
  profiles: { id: string; email: string | null; fullName: string | null; username: string | null; role: UserRole; brandId?: string | null; dealId?: string | null }[],
): void {
  const next = profiles
    .filter((profile) => {
      const email = profile.email?.trim().toLowerCase();
      return Boolean(email && (profile.role === "admin" || email.endsWith("@reimagine.com")));
    })
    .map((profile) => {
      const email = profile.email?.trim().toLowerCase() ?? "";
      const name = profile.fullName || profile.username || email || "Unnamed User";
      return {
        id: profile.id,
        name,
        email,
        role: roleLabels[profile.role],
        initials: initialsForName(name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  teamMembers.splice(0, teamMembers.length, ...next);
}
