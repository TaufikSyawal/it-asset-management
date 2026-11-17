import { UserRole, UserSession } from "@/types";
import { cookies } from "next/headers";

export const DEMO_USERS: Record<UserRole, UserSession> = {
  SUPER_ADMIN: {
    id: "usr_super_admin",
    name: "System Super Admin",
    email: "superadmin@company.internal",
    role: "SUPER_ADMIN",
    allCompanies: true,
  },
  MANAGEMENT: {
    id: "usr_management",
    name: "Executive Director (Management)",
    email: "management@company.internal",
    role: "MANAGEMENT",
    allCompanies: true,
  },
  IT_ADMIN: {
    id: "usr_it_admin",
    name: "Alex Pratama (IT Admin)",
    email: "itadmin@company.internal",
    role: "IT_ADMIN",
    allCompanies: true,
  },
  FINANCE: {
    id: "usr_finance",
    name: "Dewi Lestari (Finance Lead)",
    email: "finance@company.internal",
    role: "FINANCE",
  },
  AUDITOR: {
    id: "usr_auditor",
    name: "Budi Santoso (Internal Auditor)",
    email: "auditor@company.internal",
    role: "AUDITOR",
  },
  EMPLOYEE: {
    id: "usr_employee",
    name: "Sarah Wijaya (Employee)",
    email: "sarah.wijaya@company.internal",
    role: "EMPLOYEE",
    employeeId: "emp_sarah", // Maps to seeded employee
  },
};

/**
 * Resolve current active user session.
 * Reads from the active session cookie or query header, defaulting to IT_ADMIN / SUPER_ADMIN.
 */
export async function getSession(): Promise<UserSession> {
  try {
    const cookieStore = cookies();
    const activeRole = cookieStore.get("itams_active_role")?.value as UserRole | undefined;

    if (activeRole && DEMO_USERS[activeRole]) {
      return DEMO_USERS[activeRole];
    }
  } catch {
    // If called outside request context
  }

  // Default to SUPER_ADMIN for initial full capability testing
  return DEMO_USERS.SUPER_ADMIN;
}

