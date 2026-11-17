# Enterprise IT Asset Management System (ITAMS)

A modern, production-grade IT Asset Management System built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **Prisma ORM** with **PostgreSQL**.

---

## 🖥️ Modern Enterprise Multi-View Architecture

The application features a modern SaaS layout with a collapsible sidebar and **two dedicated overview dashboards**:

1. **Management Overview (Executive Level)**:
   - High-level KPIs: Total Assets, In Use, Available, Maintenance, Assets Requiring Attention, and Utilization Percentage.
   - Financial Valuation: Historical Acquisition Cost and Net Book Value (NBV) calculated via straight-line depreciation (role-restricted).
   - SVG Analytics: Asset Distribution by Entity (Donut Chart) and Allocation by Category (Bar Chart).
   - Factual Management Intelligence & Action Items (Zero low-level hardware clutter like MAC/CPU/RAM).

2. **IT Operations Overview (Operational Level)**:
   - Daily IT workflow hub: Assigned assets, available stock, maintenance queue, missing serial numbers, duplicate tag review.
   - Quick Action Bar: One-click triggers for Add Asset, Assign, Transfer User, Return to Storage, and Batch Excel Import.
   - Live Custody Feed: Real-time chronological stream of recent handovers, transfers, and BAST reference documents.
   - Operational Task Queue: Actionable cards to address missing serials, duplicate tags, and repair bench clearance.

3. **Dedicated Asset Inventory**:
   - Comprehensive tabular inventory with live multi-column search, company filters (GMD, GMC, TEL), status filters, category filters, and duplicate tag review.
   - Complete modal workflows: Add, Edit, Assign/Transfer, Soft Archive, and Batch Excel Ingestion.

4. **Supporting Modules**:
   - **Employees Directory**: Personnel custody overview across GMD, GMC, and TEL.
   - **Assignments & Transfers**: Immutable custody log with start/return dates and BAST documents.
   - **Maintenance**: Dedicated repair and diagnostic workbench.
   - **Stock Opname**: Phase 2 physical audit session and QR token registry.
   - **Reports**: Printable/PDF exportable executive summary statements.
   - **Settings**: PostgreSQL connection status and RBAC persona selector.

---

## 🔐 Role-Based Access Control (RBAC) & Data Masking
Phase 1 implements 5 distinct personas with dynamic permission enforcement and field-level masking:

| Role | Asset Operations (Add/Edit) | Assignment & Transfer | Archive | Financial Data (Cost, NBV) | Audit & Logs |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Super Admin** | Full | Full | Full | View & Edit | Full |
| **IT Admin** | Full | Full | Archive Only | **Masked (No Access)** | View |
| **Finance** | View Only | None | None | **Full View & Edit** | View |
| **Auditor** | View Only | None | None | View Only | Full |
| **Employee** | View (Assigned Only) | None | None | **Masked (No Access)** | None |

*Test different roles directly in the application using the **Role Switcher** in the top navigation bar.*

---

## ⚙️ Quick Start & PostgreSQL Setup

### 1. Configure PostgreSQL Connection
Open `.env` and set your PostgreSQL connection string:
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/it_inventory?schema=public"
```
*(Supports local PostgreSQL, Docker, Supabase, Neon, or cloud AWS RDS/GCP Cloud SQL).*

### 2. Push Database Schema
Apply the Prisma schema to create all tables, indexes, and enums:
```bash
npx prisma db push
```

### 3. Seed Realistic Initial Data
Run the seeder to populate **GMD**, **GMC**, and **TEL**, test role users, employee directories, realistic laptops/desktops, and immutable assignment histories:
```bash
npm run prisma:seed
```

### 4. Run Development / Production Server
```bash
# Development mode
npm run dev

# Production build and run
npm run build
npm run start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📋 Asset Fields Specification (19+ Attributes)
Aligned with enterprise Excel inventories:
1. **Asset Tag**: Verbatim corporate tag; duplicates supported and flagged (`isDuplicateTag`) without auto-renaming.
2. **Asset Name**: Device descriptor (e.g. ThinkPad T14 Gen 4, MacBook Pro 16).
3. **Company Entity**: Designated owner (`GMD`, `GMC`, or `TEL`).
4. **Category**: Laptop, Desktop, Server, Monitor, Printer, Network Equipment, Accessory, Other.
5. **Model**: Manufacturer machine model number.
6. **CPU**: Processor specification.
7. **RAM**: Memory size and type.
8. **Serial Number**: Optional field for legacy assets; unique index when present.
9. **MAC Address**: Network adapter hardware address.
10. **Status**: `AVAILABLE`, `IN_USE`, `MAINTENANCE`, `DISPOSED`, `ARCHIVED`, `MISSING`.
11. **Physical Condition**: `EXCELLENT`, `GOOD`, `FAIR`, `POOR`, `DAMAGED`.
12. **Assigned Employee**: Custodian linked to employee directory.
13. **Location**: Physical room / floor / data center site.
14. **Purchase Date**: Acquisition date.
15. **Purchase Cost**: Capital acquisition value in IDR (Role-restricted).
16. **Useful Life (Months)** & **Depreciation**: Straight-line depreciation schema.
17. **Net Book Value (NBV)**: Current book value (Role-restricted).
18. **Laptop Code**: Internal inventory barcode / identifier.
19. **Laptop Account & Username**: Machine host and user login identifiers (**Zero passwords stored**).
20. **Notes**: Remarks and special hardware notes.

---

## 🔄 Immutable Handover & Assignment Tracking
When an asset changes hands (Assign, Return, Transfer, or Replacement):
- The previous assignment record is finalized with a return timestamp.
- A new immutable record is inserted into `asset_assignments` with handover reference numbers (BAST) and physical condition checks.
- Changes are appended to `asset_histories` audit logs.
- Past assignment history is **never overwritten**.

---

## 📊 Excel Batch Ingestion
- Click **Import Excel** in the navbar to upload `.xlsx` or `.csv` spreadsheets.
- Includes a dry-run preview displaying parsed rows, validation errors, and detected duplicate tags before writing to the database.
- A standardized template can be downloaded directly from the import dialog.

---

## 📱 Future-Proofing: QR Code & Stock Opname
- Each registered asset generates a unique cryptographic `qrCodeToken`.
- Schema includes `StockOpnameSession` and `StockOpnameItem` models ready for Phase 2 mobile camera scanning and physical audit reconciliation.

