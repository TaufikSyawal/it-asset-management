import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const query = searchParams.get("query");

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { employeeId: { contains: query, mode: "insensitive" } },
        { department: { contains: query, mode: "insensitive" } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        company: { select: { code: true, name: true } },
        _count: {
          select: {
            assignedAssets: { where: { isArchived: false } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ employees });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Database error retrieving employees",
        details: error.message,
      },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, employeeId, companyId, department, email } = body;

    if (!name || !employeeId || !companyId) {
      return NextResponse.json(
        { error: "Name, Employee ID, and Company are required." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        employeeId,
        companyId,
        department,
        email,
      },
      include: {
        company: true,
      },
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create employee", details: error.message },
      { status: 500 }
    );
  }
}

