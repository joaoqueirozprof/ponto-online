'use client';

import { apiClient } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';

// ======================== INTERFACES ========================
interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  cpf: string;
  pis: string;
  branch: { id: string; name: string } | null;
  schedule: { name: string; type: string } | null;
}

interface TimesheetDay {
  date: string;
  workedMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  lateMinutes: number;
  absenceMinutes: number;
  breakMinutes: number;
  punchCount: number;
  status: string;
  notes: string | null;
}

interface PunchRecord {
  time: string;
  type: string;
  status: string;
}

interface EmployeeReportData {
  employee: Employee;
  timesheet: {
    id: string;
    month: number;
    year: number;
    status: string;
    totalWorkedMinutes: number;
    totalOvertimeMinutes: number;
    totalNightMinutes: number;
    totalAbsenceMinutes: number;
    totalLateMinutes: number;
    totalBalanceMinutes: number;
    timesheetDays: TimesheetDay[];
  } | null;
  punchesByDate: Record<string, PunchRecord[]>;
}

interface BranchTimesheetItem {
  employeeId: string;
  month: number;
  year: number;
  status: string;
  totalWorkedMinutes: number;
  totalOvertimeMinutes: number;
  totalNightMinutes: number;
  totalAbsenceMinutes: number;
  totalLateMinutes: number;
  totalBalanceMinutes: number;
  employee: { id: string; name: string; cpf: string; position: string; department: string };
}

interface BranchReportData {
  branch: { id: string; name: string; company?: { name: string } } | string;
  month: number;
  year: number;
  summary: {
    totalEmployees: number;
    processedTimesheets: number;
    approvedTimesheets: number;
    averageWorkedHours: number;
    totalOvertimeHours: number;
    totalLateMinutes: number;
    totalAbsenceMinutes: number;
    totalNightMinutes: number;
  };
  timesheets: BranchTimesheetItem[];
}

interface PayrollItem {
  employee: { id: string; name: string; cpf: string; pis: string; position: string; department: string };
  workedMinutes: number;
  workedHours: string;
  overtimeMinutes: number;
  overtimeHours: string;
  nightMinutes: number;
  nightHours: string;
  lateMinutes: number;
  absenceMinutes: number;
  balanceMinutes: number;
}

interface PayrollReportData {
  branch: { id: string; name: string; company?: { name: string } } | string;
  month: number;
  year: number;
  totalProcessed: number;
  payrollData: PayrollItem[];
}

interface Branch { id: string; name: string }
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info' }

// ======================== CONSTANTS ========================
const MONTHS = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

const DAY_NAMES_FULL: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
  4: 'Quinta', 5: 'Sexta', 6: 'Sábado',
};

const STATUS_PT: Record<string, string> = {
  NORMAL: 'Normal', WEEKEND: 'Fim de Sem.', HOLIDAY: 'Feriado',
  ABSENCE: 'Falta', INCOMPLETE: 'Incompleto',
  APPROVED: 'Aprovado', CALCULATED: 'Calculado', OPEN: 'Aberto', CLOSED: 'Fechado',
};

