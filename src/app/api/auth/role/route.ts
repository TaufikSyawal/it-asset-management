import { NextResponse } from "next/server";
import { UserRole } from "@/types";
import { DEMO_USERS } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { role } = await request.json();
    if (!role || !DEMO_USERS[role as UserRole]) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      user: DEMO_USERS[role as UserRole],
    });

    // Set cookie for session persistence
    response.cookies.set("itams_active_role", role, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/itams_active_role=([A-Z_]+)/);
  const role = (match ? match[1] : "SUPER_ADMIN") as UserRole;
  const user = DEMO_USERS[role] || DEMO_USERS.SUPER_ADMIN;

  return NextResponse.json({ user });
}

