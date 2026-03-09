'use client';

import { apiClient } from '@/lib/api';
import { useEffect, useState, useRef, useCallback } from 'react';

// ======================== INTERFACES ========================
interface Employee {
  id: string; name: string; department: string; position: string;
  cpf: string; pis: string;
  branch: { id: string; name: string } | null;
  schedule: { name: string; type: string } | null;
}

interface DayCalc {
  date: string; dayOfWeek: number; workedMinutes: number; overtimeMinutes: number;
  nightMinutes: number; lateMinutes: number; absenceMinutes: number;
  breakMinutes: number; punchCount: number; status: string; notes: string | null;
  punches: { time: string; type: string; status: string }[];
}

interface EmployeeReportData {
  employee: Employee;
  timesheet: {
    id: string; month: number; year: number; status: string;
    totalWorkedMinutes: number; totalOvertimeMinutes: number; totalNightMinutes: number;
    totalAbsenceMinutes: number; totalLateMinutes: number; totalBalanceMinutes: number;
    timesheetDays: DayCalc[];
  } | null;
  punchesByDate: Record<string, { time: string; type: string; status: string }[]>;
  expectedMonthMinutes: number;
  daysWorked: number; daysAbsent: number; daysIncomplete: number;
}

interface BranchEmployeeItem {
  employee: { id: string; name: string; cpf: string; position: string; department: string };
  totalWorkedMinutes: number; totalOvertimeMinutes: number; totalNightMinutes: number;
  totalAbsenceMinutes: number; totalLateMinutes: number; totalBalanceMinutes: number;
  status: string; hasPunches: boolean; daysWorked: number; daysAbsent: number; punchCount: number;
}

interface BranchReportData {
  branch: { id: string; name: string; company?: { name: string } } | string;
  month: number; year: number;
  summary: {
    totalEmployees: number; employeesWithPunches: number; employeesWithoutPunches: number;
    processedTimesheets: number; approvedTimesheets: number; averageWorkedHours: number;
    totalWorkedMinutes: number; totalOvertimeMinutes: number; totalLateMinutes: number;
    totalAbsenceMinutes: number; totalNightMinutes: number; totalBalanceMinutes: number;
  };
  employees: BranchEmployeeItem[];
}

interface PayrollItem {
  employee: { id: string; name: string; cpf: string; pis: string; position: string; department: string };
  workedMinutes: number; workedHours: string; expectedMinutes: number; expectedHours: string;
  overtimeMinutes: number; overtimeHours: string; nightMinutes: number; nightHours: string;
  lateMinutes: number; absenceMinutes: number; balanceMinutes: number;
  status: string; hasPunches: boolean; daysWorked: number;
}

interface PayrollReportData {
  branch: { id: string; name: string; company?: { name: string } } | string;
  month: number; year: number; totalProcessed: number; payrollData: PayrollItem[];
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

const DAY_NAMES: Record<number, string> = {
  0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb',
};

const STATUS_LABELS: Record<string, string> = {
  NORMAL: 'Normal', WEEKEND: 'DSR', HOLIDAY: 'Feriado', ABSENCE: 'Falta',
  INCOMPLETE: 'Incompleto', APPROVED: 'Aprovado', CALCULATED: 'Calculado', OPEN: 'Aberto', CLOSED: 'Fechado',
};

// ======================== HELPERS ========================
const fmtHHMM = (m: number | undefined | null): string => {
  if (m === undefined || m === null || m === 0) return '00:00';
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(Math.round(abs % 60)).padStart(2, '0')}`;
};

const fmtDate = (s: string): string => {
  try {
    const p = s?.includes('T') ? s.split('T')[0] : s;
    const d = new Date(p + 'T12:00:00');
    return isNaN(d.getTime()) ? '-' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch { return '-'; }
};

const getDayName = (s: string): string => {
  try {
    const p = s?.includes('T') ? s.split('T')[0] : s;
    const d = new Date(p + 'T12:00:00');
    return isNaN(d.getTime()) ? '' : DAY_NAMES[d.getDay()] || '';
  } catch { return ''; }
};

const getMonthName = (m: number): string => MONTHS[(m || 1) - 1]?.label || '';

const fmtPunch = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return '--:--'; }
};

const num = (n: any): number => { const v = Number(n); return isNaN(v) ? 0 : v; };

const branchName = (b: any): string => (!b ? '-' : typeof b === 'string' ? b : b.name || '-');
const companyName = (b: any): string => (!b || typeof b === 'string' ? '' : b.company?.name || '');

const pct = (v: number, total: number): string => total === 0 ? '0%' : `${Math.round((v / total) * 100)}%`;

// ======================== PDF GENERATION ========================
const generatePDF = (elementId: string, filename: string) => {
  const el = document.getElementById(elementId);
  if (!el) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${filename}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1e293b; padding: 20px; font-size: 11px; }
    h1 { font-size: 18px; margin-bottom: 4px; color: #1e293b; }
    h2 { font-size: 14px; margin-bottom: 8px; color: #334155; }
    h3 { font-size: 12px; margin-bottom: 6px; color: #475569; }
    .header { border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; }
    .header .period { color: #4f46e5; font-weight: 600; }
    .header .subtitle { color: #64748b; font-size: 12px; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
    .info-item label { display: block; font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .info-item span { font-size: 12px; font-weight: 500; }
    .metrics { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px; }
    .metric { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; text-align: center; }
    .metric label { display: block; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric .val { font-size: 16px; font-weight: 700; margin-top: 2px; }
    .metric .val.blue { color: #2563eb; } .metric .val.green { color: #059669; }
    .metric .val.red { color: #dc2626; } .metric .val.amber { color: #d97706; }
    .metric .val.purple { color: #7c3aed; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 6px 4px; text-align: left; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 9px; letter-spacing: 0.3px; }
    td { padding: 5px 4px; border-bottom: 1px solid #f1f5f9; }
    tr.weekend { background: #f8fafc; color: #94a3b8; }
    tr.absence { background: #fef2f2; }
    tr.holiday { background: #eff6ff; }
    tr.totals { background: #f1f5f9; font-weight: 700; border-top: 2px solid #4f46e5; }
    .right { text-align: right; }
    .center { text-align: center; }
    .mono { font-family: 'Courier New', monospace; }
    .green { color: #059669; } .red { color: #dc2626; } .amber { color: #d97706; } .purple { color: #7c3aed; } .blue { color: #2563eb; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
    .badge-normal { background: #f1f5f9; color: #64748b; } .badge-absence { background: #fef2f2; color: #dc2626; }
    .badge-weekend { background: #f1f5f9; color: #94a3b8; } .badge-holiday { background: #eff6ff; color: #2563eb; }
    .badge-incomplete { background: #fffbeb; color: #d97706; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; margin-top: 60px; padding-top: 20px; }
    .sig-line { border-top: 1px solid #1e293b; padding-top: 8px; text-align: center; }
    .sig-line .name { font-weight: 600; font-size: 12px; }
    .sig-line .role { color: #64748b; font-size: 10px; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 9px; }
    .no-data { color: #94a3b8; font-style: italic; }
    @media print { body { padding: 10px; } }
  </style></head><body>${el.innerHTML}
  <div class="footer">Ponto Online — Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
  </body></html>`);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 500);
};