// ======================== HELPERS ========================
const formatHHMM = (minutes: number | undefined | null): string => {
  if (minutes === undefined || minutes === null || minutes === 0) return '00:00';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatBrazilianDate = (dateString: string): string => {
  try {
    const datePart = dateString?.includes('T') ? dateString.split('T')[0] : dateString;
    const date = new Date(datePart + 'T12:00:00');
    if (isNaN(date.getTime())) return '-';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '-';
  }
};

const getDayName = (dateString: string): string => {
  try {
    const datePart = dateString?.includes('T') ? dateString.split('T')[0] : dateString;
    const date = new Date(datePart + 'T12:00:00');
    if (isNaN(date.getTime())) return '';
    return DAY_NAMES_FULL[date.getDay()] || '';
  } catch {
    return '';
  }
};

const getMonthName = (month: number): string => MONTHS[(month || 1) - 1]?.label || '';

const formatPunchTime = (isoTime: string): string => {
  try {
    const d = new Date(isoTime);
    // Use America/Fortaleza (BRT UTC-3) timezone for display
    return d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Fortaleza',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
};

const safeNumber = (n: any): number => {
  const val = Number(n);
  return isNaN(val) ? 0 : val;
};

const getBranchName = (branch: any): string => {
  if (!branch) return '-';
  if (typeof branch === 'string') return branch;
  return branch.name || '-';
};

const getCompanyName = (branch: any): string => {
  if (!branch || typeof branch === 'string') return '';
  return branch.company?.name || '';
};

// ======================== MAIN COMPONENT ========================
export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const printRef = useRef<HTMLDivElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'employee' | 'branch' | 'payroll'>('employee');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [employeeReport, setEmployeeReport] = useState({ employeeId: '', month: '', year: currentYear.toString() });
  const [employeeData, setEmployeeData] = useState<EmployeeReportData | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [branchReport, setBranchReport] = useState({ branchId: '', month: '', year: currentYear.toString() });
  const [branchData, setBranchData] = useState<BranchReportData | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);

  const [payrollReport, setPayrollReport] = useState({ branchId: '', month: '', year: currentYear.toString() });
  const [payrollData, setPayrollData] = useState<PayrollReportData | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, branchRes] = await Promise.all([
        apiClient.get('/employees', { params: { take: 999 } }),
        apiClient.get('/branches', { params: { take: 999 } }),
      ]);
      setEmployees(empRes.data.data || []);
      setBranches(branchRes.data.data || []);
    } catch {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => { window.print(); };

  const handleEmployeeReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeReport.employeeId || !employeeReport.month || !employeeReport.year) {
      showToast('Preencha todos os campos', 'error'); return;
    }
    try {
      setEmployeeLoading(true);
      const r = await apiClient.get(`/reports/employee/${employeeReport.employeeId}/${employeeReport.month}/${employeeReport.year}`);
      setEmployeeData(r.data);
      showToast('Espelho de ponto gerado', 'success');
    } catch { showToast('Erro ao gerar relatório', 'error'); }
    finally { setEmployeeLoading(false); }
  };

  const handleBranchReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchReport.branchId || !branchReport.month || !branchReport.year) {
      showToast('Preencha todos os campos', 'error'); return;
    }
    try {
      setBranchLoading(true);
      const r = await apiClient.get(`/reports/branch/${branchReport.branchId}/${branchReport.month}/${branchReport.year}`);
      setBranchData(r.data);
      showToast('Relatório da filial gerado', 'success');
    } catch { showToast('Erro ao gerar relatório', 'error'); }
    finally { setBranchLoading(false); }
  };

  const handlePayrollReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payrollReport.branchId || !payrollReport.month || !payrollReport.year) {
      showToast('Preencha todos os campos', 'error'); return;
    }
    try {
      setPayrollLoading(true);
      const r = await apiClient.get(`/reports/payroll/${payrollReport.branchId}/${payrollReport.month}/${payrollReport.year}`);
      setPayrollData(r.data);
      showToast('Folha de pagamento gerada', 'success');
    } catch { showToast('Erro ao gerar relatório', 'error'); }
    finally { setPayrollLoading(false); }
  };

  // ======================== SUB-COMPONENTS ========================
  const MetricCard = ({ label, value, variant = 'default' }: {
    label: string; value: string | number;
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple';
  }) => {
    const variants: Record<string, string> = {
      default: 'bg-slate-50 border-slate-200',
      success: 'bg-emerald-50 border-emerald-200',
      danger: 'bg-red-50 border-red-200',
      warning: 'bg-amber-50 border-amber-200',
      info: 'bg-blue-50 border-blue-200',
      purple: 'bg-purple-50 border-purple-200',
    };
    const textVariants: Record<string, string> = {
      default: 'text-slate-900', success: 'text-emerald-700', danger: 'text-red-700',
      warning: 'text-amber-700', info: 'text-blue-700', purple: 'text-purple-700',
    };
    return (
      <div className={`${variants[variant]} border rounded-xl p-4`}>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${textVariants[variant]}`}>{value}</p>
      </div>
    );
  };

  const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
      <p className="text-slate-500 text-sm">Gerando relatório...</p>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-16">
      <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-slate-400 text-center max-w-sm">{message}</p>
    </div>
  );

  const NoDataState = ({ type }: { type: string }) => (
    <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-xl border border-slate-200">
      <svg className="w-12 h-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p className="text-slate-700 font-semibold mb-1">Sem dados para este período</p>
      <p className="text-slate-500 text-sm text-center max-w-md">
        {type === 'payroll'
          ? 'Não há folhas de ponto aprovadas para este mês e filial.'
          : 'Não foram encontrados registros para o período selecionado.'}
      </p>
    </div>
  );

  const ReportHeader = ({ title, period, subtitle }: { title: string; period: string; subtitle?: string }) => (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 print:bg-white print:border-gray-400 print:mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          <p className="text-sm text-indigo-600 font-semibold mt-1">Período: {period}</p>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-sm font-medium transition print:hidden flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
      </div>
    </div>
  );

  const FormSelect = ({ label, value, onChange, children }: {
    label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
  }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
        required
      >
        {children}
      </select>
    </div>
  );

  const SubmitButton = ({ loading: isLoading, text }: { loading: boolean; text: string }) => (
    <button
      type="submit"
      disabled={isLoading}
      className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold transition-all flex items-center justify-center gap-2 text-sm"
    >
      {isLoading ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          Gerando...
        </>
      ) : text}
    </button>
  );

  const getDayRowClass = (status: string, idx: number): string => {
    switch (status) {
      case 'WEEKEND': return 'bg-slate-50';
      case 'HOLIDAY': return 'bg-blue-50/50';
      case 'ABSENCE': return 'bg-red-50/50';
      case 'INCOMPLETE': return 'bg-amber-50/50';
      default: return idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
    }
  };

  const getStatusBadge = (status: string): string => {
    switch (status) {
      case 'NORMAL': return 'bg-slate-100 text-slate-600';
      case 'WEEKEND': return 'bg-slate-100 text-slate-500';
      case 'HOLIDAY': return 'bg-blue-100 text-blue-700';
      case 'ABSENCE': return 'bg-red-100 text-red-700';
      case 'INCOMPLETE': return 'bg-amber-100 text-amber-700';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
      case 'CALCULATED': return 'bg-blue-100 text-blue-700';
      case 'OPEN': return 'bg-slate-100 text-slate-500';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getDayPunchesDetail = (dateString: string, punchesByDate?: Record<string, PunchRecord[]>): {
    entry: string; breakStart: string; breakEnd: string; exit: string; all: string;
  } => {
    const empty = { entry: '-', breakStart: '-', breakEnd: '-', exit: '-', all: '-' };
    if (!punchesByDate) return empty;
    const dateKey = dateString?.split('T')[0] || '';
    const punches = punchesByDate[dateKey];
    if (!punches || punches.length === 0) return empty;

    const entryP = punches.find(p => p.type === 'ENTRY');
    const breakStartP = punches.find(p => p.type === 'BREAK_START');
    const breakEndP = punches.find(p => p.type === 'BREAK_END');
    const exitP = [...punches].reverse().find(p => p.type === 'EXIT');

    return {
      entry: entryP ? formatPunchTime(entryP.time) : '-',
      breakStart: breakStartP ? formatPunchTime(breakStartP.time) : '-',
      breakEnd: breakEndP ? formatPunchTime(breakEndP.time) : '-',
      exit: exitP ? formatPunchTime(exitP.time) : '-',
      all: punches.map((p) => formatPunchTime(p.time)).join(' | '),
    };
  };

  return (
    <div className="space-y-6">
      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          table { font-size: 10px !important; }
          th, td { padding: 4px 6px !important; }
        }
      `}</style>

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 print:hidden">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' :
            toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
          }`}>{toast.message}</div>
        ))}
      </div>

      {/* Header */}
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-slate-500 mt-1">Espelho de ponto, relatórios de filial e folha de pagamento</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm inline-flex print:hidden">
        {[
          { id: 'employee', label: 'Espelho de Ponto' },
          { id: 'branch', label: 'Relatório da Filial' },
          { id: 'payroll', label: 'Folha de Pagamento' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'employee' | 'branch' | 'payroll')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== EMPLOYEE REPORT ==================== */}
      {activeTab === 'employee' && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="print:hidden">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-4">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Espelho de Ponto</h2>
              <p className="text-xs text-slate-500 mb-5">Relatório individual do colaborador</p>
              <form onSubmit={handleEmployeeReport} className="space-y-4">
                <FormSelect label="Colaborador" value={employeeReport.employeeId} onChange={(v) => setEmployeeReport({ ...employeeReport, employeeId: v })}>
                  <option value="">Selecione...</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </FormSelect>
                <div className="grid grid-cols-2 gap-3">
                  <FormSelect label="Mês" value={employeeReport.month} onChange={(v) => setEmployeeReport({ ...employeeReport, month: v })}>
                    <option value="">Mês</option>
                    {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </FormSelect>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Ano</label>
                    <input type="number" value={employeeReport.year} onChange={(e) => setEmployeeReport({ ...employeeReport, year: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" required />
                  </div>
                </div>
                <SubmitButton loading={employeeLoading} text="Gerar Espelho" />
              </form>
            </div>
          </div>

          <div ref={printRef}>
            {employeeLoading ? <LoadingSpinner /> : employeeData ? (
              employeeData.timesheet ? (
                <div className="space-y-5">
                  <ReportHeader
                    title="Espelho de Ponto Individual"
                    period={`${getMonthName(employeeData.timesheet.month)} / ${employeeData.timesheet.year}`}
                    subtitle={employeeData.employee?.branch?.name || ''}
                  />

                  {/* Employee Info Card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Nome</p>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">{employeeData.employee?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cargo</p>
                        <p className="text-sm text-slate-600 mt-0.5">{employeeData.employee?.position || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Departamento</p>
                        <p className="text-sm text-slate-600 mt-0.5">{employeeData.employee?.department || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Horário</p>
                        <p className="text-sm text-slate-600 mt-0.5">{employeeData.employee?.schedule?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">CPF</p>
                        <p className="text-sm text-slate-600 font-mono mt-0.5">{employeeData.employee?.cpf || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">PIS</p>
                        <p className="text-sm text-slate-600 font-mono mt-0.5">{employeeData.employee?.pis || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Filial</p>
                        <p className="text-sm text-slate-600 mt-0.5">{employeeData.employee?.branch?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Status</p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-semibold ${getStatusBadge(employeeData.timesheet.status)}`}>
                          {STATUS_PT[employeeData.timesheet.status] || employeeData.timesheet.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <MetricCard label="Trabalhadas" value={formatHHMM(employeeData.timesheet.totalWorkedMinutes)} variant="info" />
                    <MetricCard label="Horas Extra" value={formatHHMM(employeeData.timesheet.totalOvertimeMinutes)} variant="success" />
                    <MetricCard label="Atraso" value={formatHHMM(employeeData.timesheet.totalLateMinutes)} variant={safeNumber(employeeData.timesheet.totalLateMinutes) > 0 ? 'warning' : 'default'} />
                    <MetricCard label="Faltas" value={formatHHMM(employeeData.timesheet.totalAbsenceMinutes)} variant={safeNumber(employeeData.timesheet.totalAbsenceMinutes) > 0 ? 'danger' : 'default'} />
                    <MetricCard label="Banco Horas" value={formatHHMM(employeeData.timesheet.totalBalanceMinutes)} variant={safeNumber(employeeData.timesheet.totalBalanceMinutes) >= 0 ? 'success' : 'danger'} />
                    <MetricCard label="Noturnas" value={formatHHMM(employeeData.timesheet.totalNightMinutes)} variant="purple" />
                  </div>

                  {/* Daily Detail Table */}
                  {employeeData.timesheet.timesheetDays && employeeData.timesheet.timesheetDays.length > 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b border-slate-200">
                        <h3 className="text-sm font-bold text-slate-900">Detalhamento Diário</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="px-2 py-2.5 text-left font-semibold text-slate-500">Data</th>
                              <th className="px-2 py-2.5 text-left font-semibold text-slate-500">Dia</th>
                              <th className="px-2 py-2.5 text-center font-semibold text-slate-500">Entrada</th>
                              <th className="px-2 py-2.5 text-center font-semibold text-slate-500">Saída Int.</th>
                              <th className="px-2 py-2.5 text-center font-semibold text-slate-500">Retorno</th>
                              <th className="px-2 py-2.5 text-center font-semibold text-slate-500">Saída</th>
                              <th className="px-2 py-2.5 text-right font-semibold text-slate-500">Trabalhado</th>
                              <th className="px-2 py-2.5 text-right font-semibold text-slate-500">Extra</th>
                              <th className="px-2 py-2.5 text-right font-semibold text-slate-500">Noturno</th>
                              <th className="px-2 py-2.5 text-right font-semibold text-slate-500">Atraso</th>
                              <th className="px-2 py-2.5 text-right font-semibold text-slate-500">Falta</th>
                              <th className="px-2 py-2.5 text-center font-semibold text-slate-500">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employeeData.timesheet.timesheetDays.map((day, idx) => {
                              const isSunday = getDayName(day.date) === 'Domingo';
                              const punches = getDayPunchesDetail(day.date, employeeData.punchesByDate);
                              return (
                                <tr key={idx} className={`${getDayRowClass(day.status, idx)} border-b border-slate-100 hover:bg-slate-50 transition`}>
                                  <td className="px-2 py-2 font-mono text-slate-700">{formatBrazilianDate(day.date)}</td>
                                  <td className={`px-2 py-2 ${isSunday ? 'text-red-500 font-semibold' : 'text-slate-600'}`}>
                                    {getDayName(day.date)}
                                  </td>
                                  <td className="px-2 py-2 text-center font-mono text-emerald-700">{punches.entry}</td>
                                  <td className="px-2 py-2 text-center font-mono text-amber-700">{punches.breakStart}</td>
                                  <td className="px-2 py-2 text-center font-mono text-blue-700">{punches.breakEnd}</td>
                                  <td className="px-2 py-2 text-center font-mono text-red-700">{punches.exit}</td>
                                  <td className="px-2 py-2 text-right text-slate-900 font-mono">{formatHHMM(day.workedMinutes)}</td>
                                  <td className="px-2 py-2 text-right text-emerald-600 font-mono">{safeNumber(day.overtimeMinutes) > 0 ? formatHHMM(day.overtimeMinutes) : '-'}</td>
                                  <td className="px-2 py-2 text-right text-purple-600 font-mono">{safeNumber(day.nightMinutes) > 0 ? formatHHMM(day.nightMinutes) : '-'}</td>
                                  <td className="px-2 py-2 text-right text-amber-600 font-mono">{safeNumber(day.lateMinutes) > 0 ? formatHHMM(day.lateMinutes) : '-'}</td>
                                  <td className="px-2 py-2 text-right text-red-600 font-mono">{safeNumber(day.absenceMinutes) > 0 ? formatHHMM(day.absenceMinutes) : '-'}</td>
                                  <td className="px-2 py-2 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusBadge(day.status)}`}>
                                      {STATUS_PT[day.status] || day.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Totals Row */}
                            <tr className="bg-slate-100 border-t-2 border-indigo-300 font-bold">
                              <td colSpan={6} className="px-2 py-3 text-right text-slate-700 uppercase text-[10px] tracking-wider">Totais do Período</td>
                              <td className="px-2 py-3 text-right text-slate-900 font-mono">{formatHHMM(employeeData.timesheet.totalWorkedMinutes)}</td>
                              <td className="px-2 py-3 text-right text-emerald-600 font-mono">{formatHHMM(employeeData.timesheet.totalOvertimeMinutes)}</td>
                              <td className="px-2 py-3 text-right text-purple-600 font-mono">{formatHHMM(employeeData.timesheet.totalNightMinutes)}</td>
                              <td className="px-2 py-3 text-right text-amber-600 font-mono">{formatHHMM(employeeData.timesheet.totalLateMinutes)}</td>
                              <td className="px-2 py-3 text-right text-red-600 font-mono">{formatHHMM(employeeData.timesheet.totalAbsenceMinutes)}</td>
                              <td className="px-2 py-3"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <NoDataState type="employee" />
                  )}

                  {/* Signature Area (print only) */}
                  <div className="hidden print:block mt-16">
                    <div className="grid grid-cols-2 gap-16 mt-8">
                      <div className="text-center">
                        <div className="border-t border-black pt-2">
                          <p className="text-sm font-bold">{employeeData.employee?.name || ''}</p>
                          <p className="text-xs text-gray-600">Colaborador</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="border-t border-black pt-2">
                          <p className="text-sm font-bold">Responsável RH</p>
                          <p className="text-xs text-gray-600">Recursos Humanos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <NoDataState type="employee" />
              )
            ) : <EmptyState message="Selecione um colaborador, mês e ano para gerar o espelho de ponto" />}
          </div>
        </div>
      )}

      {/* ==================== BRANCH REPORT ==================== */}
      {activeTab === 'branch' && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="print:hidden">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-4">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Relatório da Filial</h2>
              <p className="text-xs text-slate-500 mb-5">Resumo geral por filial</p>
              <form onSubmit={handleBranchReport} className="space-y-4">
                <FormSelect label="Filial" value={branchReport.branchId} onChange={(v) => setBranchReport({ ...branchReport, branchId: v })}>
                  <option value="">Selecione...</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </FormSelect>
                <div className="grid grid-cols-2 gap-3">
                  <FormSelect label="Mês" value={branchReport.month} onChange={(v) => setBranchReport({ ...branchReport, month: v })}>
                    <option value="">Mês</option>
                    {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </FormSelect>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Ano</label>
                    <input type="number" value={branchReport.year} onChange={(e) => setBranchReport({ ...branchReport, year: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" required />
                  </div>
                </div>
                <SubmitButton loading={branchLoading} text="Gerar Relatório" />
              </form>
            </div>
          </div>

          <div>
            {branchLoading ? <LoadingSpinner /> : branchData ? (
              <div className="space-y-5">
                <ReportHeader
                  title={`Relatório da Filial — ${getBranchName(branchData.branch)}`}
                  period={`${getMonthName(branchData.month)} / ${branchData.year}`}
                  subtitle={getCompanyName(branchData.branch)}
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Colaboradores" value={safeNumber(branchData.summary?.totalEmployees)} variant="info" />
                  <MetricCard label="Processados" value={safeNumber(branchData.summary?.processedTimesheets)} variant="default" />
                  <MetricCard label="Aprovados" value={safeNumber(branchData.summary?.approvedTimesheets)} variant="success" />
                  <MetricCard label="Média Horas" value={`${safeNumber(branchData.summary?.averageWorkedHours).toFixed(1)}h`} variant="info" />
                  <MetricCard label="Total Extra" value={`${safeNumber(branchData.summary?.totalOvertimeHours).toFixed(1)}h`} variant="success" />
                  <MetricCard label="Total Atraso" value={formatHHMM(branchData.summary?.totalLateMinutes)} variant="warning" />
                  <MetricCard label="Total Faltas" value={formatHHMM(branchData.summary?.totalAbsenceMinutes)} variant="danger" />
                  <MetricCard label="H. Noturnas" value={formatHHMM(branchData.summary?.totalNightMinutes)} variant="purple" />
                </div>

                {branchData.timesheets && branchData.timesheets.length > 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900">Colaboradores</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Funcionário</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Cargo</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">CPF</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Trabalhadas</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Extra</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Noturno</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Atraso</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Faltas</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Saldo</th>
                            <th className="px-3 py-2.5 text-center font-semibold text-slate-500">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...branchData.timesheets]
                            .sort((a, b) => (a.employee?.name || '').localeCompare(b.employee?.name || ''))
                            .map((item, idx) => (
                              <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-b border-slate-100 hover:bg-slate-50 transition`}>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.employee?.name || '-'}</td>
                                <td className="px-3 py-2 text-slate-500">{item.employee?.position || '-'}</td>
                                <td className="px-3 py-2 font-mono text-slate-500">{item.employee?.cpf || '-'}</td>
                                <td className="px-3 py-2 text-right text-slate-900 font-mono">{formatHHMM(item.totalWorkedMinutes)}</td>
                                <td className="px-3 py-2 text-right text-emerald-600 font-mono">{formatHHMM(item.totalOvertimeMinutes)}</td>
                                <td className="px-3 py-2 text-right text-purple-600 font-mono">{formatHHMM(item.totalNightMinutes)}</td>
                                <td className="px-3 py-2 text-right text-amber-600 font-mono">{formatHHMM(item.totalLateMinutes)}</td>
                                <td className="px-3 py-2 text-right text-red-600 font-mono">{formatHHMM(item.totalAbsenceMinutes)}</td>
                                <td className={`px-3 py-2 text-right font-semibold font-mono ${safeNumber(item.totalBalanceMinutes) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {formatHHMM(item.totalBalanceMinutes)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusBadge(item.status)}`}>
                                    {STATUS_PT[item.status] || item.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          {/* Totals */}
                          <tr className="bg-slate-100 border-t-2 border-indigo-300 font-bold">
                            <td colSpan={3} className="px-3 py-3 text-right text-slate-700 uppercase text-[10px] tracking-wider">Totais</td>
                            <td className="px-3 py-3 text-right text-slate-900 font-mono">
                              {formatHHMM(branchData.timesheets.reduce((s, t) => s + safeNumber(t.totalWorkedMinutes), 0))}
                            </td>
                            <td className="px-3 py-3 text-right text-emerald-600 font-mono">
                              {formatHHMM(branchData.timesheets.reduce((s, t) => s + safeNumber(t.totalOvertimeMinutes), 0))}
                            </td>
                            <td className="px-3 py-3 text-right text-purple-600 font-mono">
                              {formatHHMM(branchData.timesheets.reduce((s, t) => s + safeNumber(t.totalNightMinutes), 0))}
                            </td>
                            <td className="px-3 py-3 text-right text-amber-600 font-mono">
                              {formatHHMM(branchData.timesheets.reduce((s, t) => s + safeNumber(t.totalLateMinutes), 0))}
                            </td>
                            <td className="px-3 py-3 text-right text-red-600 font-mono">
                              {formatHHMM(branchData.timesheets.reduce((s, t) => s + safeNumber(t.totalAbsenceMinutes), 0))}
                            </td>
                            <td className={`px-3 py-3 text-right font-mono ${branchData.timesheets.reduce((s, t) => s + safeNumber(t.totalBalanceMinutes), 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatHHMM(branchData.timesheets.reduce((s, t) => s + safeNumber(t.totalBalanceMinutes), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <NoDataState type="branch" />
                )}
              </div>
            ) : <EmptyState message="Selecione uma filial, mês e ano para gerar o relatório" />}
          </div>
        </div>
      )}

      {/* ==================== PAYROLL REPORT ==================== */}
      {activeTab === 'payroll' && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="print:hidden">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-4">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Folha de Pagamento</h2>
              <p className="text-xs text-slate-500 mb-5">Timesheets calculados, aprovados ou fechados</p>
              <form onSubmit={handlePayrollReport} className="space-y-4">
                <FormSelect label="Filial" value={payrollReport.branchId} onChange={(v) => setPayrollReport({ ...payrollReport, branchId: v })}>
                  <option value="">Selecione...</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </FormSelect>
                <div className="grid grid-cols-2 gap-3">
                  <FormSelect label="Mês" value={payrollReport.month} onChange={(v) => setPayrollReport({ ...payrollReport, month: v })}>
                    <option value="">Mês</option>
                    {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </FormSelect>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Ano</label>
                    <input type="number" value={payrollReport.year} onChange={(e) => setPayrollReport({ ...payrollReport, year: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" required />
                  </div>
                </div>
                <SubmitButton loading={payrollLoading} text="Gerar Folha" />
              </form>
            </div>
          </div>

          <div>
            {payrollLoading ? <LoadingSpinner /> : payrollData ? (
              payrollData.payrollData && payrollData.payrollData.length > 0 ? (
                <div className="space-y-5">
                  <ReportHeader
                    title={`Folha de Pagamento — ${getBranchName(payrollData.branch)}`}
                    period={`${getMonthName(payrollData.month)} / ${payrollData.year}`}
                    subtitle={getCompanyName(payrollData.branch)}
                  />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard label="Processados" value={payrollData.totalProcessed} variant="info" />
                    <MetricCard label="Total Trabalhado" value={formatHHMM(payrollData.payrollData.reduce((s, p) => s + safeNumber(p.workedMinutes), 0))} variant="default" />
                    <MetricCard label="Total Extras" value={formatHHMM(payrollData.payrollData.reduce((s, p) => s + safeNumber(p.overtimeMinutes), 0))} variant="success" />
                    <MetricCard label="Total Noturno" value={formatHHMM(payrollData.payrollData.reduce((s, p) => s + safeNumber(p.nightMinutes), 0))} variant="purple" />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900">Detalhamento por Colaborador</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Funcionário</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Cargo</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-slate-500">CPF</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Trabalhadas</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Extra</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Noturno</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Atraso</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Faltas</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-500">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...payrollData.payrollData]
                            .sort((a, b) => (a.employee?.name || '').localeCompare(b.employee?.name || ''))
                            .map((item, idx) => (
                              <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-b border-slate-100 hover:bg-slate-50 transition`}>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.employee?.name || '-'}</td>
                                <td className="px-3 py-2 text-slate-500">{item.employee?.position || '-'}</td>
                                <td className="px-3 py-2 font-mono text-slate-500">{item.employee?.cpf || '-'}</td>
                                <td className="px-3 py-2 text-right text-slate-900 font-mono">{formatHHMM(item.workedMinutes)}</td>
                                <td className="px-3 py-2 text-right text-emerald-600 font-mono">{formatHHMM(item.overtimeMinutes)}</td>
                                <td className="px-3 py-2 text-right text-purple-600 font-mono">{formatHHMM(item.nightMinutes)}</td>
                                <td className="px-3 py-2 text-right text-amber-600 font-mono">{formatHHMM(item.lateMinutes)}</td>
                                <td className="px-3 py-2 text-right text-red-600 font-mono">{formatHHMM(item.absenceMinutes)}</td>
                                <td className={`px-3 py-2 text-right font-semibold font-mono ${safeNumber(item.balanceMinutes) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {formatHHMM(item.balanceMinutes)}
                                </td>
                              </tr>
                            ))}
                          {/* Totals */}
                          <tr className="bg-slate-100 border-t-2 border-indigo-300 font-bold">
                            <td colSpan={3} className="px-3 py-3 text-right text-slate-700 uppercase text-[10px] tracking-wider">Totais</td>
                            <td className="px-3 py-3 text-right text-slate-900 font-mono">
                              {formatHHMM(payrollData.payrollData.reduce((s, p) => s + safeNumber(p.workedMinutes), 0))}
                            </td>
                            <td className="px-3 py-3 text-right text-emerald-600 font-mono">
                              {formatHHMM(payrollData.payrollData.reduce((s, p) => s + safeNumber(p.overtimeMinutes), 0))}
                            </td>
                            <td className="px-3 py-3 text-right text-purple-600 font-mono">
                              {formatHHMM(payrollData.payrollData.reduce((s, p) => s + safeNumber(p.nightMinutes), 0))}
                            </td>
                            <td className="px-3 py-3 text-right text-amber-600 font-mono">
                              {formatHHMM(payrollData.payrollData.reduce((s, p) => s + safeNumber(p.lateMinutes), 0))}
                            </td>
                            <td className="px-3 py-3 text-right text-red-600 font-mono">
                              {formatHHMM(payrollData.payrollData.reduce((s, p) => s + safeNumber(p.absenceMinutes), 0))}
                            </td>
                            <td className={`px-3 py-3 text-right font-mono ${payrollData.payrollData.reduce((s, p) => s + safeNumber(p.balanceMinutes), 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatHHMM(payrollData.payrollData.reduce((s, p) => s + safeNumber(p.balanceMinutes), 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Signature (print) */}
                  <div className="hidden print:block mt-12">
                    <div className="grid grid-cols-2 gap-16 mt-8">
                      <div className="text-center">
                        <div className="border-t border-black pt-2">
                          <p className="text-sm font-bold">Responsável RH</p>
                          <p className="text-xs text-gray-600">Recursos Humanos</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="border-t border-black pt-2">
                          <p className="text-sm font-bold">Diretor / Gerente</p>
                          <p className="text-xs text-gray-600">Aprovação</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <NoDataState type="payroll" />
              )
            ) : <EmptyState message="Selecione uma filial, mês e ano para gerar a folha de pagamento" />}
          </div>
        </div>
      )}
    </div>
  );
}
