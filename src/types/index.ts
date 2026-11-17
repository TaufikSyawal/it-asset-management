export type UserRole = 'SUPER_ADMIN' | 'IT_ADMIN' | 'FINANCE' | 'AUDITOR' | 'EMPLOYEE';

export type AssetStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'DISPOSED' | 'ARCHIVED' | 'MISSING';

export type PhysicalCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

export type AssetCategory = 
  | 'LAPTOP' 
  | 'DESKTOP' 
  | 'SERVER' 
  | 'MONITOR' 
  | 'PRINTER' 
  | 'NETWORK_EQUIPMENT' 
  | 'ACCESSORY' 
  | 'OTHER';

export type AssignmentAction = 'ASSIGN' | 'RETURN' | 'TRANSFER' | 'REPLACEMENT';

export type DepreciationMethod = 'STRAIGHT_LINE' | 'REDUCING_BALANCE' | 'NONE';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string | null;
  employeeId?: string | null;
}

export interface CompanyDTO {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  _count?: {
    assets: number;
    employees: number;
  };
}

export interface EmployeeDTO {
  id: string;
  employeeId: string;
  name: string;
  email?: string | null;
  department?: string | null;
  companyId: string;
  status: string;
  company?: {
    code: string;
    name: string;
  };
}

export type PhotoCategory =
  | 'MAIN_PHOTO'
  | 'FRONT_VIEW'
  | 'BACK_BOTTOM_VIEW'
  | 'SERIAL_NUMBER'
  | 'DAMAGE_CONDITION'
  | 'HANDOVER'
  | 'RETURN'
  | 'OTHER';

export interface AssetPhotoDTO {
  id: string;
  assetId: string;
  category: PhotoCategory;
  fileKey: string;
  thumbnailKey?: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  description?: string | null;
  isPrimary: boolean;
  assignmentId?: string | null;
  uploadedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  url: string;
  thumbnailUrl: string;
}

export interface AssetAssignmentDTO {
  id: string;
  assetId: string;
  employeeId?: string | null;
  employee?: EmployeeDTO | null;
  actionType: AssignmentAction;
  conditionAtAction: PhysicalCondition;
  assignedAt: string;
  returnedAt?: string | null;
  performedBy?: string | null;
  handoverDocRef?: string | null;
  notes?: string | null;
  photos?: AssetPhotoDTO[];
}

export interface AssetHistoryDTO {
  id: string;
  assetId: string;
  action: string;
  changes?: any;
  notes?: string | null;
  performedBy?: string | null;
  createdAt: string;
}

export interface AssetDTO {
  id: string;
  assetTag: string;
  isDuplicateTag: boolean;
  assetName: string;
  companyId: string;
  company: CompanyDTO;
  category: AssetCategory;
  model: string;
  cpu: string;
  ram: string;
  serialNumber?: string | null;
  macAddress?: string | null;
  status: AssetStatus;
  physicalCondition: PhysicalCondition;
  assignedEmployeeId?: string | null;
  assignedEmployee?: EmployeeDTO | null;
  location: string;
  purchaseDate?: string | null;
  
  // Financial fields (Masked if user lacks financial permission)
  purchaseCost?: number | null;
  usefulLifeMonths?: number | null;
  depreciationMethod?: DepreciationMethod;
  accumulatedDepreciation?: number | null;
  netBookValue?: number | null;
  depreciationStartDate?: string | null;
  
  // Non-sensitive machine identifiers
  laptopCode?: string | null;
  laptopAccount?: string | null;
  username?: string | null;
  notes?: string | null;
  
  qrCodeToken?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  
  assignments?: AssetAssignmentDTO[];
  historyLogs?: AssetHistoryDTO[];
  photos?: AssetPhotoDTO[];
  primaryPhoto?: AssetPhotoDTO | null;
}

export interface AssetFilters {
  search?: string;
  companyId?: string;
  status?: string;
  category?: string;
  condition?: string;
  isDuplicateTag?: boolean;
  page?: number;
  limit?: number;
}

export type OpnameStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type VerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'MISMATCH_LOCATION'
  | 'MISMATCH_USER'
  | 'MISSING'
  | 'UNREGISTERED';

export interface QRCodePayload {
  v: number;
  id: string;
  tag: string;
  co: string;
  sn?: string | null;
  tok: string;
}

export interface StockOpnameItemDTO {
  id: string;
  sessionId: string;
  assetId: string;
  asset: AssetDTO;
  expectedLocation?: string | null;
  expectedEmployeeId?: string | null;
  expectedEmployee?: EmployeeDTO | null;
  expectedCondition?: PhysicalCondition | null;
  scannedAt?: string | null;
  scannedBy?: string | null;
  verificationStatus: VerificationStatus;
  actualLocation?: string | null;
  actualCondition?: PhysicalCondition | null;
  actualEmployeeId?: string | null;
  actualEmployee?: EmployeeDTO | null;
  isUnexpected: boolean;
  scanCount: number;
  discrepancyNotes?: string | null;
  reconciled: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockOpnameSessionStats {
  totalExpected: number;
  scannedCount: number;
  verifiedCount: number;
  locationMismatchCount: number;
  userMismatchCount: number;
  missingCount: number;
  unexpectedCount: number;
  duplicateScansCount: number;
  progressPercentage: number;
}

export interface StockOpnameSessionDTO {
  id: string;
  sessionNumber: string;
  title: string;
  companyId?: string | null;
  company?: CompanyDTO | null;
  locationScope?: string | null;
  categoryScope?: string | null;
  status: OpnameStatus;
  startDate: string;
  endDate?: string | null;
  conductedBy?: string | null;
  reconciledAt?: string | null;
  reconciledBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: StockOpnameItemDTO[];
  stats?: StockOpnameSessionStats;
}

