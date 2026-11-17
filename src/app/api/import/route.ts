import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { parseExcelInventory } from "@/lib/excel";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    const permissions = ROLE_PERMISSIONS[session.role];

    if (!permissions.canImportAssets) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to import asset records." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const isDryRun = formData.get("dryRun") === "true";

    if (!file) {
      return NextResponse.json({ error: "No Excel file provided." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = parseExcelInventory(Buffer.from(arrayBuffer));

    if (parsed.totalRows === 0) {
      return NextResponse.json({ error: "Excel file contains no data rows." }, { status: 400 });
    }

    // Pre-fetch existing companies & employees for quick resolution
    const [companies, employees, existingAssets] = await Promise.all([
      prisma.company.findMany(),
      prisma.employee.findMany(),
      prisma.asset.findMany({
        where: { isArchived: false },
        select: { id: true, assetTag: true, serialNumber: true },
      }),
    ]);

    const companyMap = new Map(companies.map((c) => [c.code.toUpperCase(), c]));
    const employeeMap = new Map(employees.map((e) => [e.name.trim().toLowerCase(), e]));
    const existingTags = new Set(existingAssets.map((a) => a.assetTag.trim().toLowerCase()));
    const existingSerials = new Set(
      existingAssets
        .filter((a) => a.serialNumber)
        .map((a) => a.serialNumber!.trim().toLowerCase())
    );

    // Track tag occurrences within this batch
    const batchTagCounts = new Map<string, number>();
    for (const row of parsed.rows) {
      const tagLower = row.assetTag.toLowerCase();
      batchTagCounts.set(tagLower, (batchTagCounts.get(tagLower) || 0) + 1);
    }

    // Flag rows with duplicate tags (either within the batch or matching existing assets)
    const processedRows = parsed.rows.map((row) => {
      const tagLower = row.assetTag.toLowerCase();
      const isDuplicate = existingTags.has(tagLower) || (batchTagCounts.get(tagLower) || 0) > 1;
      return {
        ...row,
        isDuplicateTag: isDuplicate,
      };
    });

    if (isDryRun) {
      return NextResponse.json({
        preview: processedRows.slice(0, 50),
        totalRows: parsed.totalRows,
        validRows: parsed.validRows,
        invalidRows: parsed.invalidRows,
        duplicateTagsCount: processedRows.filter((r) => r.isDuplicateTag).length,
      });
    }

    // Commit to PostgreSQL
    let importedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    await prisma.$transaction(
      async (tx) => {
        for (const row of processedRows) {
          if (!row.isValid) {
            errors.push({ row: row.rowNumber, error: row.errors.join(", ") });
            continue;
          }

          // Resolve company or fallback to GMD
          let company = companyMap.get(row.companyCode.toUpperCase());
          if (!company) {
            company = await tx.company.upsert({
              where: { code: row.companyCode.toUpperCase() },
              create: {
                code: row.companyCode.toUpperCase(),
                name: row.companyCode.toUpperCase(),
              },
              update: {},
            });
            companyMap.set(company.code.toUpperCase(), company);
          }

          // Resolve employee if specified
          let employeeId: string | null = null;
          if (row.employeeName && row.employeeName.trim() !== "") {
            const empKey = row.employeeName.trim().toLowerCase();
            let employee = employeeMap.get(empKey);
            if (!employee) {
              const generatedEmpId = `EMP-${Math.floor(10000 + Math.random() * 90000)}`;
              employee = await tx.employee.create({
                data: {
                  employeeId: generatedEmpId,
                  name: row.employeeName.trim(),
                  companyId: company.id,
                  department: "Operations",
                },
              });
              employeeMap.set(empKey, employee);
            }
            employeeId = employee.id;
          }

          const qrToken = `QR-${company.code}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

          const createdAsset = await tx.asset.create({
            data: {
              assetTag: row.assetTag,
              isDuplicateTag: row.isDuplicateTag,
              assetName: row.assetName,
              companyId: company.id,
              category: row.category,
              model: row.model,
              cpu: row.cpu,
              ram: row.ram,
              serialNumber: row.serialNumber || null,
              macAddress: row.macAddress || null,
              status: row.status,
              physicalCondition: row.physicalCondition,
              assignedEmployeeId: employeeId,
              location: row.location,
              purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : null,
              purchaseCost: row.purchaseCost || null,
              usefulLifeMonths: row.usefulLifeMonths || null,
              netBookValue: row.purchaseCost || null,
              laptopCode: row.laptopCode || null,
              laptopAccount: row.laptopAccount || null,
              username: row.username || null,
              notes: row.notes || null,
              qrCodeToken: qrToken,
            },
          });

          // Immutable initial history log
          await tx.assetHistory.create({
            data: {
              assetId: createdAsset.id,
              action: "IMPORTED",
              performedBy: session.name,
              notes: `Batch imported from Excel by ${session.name}.${
                row.isDuplicateTag ? " Flagged for duplicate Asset Tag audit." : ""
              }`,
            },
          });

          // Immutable assignment log if employee was linked
          if (employeeId) {
            await tx.assetAssignment.create({
              data: {
                assetId: createdAsset.id,
                employeeId,
                actionType: "ASSIGN",
                conditionAtAction: row.physicalCondition,
                performedBy: session.name,
                notes: "Initial deployment recorded via Excel batch import",
              },
            });
          }

          importedCount++;
        }
      },
      { timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      importedCount,
      errorsCount: errors.length,
      errors,
      message: `Successfully imported ${importedCount} assets into PostgreSQL.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Batch import failed", details: error.message },
      { status: 500 }
    );
  }
}

