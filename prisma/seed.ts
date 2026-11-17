import { PrismaClient, AssetCategory, AssetStatus, PhysicalCondition, DepreciationMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding IT Asset Management System database...");

  // 1. Seed Companies
  const gmd = await prisma.company.upsert({
    where: { code: "GMD" },
    update: {},
    create: { code: "GMD", name: "GMD", description: "GMD Operations & Corporate" },
  });

  const gmc = await prisma.company.upsert({
    where: { code: "GMC" },
    update: {},
    create: { code: "GMC", name: "GMC", description: "GMC Technical & Logistics" },
  });

  const tel = await prisma.company.upsert({
    where: { code: "TEL" },
    update: {},
    create: { code: "TEL", name: "TEL", description: "TEL Infrastructure" },
  });

  console.log("✅ Companies verified: GMD, GMC, TEL");

  // 2. Seed Employees
  const emp1 = await prisma.employee.upsert({
    where: { employeeId: "EMP-00101" },
    update: {},
    create: {
      employeeId: "EMP-00101",
      name: "Bambang Sudirman",
      email: "bambang.s@gmd.internal",
      department: "IT Infrastructure",
      companyId: gmd.id,
      status: "ACTIVE",
    },
  });

  const emp2 = await prisma.employee.upsert({
    where: { employeeId: "EMP-00102" },
    update: {},
    create: {
      employeeId: "EMP-00102",
      name: "Siti Rahmawati",
      email: "siti.r@gmc.internal",
      department: "Finance & Accounts",
      companyId: gmc.id,
      status: "ACTIVE",
    },
  });

  const emp3 = await prisma.employee.upsert({
    where: { employeeId: "EMP-00103" },
    update: {},
    create: {
      employeeId: "EMP-00103",
      name: "Rizky Ramadhan",
      email: "rizky.r@tel.internal",
      department: "Network Engineering",
      companyId: tel.id,
      status: "ACTIVE",
    },
  });

  const empSarah = await prisma.employee.upsert({
    where: { employeeId: "EMP-00104" },
    update: {},
    create: {
      employeeId: "EMP-00104",
      name: "Sarah Wijaya",
      email: "sarah.wijaya@gmd.internal",
      department: "Software Engineering",
      companyId: gmd.id,
      status: "ACTIVE",
    },
  });

  console.log("✅ Employees created across GMD, GMC, TEL");

  // 3. Seed Users for each of the 5 roles
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash("Password123!", salt);

  const roles = [
    { email: "superadmin@company.internal", name: "System Super Admin", role: "SUPER_ADMIN" as const },
    { email: "itadmin@company.internal", name: "Alex Pratama (IT Admin)", role: "IT_ADMIN" as const },
    { email: "finance@company.internal", name: "Dewi Lestari (Finance)", role: "FINANCE" as const },
    { email: "auditor@company.internal", name: "Budi Santoso (Auditor)", role: "AUDITOR" as const },
    {
      email: "sarah.wijaya@company.internal",
      name: "Sarah Wijaya (Employee)",
      role: "EMPLOYEE" as const,
      employeeId: empSarah.id,
    },
  ];

  for (const u of roles) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        passwordHash: defaultPasswordHash,
        role: u.role,
        employeeId: u.employeeId || null,
      },
    });
  }

  console.log("✅ Seeded 5 role accounts (SUPER_ADMIN, IT_ADMIN, FINANCE, AUDITOR, EMPLOYEE)");

  // 4. Seed Representative IT Assets
  const sampleAssets = [
    {
      assetTag: "GMD-LPT-001",
      isDuplicateTag: false,
      assetName: "ThinkPad T14 Gen 4",
      companyId: gmd.id,
      category: AssetCategory.LAPTOP,
      model: "21AH001NUS",
      cpu: "Intel Core i7-1365U",
      ram: "32 GB DDR5",
      serialNumber: "PF4B901X",
      macAddress: "3C:52:82:11:45:90",
      status: AssetStatus.IN_USE,
      physicalCondition: PhysicalCondition.GOOD,
      assignedEmployeeId: empSarah.id,
      location: "HQ Floor 3 - Software Lab",
      purchaseDate: new Date("2024-02-15"),
      purchaseCost: 24500000,
      usefulLifeMonths: 48,
      netBookValue: 19800000,
      laptopCode: "GMD-DEV-04",
      laptopAccount: "LOCAL-ADMIN",
      username: "sarah.wijaya",
      notes: "Assigned for development with secondary monitor",
    },
    {
      assetTag: "GMD-LPT-002",
      isDuplicateTag: false,
      assetName: "MacBook Pro 16\" M3 Pro",
      companyId: gmd.id,
      category: AssetCategory.LAPTOP,
      model: "A2991",
      cpu: "Apple M3 Pro (12-core)",
      ram: "36 GB Unified",
      serialNumber: "C02NL102MD6R",
      macAddress: "F0:18:98:3A:42:1B",
      status: AssetStatus.IN_USE,
      physicalCondition: PhysicalCondition.EXCELLENT,
      assignedEmployeeId: emp1.id,
      location: "HQ Floor 3 - IT Infrastructure",
      purchaseDate: new Date("2024-04-10"),
      purchaseCost: 38000000,
      usefulLifeMonths: 48,
      netBookValue: 33500000,
      laptopCode: "GMD-IT-01",
      laptopAccount: "ADMIN-IT",
      username: "bambang.s",
      notes: "Lead DevOps machine",
    },
    {
      assetTag: "GMC-LPT-010",
      isDuplicateTag: false,
      assetName: "Dell Latitude 5440",
      companyId: gmc.id,
      category: AssetCategory.LAPTOP,
      model: "Latitude 5440",
      cpu: "Intel Core i5-1345U",
      ram: "16 GB DDR5",
      serialNumber: "8G2B109",
      macAddress: "00:50:56:C0:00:08",
      status: AssetStatus.IN_USE,
      physicalCondition: PhysicalCondition.GOOD,
      assignedEmployeeId: emp2.id,
      location: "GMC Office - Level 2",
      purchaseDate: new Date("2023-11-20"),
      purchaseCost: 17500000,
      usefulLifeMonths: 36,
      netBookValue: 12800000,
      laptopCode: "GMC-FIN-02",
      laptopAccount: "FIN-ACC",
      username: "siti.rahmawati",
      notes: "Finance ERP workstation",
    },
    {
      assetTag: "TEL-DSK-001",
      isDuplicateTag: false,
      assetName: "HP Z2 Tower G9 Workstation",
      companyId: tel.id,
      category: AssetCategory.DESKTOP,
      model: "Z2 G9 TWR",
      cpu: "Intel Core i9-13900K",
      ram: "64 GB DDR5",
      serialNumber: "CZC240187B",
      macAddress: "E4:54:E8:89:12:44",
      status: AssetStatus.IN_USE,
      physicalCondition: PhysicalCondition.GOOD,
      assignedEmployeeId: emp3.id,
      location: "Data Center TEL - NOC Room",
      purchaseDate: new Date("2023-08-01"),
      purchaseCost: 45000000,
      usefulLifeMonths: 60,
      netBookValue: 34000000,
      laptopCode: "TEL-NOC-01",
      laptopAccount: "NOC-ADMIN",
      username: "rizky.r",
      notes: "24/7 Network Monitoring System",
    },
    {
      assetTag: "GMD-LPT-003",
      isDuplicateTag: false,
      assetName: "ThinkPad E14 Gen 5",
      companyId: gmd.id,
      category: AssetCategory.LAPTOP,
      model: "21JK000HUS",
      cpu: "AMD Ryzen 5 7530U",
      ram: "16 GB DDR4",
      serialNumber: null, // Legacy unnumbered asset test case
      macAddress: null,
      status: AssetStatus.AVAILABLE,
      physicalCondition: PhysicalCondition.GOOD,
      assignedEmployeeId: null,
      location: "IT Storage Room A - Rack 2",
      purchaseDate: new Date("2023-05-12"),
      purchaseCost: 13500000,
      usefulLifeMonths: 36,
      netBookValue: 7500000,
      laptopCode: "GMD-POOL-03",
      laptopAccount: "DEFAULT-USER",
      username: null,
      notes: "Available for new employee onboarding",
    },
    {
      // Duplicate legacy asset tag demonstration
      assetTag: "GMD-LPT-001",
      isDuplicateTag: true,
      assetName: "Legacy Lenovo ThinkPad T480 (Imported)",
      companyId: gmd.id,
      category: AssetCategory.LAPTOP,
      model: "T480",
      cpu: "Intel Core i5-8250U",
      ram: "8 GB DDR4",
      serialNumber: "PF189284",
      macAddress: "08:11:96:DF:80:12",
      status: AssetStatus.MAINTENANCE,
      physicalCondition: PhysicalCondition.FAIR,
      assignedEmployeeId: null,
      location: "IT Workshop - Diagnostic Bench",
      purchaseDate: new Date("2019-06-10"),
      purchaseCost: 16000000,
      usefulLifeMonths: 36,
      netBookValue: 0,
      laptopCode: "OLD-GMD-001",
      laptopAccount: "ADMIN",
      username: null,
      notes: "Legacy asset tag duplicate from 2019 inventory. Battery replacement pending.",
    },
  ];

  for (const assetData of sampleAssets) {
    const asset = await prisma.asset.create({
      data: {
        ...assetData,
        qrCodeToken: `QR-${assetData.assetTag}-${Date.now()}`.toUpperCase(),
      },
    });

    // Create initial history
    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: "CREATED",
        performedBy: "System Seeder",
        notes: `Initial baseline inventory record for ${asset.assetName}.${
          asset.isDuplicateTag ? " Flagged as duplicate tag for review." : ""
        }`,
      },
    });

    // Create assignment if assigned
    if (asset.assignedEmployeeId) {
      await prisma.assetAssignment.create({
        data: {
          assetId: asset.id,
          employeeId: asset.assignedEmployeeId,
          actionType: "ASSIGN",
          conditionAtAction: asset.physicalCondition,
          performedBy: "System Seeder",
          notes: "Initial asset deployment record",
        },
      });
    }
  }

  console.log("✅ Seeded initial realistic IT assets with immutable assignment history and audit logs");
  console.log("🎉 Database seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

