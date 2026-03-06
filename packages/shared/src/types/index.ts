export interface Company {
  id: string;
  name: string;
  cnpj: string;
  address?: string;
  phone?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  timezone: string;
  toleranceMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  branchId: string;
  name: string;
  cpf: string;
  pis?: string;
  registration?: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  scheduleId?: string;
  admissionDate: Date;
  terminationDate?: Date | null;
  isActive: boolean;
  deviceUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Device {
  id: string;
  branchId: string;
  name: string;
  model: string;
  serialNumber: string;
  ipAddress: string;
  port: number;
  login: string;
  encryptedPassword: string;
  isActive: boolean;
  lastSyncAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedPunch {
  id: string;
  rawPunchEventId: string;
  employeeId: string;
  punchTime: Date;
  punchType: 'ENTRY' | 'EXIT' | 'BREAK_START' | 'BREAK_END';
  status: 'NORMAL' | 'ADJUSTED' | 'MANUAL';
  originalTime: Date;
  adjustedBy?: string;
  adjustmentReason?: string;
  createdAt: Date;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  status: 'OPEN' | 'CALCULATED' | 'CLOSED' | 'APPROVED';
  totalWorkedMinutes: number;
  totalOvertimeMinutes: number;
  totalNightMinutes: number;
  totalAbsenceMinutes: number;
  totalLateMinutes: number;
  totalBalanceMinutes: number;
  calculatedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncPayload {
  deviceId: string;
  timestamp: Date;
  punches: {
    userId: string;
    timestamp: Date;
    type: string;
  }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: any[];
}