// ======================== MAIN COMPONENT ========================
export default function ReportsPage() {
  const currentYear = new Date().getFullYear();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'employee' | 'branch' | 'payroll'>('employee');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Employee report state
  const [empForm, setEmpForm] = useState({ employeeId: '', month: '', year: currentYear.toString() });
  const [empData, setEmpData] = useState<EmployeeReportData | null>(null);
  const [empLoading, setEmpLoading] = useState(false);

  // Branch report state
  const [brForm, setBrForm] = useState({ branchId: '', month: '', year: currentYear.toString() });
  const [brData, setBrData] = useState<BranchReportData | null>(null);
  const [brLoading, setBrLoading] = useState(false);
  const [brFilter, setBrFilter] = useState<'all' | 'with' | 'without'>('all');

  // Payroll report state
  const [payForm, setPayForm] = useState({ branchId: '', month: '', year: currentYear.toString() });
  const [payData, setPayData] = useState<PayrollReportData | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const toast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message: msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, brRes] = await Promise.all([
        apiClient.get('/employees', { params: { take: 999 } }),
        apiClient.get('/branches', { params: { take: 999 } }),
      ]);
      setEmployees(empRes.data.data || []);
      setBranches(brRes.data.data || []);
    } catch { toast('Erro ao carregar dados', 'error'); }
    finally { setLoading(false); }
  };

  const handleEmpReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.employeeId || !empForm.month || !empForm.year) { toast('Preencha todos os campos', 'error'); return; }
    try {
      setEmpLoading(true);
      const r = await apiClient.get(`/reports/employee/${empForm.employeeId}/${empForm.month}/${empForm.year}`);
      setEmpData(r.data);
      toast('Espelho gerado com sucesso', 'success');
    } catch { toast('Erro ao gerar relatório', 'error'); }
    finally { setEmpLoading(false); }
  };

  const handleBrReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brForm.branchId || !brForm.month || !brForm.year) { toast('Preencha todos os campos', 'error'); return; }
    try {
      setBrLoading(true);
      const r = await apiClient.get(`/reports/branch/${brForm.branchId}/${brForm.month}/${brForm.year}`);
      setBrData(r.data);
      toast('Relatório gerado com sucesso', 'success');
    } catch { toast('Erro ao gerar relatório', 'error'); }
    finally { setBrLoading(false); }
  };

  const handlePayReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.branchId || !payForm.month || !payForm.year) { toast('Preencha todos os campos', 'error'); return; }
    try {
      setPayLoading(true);
      const r = await apiClient.get(`/reports/payroll/${payForm.branchId}/${payForm.month}/${payForm.year}`);
      setPayData(r.data);
      toast('Folha gerada com sucesso', 'success');
    } catch { toast('Erro ao gerar relatório', 'error'); }
    finally { setPayLoading(false); }
  };

  // ======================== SHARED UI COMPONENTS ========================
  const Metric = ({ label, value, color = '' }: { label: string; value: string | number; color?: string }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color || 'text-slate-900'}`}>{value}</p>
    </div>
  );

  const Spinner = () => (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      <p className="text-slate-400 text-sm">Calculando dados reais...</p>
    </div>
  );

  const Empty = ({ msg }: { msg: string }) => (
    <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
      <svg className="w-16 h-16 text-slate-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-slate-400 text-center max-w-sm">{msg}</p>
    </div>
  );

  const FormField = ({ label, value, onChange, children }: {
    label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
  }) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} required
        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
        {children}
      </select>
    </div>
  );

  const SubmitBtn = ({ loading: l, text }: { loading: boolean; text: string }) => (
    <button type="submit" disabled={l}
      className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold text-sm transition flex items-center justify-center gap-2">
      {l ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Gerando...</> : text}
    </button>
  );

  const PDFBtn = ({ onClick, label = 'Exportar PDF' }: { onClick: () => void; label?: string }) => (
    <button onClick={onClick}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-sm">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {label}
    </button>
  );

  const PrintBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}
      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-sm">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Imprimir
    </button>
  );

  const CSVBtn = ({ onClick, label = 'Exportar CSV' }: { onClick: () => void; label?: string }) => (
    <button onClick={onClick}
      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-sm">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </button>
  );

  const downloadCSV = (filename: string, header: string[], rows: (string | number)[]) => {
    const csv = [header, ...rows].map(r => Array.isArray(r) ? r.map(c => `"${c}"`).join(',') : `"${r}"`).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPayrollCSV = () => {
    if (!payData) return;
    const monthName = getMonthName(payData.month);
    const branch = branchName(payData.branch);
    const header = ['Nome', 'CPF', 'PIS', 'Cargo', 'Setor', 'Dias Trabalhados', 'H. Trabalhadas', 'H. Previstas', 'H. Extras', 'H. Noturnas', 'Atrasos', 'Faltas', 'Saldo', 'Status'];
    const rows = payData.payrollData.map(p => [
      p.employee.name, p.employee.cpf, p.employee.pis || '',
      p.employee.position || '', p.employee.department || '',
      p.daysWorked, p.workedHours, p.expectedHours, p.overtimeHours,
      p.nightHours, fmtHHMM(p.lateMinutes), fmtHHMM(p.absenceMinutes),
      fmtHHMM(p.balanceMinutes), p.status,
    ]);
    downloadCSV(`folha_pagamento_${branch.replace(/\s+/g,'-')}_${monthName}_${payData.year}.csv`, header, rows as any);
  };

  const exportBranchCSV = () => {
    if (!brData) return;
    const monthName = getMonthName(brData.month);
    const branch = branchName(brData.branch);
    const header = ['Nome', 'CPF', 'Cargo', 'Setor', 'H. Trabalhadas', 'H. Extras', 'H. Noturnas', 'Atrasos', 'Faltas', 'Saldo', 'Dias Trabalhados', 'Com Ponto', 'Status'];
    const rows = brData.employees.map(e => [
      e.employee.name, e.employee.cpf, e.employee.position || '', e.employee.department || '',
      fmtHHMM(e.totalWorkedMinutes), fmtHHMM(e.totalOvertimeMinutes), fmtHHMM(e.totalNightMinutes),
      fmtHHMM(e.totalLateMinutes), fmtHHMM(e.totalAbsenceMinutes), fmtHHMM(e.totalBalanceMinutes),
      e.daysWorked, e.hasPunches ? 'Sim' : 'Nao', e.status,
    ]);
    downloadCSV(`relatorio_filial_${branch.replace(/\s+/g,'-')}_${monthName}_${brData.year}.csv`, header, rows as any);
  };

  const dayRowClass = (status: string, idx: number): string => {
    switch (status) {
      case 'WEEKEND': return 'bg-slate-50/70 text-slate-400';
      case 'HOLIDAY': return 'bg-blue-50/50';
      case 'ABSENCE': return 'bg-red-50/40';
      case 'INCOMPLETE': return 'bg-amber-50/40';
      default: return idx % 2 === 0 ? '' : 'bg-slate-50/30';
    }
  };

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      NORMAL: 'bg-slate-100 text-slate-500', WEEKEND: 'bg-slate-100 text-slate-400',
      HOLIDAY: 'bg-blue-100 text-blue-700', ABSENCE: 'bg-red-100 text-red-600',
      INCOMPLETE: 'bg-amber-100 text-amber-700', APPROVED: 'bg-emerald-100 text-emerald-700',
      CALCULATED: 'bg-blue-100 text-blue-700', OPEN: 'bg-slate-100 text-slate-500', CLOSED: 'bg-slate-200 text-slate-600',
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${classes[status] || 'bg-slate-100 text-slate-500'}`}>
        {STATUS_LABELS[status] || status}
      </span>
    );
  };

  const getPunches = (dateStr: string, punchesByDate?: Record<string, any[]>) => {
    const empty = { entry: '-', breakStart: '-', breakEnd: '-', exit: '-' };
    if (!punchesByDate) return empty;
    const key = dateStr?.split('T')[0] || '';
    const punches = punchesByDate[key];
    if (!punches?.length) return empty;
    const entry = punches.find((p: any) => p.type === 'ENTRY');
    const bs = punches.find((p: any) => p.type === 'BREAK_START');
    const be = punches.find((p: any) => p.type === 'BREAK_END');
    const exit = [...punches].reverse().find((p: any) => p.type === 'EXIT');
    return {
      entry: entry ? fmtPunch(entry.time) : '-',
      breakStart: bs ? fmtPunch(bs.time) : '-',
      breakEnd: be ? fmtPunch(be.time) : '-',
      exit: exit ? fmtPunch(exit.time) : '-',
    };
  };

  // ======================== RENDER ========================
  return (
    <div className="space-y-6">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            t.type === 'success' ? 'bg-emerald-500 text-white' : t.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
          }`}>{t.message}</div>
        ))}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-slate-400 mt-1 text-sm">Espelho de ponto, relatório da filial e folha de pagamento — dados calculados a partir das batidas reais</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm inline-flex">
        {[
          { id: 'employee', icon: '👤', label: 'Espelho de Ponto' },
          { id: 'branch', icon: '🏢', label: 'Relatório da Filial' },
          { id: 'payroll', icon: '💰', label: 'Folha de Pagamento' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
              activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== ESPELHO DE PONTO ==================== */}
      {activeTab === 'employee' && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-4">
              <h2 className="text-base font-bold text-slate-900 mb-0.5">Espelho de Ponto</h2>
              <p className="text-xs text-slate-400 mb-5">Relatório individual calculado a partir das batidas reais do colaborador</p>
              <form onSubmit={handleEmpReport} className="space-y-3">
                <FormField label="Colaborador" value={empForm.employeeId} onChange={v => setEmpForm({ ...empForm, employeeId: v })}>
                  <option value="">Selecione...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Mês" value={empForm.month} onChange={v => setEmpForm({ ...empForm, month: v })}>
                    <option value="">Mês</option>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </FormField>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Ano</label>
                    <input type="number" value={empForm.year} onChange={e => setEmpForm({ ...empForm, year: e.target.value })} required
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition" />
                  </div>
                </div>
                <SubmitBtn loading={empLoading} text="Gerar Espelho" />
              </form>
            </div>
          </div>

          <div>
            {empLoading ? <Spinner /> : empData?.timesheet ? (
              <div className="space-y-4">
                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Espelho de Ponto Individual</h2>
                    <p className="text-sm text-indigo-600 font-semibold">{getMonthName(empData.timesheet.month)} / {empData.timesheet.year}</p>
                  </div>
                  <div className="flex gap-2">
                    <PDFBtn onClick={() => generatePDF('emp-report-pdf', `espelho_${empData.employee?.name?.replace(/\s/g, '_')}`)} />
                    <PrintBtn onClick={() => window.print()} />
                  </div>
                </div>

                {/* PDF Content */}
                <div id="emp-report-pdf">
                  <div className="header" style={{ display: 'none' }}>
                    <h1>Espelho de Ponto Individual</h1>
                    <p className="subtitle">{empData.employee?.branch?.name || ''}</p>
                    <p className="period">Período: {getMonthName(empData.timesheet.month)} / {empData.timesheet.year}</p>
                  </div>

                  {/* Employee Info */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { l: 'Nome', v: empData.employee?.name },
                        { l: 'Cargo', v: empData.employee?.position },
                        { l: 'Departamento', v: empData.employee?.department },
                        { l: 'Escala', v: empData.employee?.schedule?.name },
                        { l: 'CPF', v: empData.employee?.cpf, mono: true },
                        { l: 'PIS', v: empData.employee?.pis, mono: true },
                        { l: 'Filial', v: empData.employee?.branch?.name },
                        { l: 'Status', v: empData.timesheet.status, badge: true },
                      ].map((item, i) => (
                        <div key={i}>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">{item.l}</p>
                          {item.badge ? statusBadge(item.v || '') : (
                            <p className={`text-sm font-medium text-slate-900 mt-0.5 ${item.mono ? 'font-mono' : ''}`}>{item.v || '-'}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 mt-4">
                    <Metric label="Previsto" value={fmtHHMM(empData.expectedMonthMinutes)} color="text-slate-600" />
                    <Metric label="Trabalhado" value={fmtHHMM(empData.timesheet.totalWorkedMinutes)} color="text-blue-600" />
                    <Metric label="Horas Extra" value={fmtHHMM(empData.timesheet.totalOvertimeMinutes)} color="text-emerald-600" />
                    <Metric label="Atraso" value={fmtHHMM(empData.timesheet.totalLateMinutes)} color={num(empData.timesheet.totalLateMinutes) > 0 ? 'text-amber-600' : 'text-slate-400'} />
                    <Metric label="Faltas" value={fmtHHMM(empData.timesheet.totalAbsenceMinutes)} color={num(empData.timesheet.totalAbsenceMinutes) > 0 ? 'text-red-600' : 'text-slate-400'} />
                    <Metric label="Saldo" value={fmtHHMM(empData.timesheet.totalBalanceMinutes)} color={num(empData.timesheet.totalBalanceMinutes) >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                    <Metric label="Dias Trab." value={empData.daysWorked} color="text-blue-600" />
                    <Metric label="Dias Falta" value={empData.daysAbsent} color={empData.daysAbsent > 0 ? 'text-red-600' : 'text-slate-400'} />
                  </div>

                  {/* Daily Detail */}
                  {empData.timesheet.timesheetDays?.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Detalhamento Diário</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Data', 'Dia', 'Entrada', 'Saída Int.', 'Retorno', 'Saída', 'Trabalhado', 'Extra', 'Atraso', 'Falta', 'Status'].map(h => (
                                <th key={h} className={`px-2 py-2 font-bold text-slate-500 ${['Trabalhado','Extra','Atraso','Falta'].includes(h) ? 'text-right' : ['Entrada','Saída Int.','Retorno','Saída','Status'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {empData.timesheet.timesheetDays.map((day, idx) => {
                              const p = getPunches(day.date, empData.punchesByDate);
                              return (
                                <tr key={idx} className={`${dayRowClass(day.status, idx)} border-b border-slate-50 hover:bg-indigo-50/30 transition`}>
                                  <td className="px-2 py-1.5 font-mono text-slate-700 font-medium">{fmtDate(day.date)}</td>
                                  <td className={`px-2 py-1.5 ${getDayName(day.date) === 'Dom' ? 'text-red-400 font-bold' : getDayName(day.date) === 'Sáb' ? 'text-amber-500' : 'text-slate-500'}`}>{getDayName(day.date)}</td>
                                  <td className="px-2 py-1.5 text-center font-mono text-emerald-700 font-medium">{p.entry}</td>
                                  <td className="px-2 py-1.5 text-center font-mono text-amber-600">{p.breakStart}</td>
                                  <td className="px-2 py-1.5 text-center font-mono text-blue-600">{p.breakEnd}</td>
                                  <td className="px-2 py-1.5 text-center font-mono text-red-600 font-medium">{p.exit}</td>
                                  <td className="px-2 py-1.5 text-right font-mono font-medium text-slate-900">{day.workedMinutes > 0 ? fmtHHMM(day.workedMinutes) : <span className="text-slate-300">-</span>}</td>
                                  <td className="px-2 py-1.5 text-right font-mono text-emerald-600">{num(day.overtimeMinutes) > 0 ? fmtHHMM(day.overtimeMinutes) : <span className="text-slate-200">-</span>}</td>
                                  <td className="px-2 py-1.5 text-right font-mono text-amber-600">{num(day.lateMinutes) > 0 ? fmtHHMM(day.lateMinutes) : <span className="text-slate-200">-</span>}</td>
                                  <td className="px-2 py-1.5 text-right font-mono text-red-600">{num(day.absenceMinutes) > 0 ? fmtHHMM(day.absenceMinutes) : <span className="text-slate-200">-</span>}</td>
                                  <td className="px-2 py-1.5 text-center">{statusBadge(day.status)}</td>
                                </tr>
                              );
                            })}
                            <tr className="bg-slate-100 border-t-2 border-indigo-400 font-bold">
                              <td colSpan={6} className="px-2 py-2.5 text-right text-[10px] text-slate-500 uppercase tracking-wider">Totais do Mês</td>
                              <td className="px-2 py-2.5 text-right font-mono text-slate-900">{fmtHHMM(empData.timesheet.totalWorkedMinutes)}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-emerald-600">{fmtHHMM(empData.timesheet.totalOvertimeMinutes)}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-amber-600">{fmtHHMM(empData.timesheet.totalLateMinutes)}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-red-600">{fmtHHMM(empData.timesheet.totalAbsenceMinutes)}</td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Signatures (hidden, shown in PDF) */}
                  <div className="signatures" style={{ display: 'none' }}>
                    <div className="sig-line">
                      <p className="name">{empData.employee?.name || ''}</p>
                      <p className="role">Colaborador</p>
                    </div>
                    <div className="sig-line">
                      <p className="name">Responsável</p>
                      <p className="role">Recursos Humanos</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : <Empty msg="Selecione um colaborador, mês e ano para gerar o espelho de ponto com dados calculados a partir das batidas reais" />}
          </div>
        </div>
      )}

      {/* ==================== RELATÓRIO DA FILIAL ==================== */}
      {activeTab === 'branch' && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-4">
              <h2 className="text-base font-bold text-slate-900 mb-0.5">Relatório da Filial</h2>
              <p className="text-xs text-slate-400 mb-5">Resumo geral com dados recalculados de cada colaborador</p>
              <form onSubmit={handleBrReport} className="space-y-3">
                <FormField label="Filial" value={brForm.branchId} onChange={v => setBrForm({ ...brForm, branchId: v })}>
                  <option value="">Selecione...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Mês" value={brForm.month} onChange={v => setBrForm({ ...brForm, month: v })}>
                    <option value="">Mês</option>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </FormField>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Ano</label>
                    <input type="number" value={brForm.year} onChange={e => setBrForm({ ...brForm, year: e.target.value })} required
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition" />
                  </div>
                </div>
                <SubmitBtn loading={brLoading} text="Gerar Relatório" />
              </form>
            </div>
          </div>

          <div>
            {brLoading ? <Spinner /> : brData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Relatório da Filial — {branchName(brData.branch)}</h2>
                    <p className="text-sm text-indigo-600 font-semibold">{getMonthName(brData.month)} / {brData.year}</p>
                    {companyName(brData.branch) && <p className="text-xs text-slate-400">{companyName(brData.branch)}</p>}
                  </div>
                  <div className="flex gap-2">
                    <CSVBtn onClick={exportBranchCSV} label="Exportar CSV" />
                    <PDFBtn onClick={() => generatePDF('branch-report-pdf', `relatorio_filial_${getMonthName(brData.month)}_${brData.year}`)} />
                    <PrintBtn onClick={() => window.print()} />
                  </div>
                </div>

                <div id="branch-report-pdf">
                  <div className="header" style={{ display: 'none' }}>
                    <h1>Relatório da Filial — {branchName(brData.branch)}</h1>
                    <p className="subtitle">{companyName(brData.branch)}</p>
                    <p className="period">Período: {getMonthName(brData.month)} / {brData.year}</p>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2">
                    <Metric label="Total Colaboradores" value={num(brData.summary?.totalEmployees)} />
                    <Metric label="Com Batidas" value={num(brData.summary?.employeesWithPunches)} color="text-emerald-600" />
                    <Metric label="Sem Batidas" value={num(brData.summary?.employeesWithoutPunches)} color={num(brData.summary?.employeesWithoutPunches) > 0 ? 'text-red-600' : 'text-slate-400'} />
                    <Metric label="Média Horas" value={`${num(brData.summary?.averageWorkedHours).toFixed(1)}h`} color="text-blue-600" />
                    <Metric label="Total H. Extra" value={fmtHHMM(brData.summary?.totalOvertimeMinutes)} color="text-emerald-600" />
                    <Metric label="Total Trabalhado" value={fmtHHMM(brData.summary?.totalWorkedMinutes)} color="text-blue-600" />
                    <Metric label="Total Atraso" value={fmtHHMM(brData.summary?.totalLateMinutes)} color={num(brData.summary?.totalLateMinutes) > 0 ? 'text-amber-600' : 'text-slate-400'} />
                    <Metric label="Total Faltas" value={fmtHHMM(brData.summary?.totalAbsenceMinutes)} color={num(brData.summary?.totalAbsenceMinutes) > 0 ? 'text-red-600' : 'text-slate-400'} />
                    <Metric label="H. Noturnas" value={fmtHHMM(brData.summary?.totalNightMinutes)} color="text-purple-600" />
                    <Metric label="Saldo Geral" value={fmtHHMM(brData.summary?.totalBalanceMinutes)} color={num(brData.summary?.totalBalanceMinutes) >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                  </div>

                  {/* Filter tabs */}
                  <div className="flex gap-1 mt-4 mb-2">
                    {[
                      { id: 'all', label: `Todos (${brData.employees?.length || 0})` },
                      { id: 'with', label: `Com Batidas (${brData.employees?.filter(e => e.hasPunches).length || 0})` },
                      { id: 'without', label: `Sem Batidas (${brData.employees?.filter(e => !e.hasPunches).length || 0})` },
                    ].map(f => (
                      <button key={f.id} onClick={() => setBrFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          brFilter === f.id ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-50'
                        }`}>{f.label}</button>
                    ))}
                  </div>

                  {/* Table */}
                  {brData.employees?.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Colaborador', 'Cargo', 'Dias', 'Batidas', 'Trabalhado', 'Extra', 'Atraso', 'Faltas', 'Saldo', 'Status'].map(h => (
                                <th key={h} className={`px-2 py-2 font-bold text-slate-500 ${['Dias','Batidas','Trabalhado','Extra','Atraso','Faltas','Saldo'].includes(h) ? 'text-right' : h === 'Status' ? 'text-center' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {brData.employees
                              .filter(e => brFilter === 'all' ? true : brFilter === 'with' ? e.hasPunches : !e.hasPunches)
                              .map((item, idx) => (
                                <tr key={idx} className={`${idx % 2 === 0 ? '' : 'bg-slate-50/30'} ${!item.hasPunches ? 'opacity-50' : ''} border-b border-slate-50 hover:bg-indigo-50/30 transition`}>
                                  <td className="px-2 py-1.5 font-medium text-slate-900 max-w-[200px] truncate">{item.employee?.name || '-'}</td>
                                  <td className="px-2 py-1.5 text-slate-400">{item.employee?.position || '-'}</td>
                                  <td className="px-2 py-1.5 text-right font-mono text-slate-600">{item.daysWorked}</td>
                                  <td className="px-2 py-1.5 text-right font-mono text-slate-500">{item.punchCount}</td>
                                  <td className="px-2 py-1.5 text-right font-mono font-medium text-slate-900">{fmtHHMM(item.totalWorkedMinutes)}</td>
                                  <td className="px-2 py-1.5 text-right font-mono text-emerald-600">{num(item.totalOvertimeMinutes) > 0 ? fmtHHMM(item.totalOvertimeMinutes) : '-'}</td>
                                  <td className="px-2 py-1.5 text-right font-mono text-amber-600">{num(item.totalLateMinutes) > 0 ? fmtHHMM(item.totalLateMinutes) : '-'}</td>
                                  <td className="px-2 py-1.5 text-right font-mono text-red-600">{num(item.totalAbsenceMinutes) > 0 ? fmtHHMM(item.totalAbsenceMinutes) : '-'}</td>
                                  <td className={`px-2 py-1.5 text-right font-bold font-mono ${num(item.totalBalanceMinutes) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtHHMM(item.totalBalanceMinutes)}</td>
                                  <td className="px-2 py-1.5 text-center">{statusBadge(item.status)}</td>
                                </tr>
                              ))}
                            <tr className="bg-slate-100 border-t-2 border-indigo-400 font-bold">
                              <td colSpan={2} className="px-2 py-2.5 text-right text-[10px] text-slate-500 uppercase tracking-wider">Totais</td>
                              <td className="px-2 py-2.5 text-right font-mono text-slate-700">{brData.employees.filter(e => brFilter === 'all' ? true : brFilter === 'with' ? e.hasPunches : !e.hasPunches).reduce((s, e) => s + (e.daysWorked || 0), 0)}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-slate-500">{brData.employees.filter(e => brFilter === 'all' ? true : brFilter === 'with' ? e.hasPunches : !e.hasPunches).reduce((s, e) => s + (e.punchCount || 0), 0)}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-slate-900">{fmtHHMM(brData.employees.filter(e => brFilter === 'all' ? true : brFilter === 'with' ? e.hasPunches : !e.hasPunches).reduce((s, e) => s + num(e.totalWorkedMinutes), 0))}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-emerald-600">{fmtHHMM(brData.employees.filter(e => brFilter === 'all' ? true : brFilter === 'with' ? e.hasPunches : !e.hasPunches).reduce((s, e) => s + num(e.totalOvertimeMinutes), 0))}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-amber-600">{fmtHHMM(brData.employees.filter(e => brFilter === 'all' ? true : brFilter === 'with' ? e.hasPunches : !e.hasPunches).reduce((s, e) => s + num(e.totalLateMinutes), 0))}</td>
                              <td className="px-2 py-2.5 text-right font-mono text-red-600">{fmtHHMM(brData.employees.filter(e => brFilter === 'all' ? true : brFilter === 'with' ? e.hasPunches : !e.hasPunches).reduce((s, e) => s + num(e.totalAbsenceMinutes), 0))}</td>
                              <td className="px-2 py-2.5 text-right font-mono">{fmtHHMM(brData.employees.filter(e => brFilter === 'all' ? true : brFilter === 'with' ? e.hasPunches : !e.hasPunches).reduce((s, e) => s + num(e.totalBalanceMinutes), 0))}</td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : <Empty msg="Selecione uma filial, mês e ano para gerar o relatório com dados recalculados" />}
          </div>
        </div>
      )}

      {/* ==================== FOLHA DE PAGAMENTO ==================== */}
      {activeTab === 'payroll' && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-4">
              <h2 className="text-base font-bold text-slate-900 mb-0.5">Folha de Pagamento</h2>
              <p className="text-xs text-slate-400 mb-5">Dados de todos os colaboradores ativos, calculados das batidas reais</p>
              <form onSubmit={handlePayReport} className="space-y-3">
                <FormField label="Filial" value={payForm.branchId} onChange={v => setPayForm({ ...payForm, branchId: v })}>
                  <option value="">Selecione...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Mês" value={payForm.month} onChange={v => setPayForm({ ...payForm, month: v })}>
                    <option value="">Mês</option>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </FormField>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Ano</label>
                    <input type="number" value={payForm.year} onChange={e => setPayForm({ ...payForm, year: e.target.value })} required
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition" />
                  </div>
                </div>
                <SubmitBtn loading={payLoading} text="Gerar Folha" />
              </form>
            </div>
          </div>

          <div>
            {payLoading ? <Spinner /> : payData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Folha de Pagamento — {branchName(payData.branch)}</h2>
                    <p className="text-sm text-indigo-600 font-semibold">{getMonthName(payData.month)} / {payData.year}</p>
                  </div>
                  <div className="flex gap-2">
                    <CSVBtn onClick={exportPayrollCSV} label="Exportar CSV" />
                    <PDFBtn onClick={() => generatePDF('payroll-report-pdf', `folha_pagamento_${getMonthName(payData.month)}_${payData.year}`)} />
                    <PrintBtn onClick={() => window.print()} />
                  </div>
                </div>

                <div id="payroll-report-pdf">
                  <div className="header" style={{ display: 'none' }}>
                    <h1>Folha de Pagamento — {branchName(payData.branch)}</h1>
                    <p className="subtitle">{companyName(payData.branch)}</p>
                    <p className="period">Período: {getMonthName(payData.month)} / {payData.year}</p>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
                    <Metric label="Colaboradores" value={payData.totalProcessed} />
                    <Metric label="Total Trabalhado" value={fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.workedMinutes), 0))} color="text-blue-600" />
                    <Metric label="Total Previsto" value={fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.expectedMinutes), 0))} color="text-slate-600" />
                    <Metric label="Total Extras" value={fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.overtimeMinutes), 0))} color="text-emerald-600" />
                    <Metric label="Total Faltas" value={fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.absenceMinutes), 0))} color="text-red-600" />
                    <Metric label="Saldo Geral" value={fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.balanceMinutes), 0))} color={payData.payrollData.reduce((s, p) => s + num(p.balanceMinutes), 0) >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                  </div>

                  {/* Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {['Colaborador', 'Cargo', 'CPF', 'Dias', 'Previsto', 'Trabalhado', 'Extra', 'Noturno', 'Atraso', 'Faltas', 'Saldo'].map(h => (
                              <th key={h} className={`px-2 py-2 font-bold text-slate-500 ${['Dias','Previsto','Trabalhado','Extra','Noturno','Atraso','Faltas','Saldo'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...payData.payrollData]
                            .sort((a, b) => (a.employee?.name || '').localeCompare(b.employee?.name || ''))
                            .map((item, idx) => (
                              <tr key={idx} className={`${idx % 2 === 0 ? '' : 'bg-slate-50/30'} ${!item.hasPunches ? 'opacity-50' : ''} border-b border-slate-50 hover:bg-indigo-50/30 transition`}>
                                <td className="px-2 py-1.5 font-medium text-slate-900 max-w-[180px] truncate">{item.employee?.name || '-'}</td>
                                <td className="px-2 py-1.5 text-slate-400 max-w-[120px] truncate">{item.employee?.position || '-'}</td>
                                <td className="px-2 py-1.5 font-mono text-slate-400 text-[10px]">{item.employee?.cpf || '-'}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-slate-600">{item.daysWorked}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-slate-500">{fmtHHMM(item.expectedMinutes)}</td>
                                <td className="px-2 py-1.5 text-right font-mono font-medium text-slate-900">{fmtHHMM(item.workedMinutes)}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-emerald-600">{num(item.overtimeMinutes) > 0 ? fmtHHMM(item.overtimeMinutes) : '-'}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-purple-600">{num(item.nightMinutes) > 0 ? fmtHHMM(item.nightMinutes) : '-'}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-amber-600">{num(item.lateMinutes) > 0 ? fmtHHMM(item.lateMinutes) : '-'}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-red-600">{num(item.absenceMinutes) > 0 ? fmtHHMM(item.absenceMinutes) : '-'}</td>
                                <td className={`px-2 py-1.5 text-right font-bold font-mono ${num(item.balanceMinutes) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtHHMM(item.balanceMinutes)}</td>
                              </tr>
                            ))}
                          <tr className="bg-slate-100 border-t-2 border-indigo-400 font-bold">
                            <td colSpan={3} className="px-2 py-2.5 text-right text-[10px] text-slate-500 uppercase tracking-wider">Totais</td>
                            <td className="px-2 py-2.5 text-right font-mono text-slate-700">{payData.payrollData.reduce((s, p) => s + (p.daysWorked || 0), 0)}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-slate-500">{fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.expectedMinutes), 0))}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-slate-900">{fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.workedMinutes), 0))}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-emerald-600">{fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.overtimeMinutes), 0))}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-purple-600">{fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.nightMinutes), 0))}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-amber-600">{fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.lateMinutes), 0))}</td>
                            <td className="px-2 py-2.5 text-right font-mono text-red-600">{fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.absenceMinutes), 0))}</td>
                            <td className={`px-2 py-2.5 text-right font-mono ${payData.payrollData.reduce((s, p) => s + num(p.balanceMinutes), 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {fmtHHMM(payData.payrollData.reduce((s, p) => s + num(p.balanceMinutes), 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="signatures" style={{ display: 'none' }}>
                    <div className="sig-line"><p className="name">Responsável RH</p><p className="role">Recursos Humanos</p></div>
                    <div className="sig-line"><p className="name">Diretor</p><p className="role">Aprovação</p></div>
                  </div>
                </div>
              </div>
            ) : <Empty msg="Selecione uma filial, mês e ano para gerar a folha de pagamento com dados recalculados" />}
          </div>
        </div>
      )}
    </div>
  );
}
