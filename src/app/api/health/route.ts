import { NextResponse } from "next/server";
import { prisma, checkDatabaseConnection } from "@/lib/prisma";

export async function GET() {
  const dbStatus = await checkDatabaseConnection();

  let counts = {
    companies: 0,
    employees: 0,
    assets: 0,
  };

  let tablesReady = false;

  if (dbStatus.connected) {
    try {
      const [compCount, empCount, assetCount] = await Promise.all([
        prisma.company.count(),
        prisma.employee.count(),
        prisma.asset.count(),
      ]);
      counts = {
        companies: compCount,
        employees: empCount,
        assets: assetCount,
      };
      tablesReady = true;
    } catch (e: any) {
      tablesReady = false;
      dbStatus.error = `Database connected, but schema tables are missing. Please run 'npx prisma db push' or migrations. Details: ${e.message}`;
    }
  }

  return NextResponse.json({
    ...dbStatus,
    tablesReady,
    counts,
  });
}

