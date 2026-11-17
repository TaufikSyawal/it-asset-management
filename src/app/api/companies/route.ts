import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    let companies = await prisma.company.findMany({
      include: {
        _count: {
          select: {
            assets: { where: { isArchived: false } },
            employees: true,
          },
        },
      },
      orderBy: { code: "asc" },
    });

    // If companies are not yet created in the DB, auto-initialize GMD, GMC, TEL
    if (companies.length === 0) {
      const defaultCompanies = [
        { code: "GMD", name: "GMD", description: "GMD Entity" },
        { code: "GMC", name: "GMC", description: "GMC Entity" },
        { code: "TEL", name: "TEL", description: "TEL Entity" },
      ];

      for (const comp of defaultCompanies) {
        await prisma.company.upsert({
          where: { code: comp.code },
          create: comp,
          update: {},
        });
      }

      companies = await prisma.company.findMany({
        include: {
          _count: {
            select: {
              assets: { where: { isArchived: false } },
              employees: true,
            },
          },
        },
        orderBy: { code: "asc" },
      });
    }

    return NextResponse.json({ companies });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Database error retrieving companies",
        details: error.message,
        hint: "Ensure PostgreSQL is running and migrations are applied.",
      },
      { status: 503 }
    );
  }
}

