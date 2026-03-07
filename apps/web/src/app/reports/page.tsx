'use client';

import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

// Interfaces
interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  cpf: string;
  pis: string;
  branch: {
    id: string;
    name: string;
  };
  schedule: {
    name: string;
    type: string;
  };
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
  status: 'NORMAL' | 'WEEKEND' | 'HOLIDAY' | 'ABSENCE' | 'INCOMPLETE';
  notes: string | null;
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
  };
  recentPunches: Array<{
    punchTime: string;
    punchType: string;
    status: string;
  }>;
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
  employee: {
    id: string;
    name: string;
    cpf: string;
  };
}

interface BranchReportData {
  branch: string;
  month: number;
  year: number;
  summary: {
    totalEmployees: number;
    processedTimesheets: number;
    approvedTimesheets: number;
    averageWorkedHours: number;
    totalOvertimeHours: number;
  };
  timesheets: BranchTimesheetItem[];
}

interface PayrollItem {
  employee: {
    id: string;
    name: string;
    cpf: string;
    pis: string;
    position: string;
    department: string;
  };
  workedMinutes: number;
  workedHours: string;
  overtimeMinutes: number;
  overtimeHours: string;
  nightMinutes: number;
  nightHours: string;
  lateMinutes: number;
  absenceMinutes: number;
}

interface PayrollReportData {
  branch: string;
  month: number;
  year: number;
  totalProcessed: number;
  payrollData: PayrollItem[];
}

interface Branch {
  id: string;
  name: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const formatMinutesToHours = (minutes: number): string => {
  const hours = minutes / 60;
  return hours.toFixed(1);
};

const formatBrazilianDate = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const getDayName = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  return DAY_NAMES[date.getDay()];
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'NORMAL':
      return 'bg-slate-700';
    case 'WEEKEND':
      return 'bg-gray-700';
    case 'HOLIDAY':
      return 'bg-blue-900';
    case 'ABSENCE':
      return 'bg-red-900';
    case 'INCOMPLETE':
      return 'bg-yellow-900';
    default:
      return 'bg-slate-700';
  }
};

const getStatusBadgeColor = (status: string): string => {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-500 text-white';
    case 'PENDING':
      return 'bg-yellow-500 text-white';
    case 'REJECTED':
      return 'bg-red-500 text-white';
    default:
      return 'bg-slate-500 text-white';
  }
};

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();

  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'employee' | 'branch' | 'payroll'>('employee');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Employee report state
  const [employeeReport, setEmployeeReport] = useState({ employeeId: '', month: '', year: currentYear.toString() });
  const [employeeData, setEmployeeData] = useState<EmployeeReportData | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  // Branch report state
  const [branchReport, setBranchReport] = useState({ branchId: '', month: '', year: currentYear.toString() });
  const [branchData, setBranchData] = useState<BranchReportData | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);

  // Payroll report state
  const [payrollReport, setPayrollReport] = useState({ branchId: '', month: '', year: currentYear.toString() });
  const [payrollData, setPayrollData] = useState<PayrollReportData | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  useEffect(() => {
    fetchEmployeesAndBranches();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const fetchEmployeesAndBranches = async () => {
    try {
      setLoading(true);
      const [empRes, branchRes] = await Promise.all([
        apiClient.get('/employees', { params: { take: 999 } }),
        apiClient.get('/branches', { params: { take: 999 } }),
      ]);
      setEmployees(empRes.data.data || []);
      setBranches(branchRes.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados', error);
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeReport.employeeId || !employeeReport.month || !employeeReport.year) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    try {
      setEmployeeLoading(true);
      const response = await apiClient.get(
        `/reports/employee/${employeeReport.employeeId}/${employeeReport.month}/${employeeReport.year}`
      );
      setEmployeeData(response.data);
      showToast('Relatório gerado com sucesso', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao gerar relatório', 'error');
    } finally {
      setEmployeeLoading(false);
    }
  };

  const handleBranchReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchReport.branchId || !branchReport.month || !branchReport.year) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    try {
      setBranchLoading(true);
      const response = await apiClient.get(
        `/reports/branch/${branchReport.branchId}/${branchReport.month}/${branchReport.year}`
      );
      setBranchData(response.data);
      showToast('Relatório gerado com sucesso', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao gerar relatório', 'error');
    } finally {
      setBranchLoading(false);
    }
  };

  const handlePayrollReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payrollReport.branchId || !payrollReport.month || !payrollReport.year) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    try {
      setPayrollLoading(true);
      const response = await apiClient.get(
        `/reports/payroll/${payrollReport.branchId}/${payrollReport.month}/${payrollReport.year}`
      );
      setPayrollData(response.data);
      showToast('Relatório gerado com sucesso', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao gerar relatório', 'error');
    } finally {
      setPayrollLoading(false);
    }
  };

  const MetricCard = ({
    label,
    value,
    color = 'slate',
  }: {
    label: string;
    value: string | number;
    color?: 'green' | 'red' | 'blue' | 'slate' | 'indigo';
  }) => {
    const colorClasses = {
      green: 'bg-green-500 bg-opacity-20 border-green-400 text-green-300',
      red: 'bg-red-500 bg-opacity-20 border-red-400 text-red-300',
      blue: 'bg-blue-500 bg-opacity-20 border-blue-400 text-blue-300',
      indigo: 'bg-indigo-500 bg-opacity-20 border-indigo-400 text-indigo-300',
      slate: 'bg-slate-600 bg-opacity-30 border-slate-400 text-slate-200',
    };

    return (
      <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
        <p className="text-xs font-medium opacity-75 uppercase tracking-wide">{label}</p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </div>
    );
  };

  const LoadingSpinner = () => (
    <div className="flex justify-center py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-indigo-500"></div>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12">
      <p className="text-slate-400">{message}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-50 space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-2 ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : toast.type === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-blue-500 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Relatórios</h1>
        <p className="mt-2 text-slate-400">Acompanhe e analise dados de ponto, filial e folha de pagamento</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 flex gap-2 rounded-lg bg-slate-800 p-1">
        {[
          { id: 'employee', label: 'Espelho de Ponto', icon: '👤' },
          { id: 'branch', label: 'Relatório da Filial', icon: '🏢' },
          { id: 'payroll', label: 'Folha de Pagamento', icon: '💰' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'employee' | 'branch' | 'payroll')}
            className={`flex-1 px-6 py-3 rounded-md font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-xl bg-slate-800 shadow-2xl border border-slate-700 overflow-hidden">
        {/* Employee Report Tab */}
        {activeTab === 'employee' && (
          <div className="p-8">
            <div className="grid gap-8 lg:grid-cols-5">
              {/* Form */}
              <div className="lg:col-span-2">
                <h2 className="mb-6 text-2xl font-bold text-white">Espelho de Ponto</h2>
                <p className="mb-6 text-sm text-slate-400">
                  Consulte as horas trabalhadas, extras, atrasos e banco de horas de um colaborador
                </p>

                <form onSubmit={handleEmployeeReport} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Colaborador</label>
                    <select
                      value={employeeReport.employeeId}
                      onChange={(e) => setEmployeeReport({ ...employeeReport, employeeId: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      required
                    >
                      <option value="">Selecione um colaborador</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Mês</label>
                      <select
                        value={employeeReport.month}
                        onChange={(e) => setEmployeeReport({ ...employeeReport, month: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                        required
                      >
                        <option value="">Mês</option>
                        {MONTHS.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Ano</label>
                      <input
                        type="number"
                        value={employeeReport.year}
                        onChange={(e) => setEmployeeReport({ ...employeeReport, year: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={employeeLoading}
                    className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-600 disabled:opacity-50 font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {employeeLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Gerando...
                      </>
                    ) : (
                      'Gerar Relatório'
                    )}
                  </button>
                </form>
              </div>

              {/* Results */}
              <div className="lg:col-span-3 overflow-x-auto">
                {employeeLoading ? (
                  <LoadingSpinner />
                ) : employeeData ? (
                  <div className="space-y-6">
                    {/* Employee Header */}
                    <div className="bg-slate-700 bg-opacity-50 rounded-lg p-6 border border-slate-600">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide">Colaborador</p>
                          <p className="text-lg font-bold text-white">{employeeData.employee.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide">Cargo</p>
                          <p className="text-lg font-bold text-white">{employeeData.employee.position}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide">Departamento</p>
                          <p className="text-sm text-slate-300">{employeeData.employee.department}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide">Filial</p>
                          <p className="text-sm text-slate-300">{employeeData.employee.branch.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide">CPF</p>
                          <p className="text-sm text-slate-300 font-mono">{employeeData.employee.cpf}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wide">PIS</p>
                          <p className="text-sm text-slate-300 font-mono">{employeeData.employee.pis}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-400 uppercase tracking-wide">Horário</p>
                          <p className="text-sm text-slate-300">
                            {employeeData.employee.schedule.name} ({employeeData.employee.schedule.type})
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Summary Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <MetricCard
                        label="Horas Trabalhadas"
                        value={`${formatMinutesToHours(employeeData.timesheet.totalWorkedMinutes)}h`}
                        color="blue"
                      />
                      <MetricCard
                        label="Horas Extras"
                        value={`${formatMinutesToHours(employeeData.timesheet.totalOvertimeMinutes)}h`}
                        color="green"
                      />
                      <MetricCard
                        label="Atraso"
                        value={`${employeeData.timesheet.totalLateMinutes}m`}
                        color={employeeData.timesheet.totalLateMinutes > 0 ? 'red' : 'slate'}
                      />
                      <MetricCard
                        label="Faltas"
                        value={`${formatMinutesToHours(employeeData.timesheet.totalAbsenceMinutes)}h`}
                        color={employeeData.timesheet.totalAbsenceMinutes > 0 ? 'red' : 'slate'}
                      />
                      <MetricCard
                        label="Banco de Horas"
                        value={`${formatMinutesToHours(employeeData.timesheet.totalBalanceMinutes)}h`}
                        color={employeeData.timesheet.totalBalanceMinutes >= 0 ? 'green' : 'red'}
                      />
                      <MetricCard
                        label="H. Noturnas"
                        value={`${formatMinutesToHours(employeeData.timesheet.totalNightMinutes)}h`}
                        color="indigo"
                      />
                    </div>

                    {/* Daily Table */}
                    <div>
                      <h3 className="mb-4 text-lg font-bold text-white">Detalhamento Diário</h3>
                      <div className="overflow-x-auto rounded-lg border border-slate-600">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-700 border-b border-slate-600">
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">Data</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">Dia</th>
                              <th className="px-4 py-3 text-center font-semibold text-slate-300">Registros</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Trabalhado</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Extra</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Atraso</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Falta</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employeeData.timesheet.timesheetDays.map((day, idx) => (
                              <tr
                                key={idx}
                                className={`${
                                  idx % 2 === 0 ? 'bg-slate-750' : 'bg-slate-700'
                                } border-b border-slate-600 hover:bg-slate-600 transition`}
                              >
                                <td className="px-4 py-3 font-mono text-white">{formatBrazilianDate(day.date)}</td>
                                <td className="px-4 py-3 text-slate-300">{getDayName(day.date)}</td>
                                <td className="px-4 py-3 text-center text-slate-300">{day.punchCount}</td>
                                <td className="px-4 py-3 text-right text-slate-300">
                                  {formatMinutesToHours(day.workedMinutes)}h
                                </td>
                                <td className="px-4 py-3 text-right text-green-400">
                                  {formatMinutesToHours(day.overtimeMinutes)}h
                                </td>
                                <td className="px-4 py-3 text-right text-orange-400">{day.lateMinutes}m</td>
                                <td className="px-4 py-3 text-right text-red-400">
                                  {formatMinutesToHours(day.absenceMinutes)}h
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-block px-3 py-1 rounded text-xs font-semibold text-white ${getStatusColor(
                                      day.status
                                    )}`}
                                  >
                                    {day.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState message="Preencha o formulário e gere o relatório para ver os resultados" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Branch Report Tab */}
        {activeTab === 'branch' && (
          <div className="p-8">
            <div className="grid gap-8 lg:grid-cols-5">
              {/* Form */}
              <div className="lg:col-span-2">
                <h2 className="mb-6 text-2xl font-bold text-white">Relatório da Filial</h2>
                <p className="mb-6 text-sm text-slate-400">
                  Visualize resumo de colaboradores, timesheets e horas trabalhadas por filial
                </p>

                <form onSubmit={handleBranchReport} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Filial</label>
                    <select
                      value={branchReport.branchId}
                      onChange={(e) => setBranchReport({ ...branchReport, branchId: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      required
                    >
                      <option value="">Selecione uma filial</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Mês</label>
                      <select
                        value={branchReport.month}
                        onChange={(e) => setBranchReport({ ...branchReport, month: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                        required
                      >
                        <option value="">Mês</option>
                        {MONTHS.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Ano</label>
                      <input
                        type="number"
                        value={branchReport.year}
                        onChange={(e) => setBranchReport({ ...branchReport, year: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={branchLoading}
                    className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-600 disabled:opacity-50 font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {branchLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Gerando...
                      </>
                    ) : (
                      'Gerar Relatório'
                    )}
                  </button>
                </form>
              </div>

              {/* Results */}
              <div className="lg:col-span-3 overflow-x-auto">
                {branchLoading ? (
                  <LoadingSpinner />
                ) : branchData ? (
                  <div className="space-y-6">
                    {/* Summary Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <MetricCard
                        label="Total de Colaboradores"
                        value={branchData.summary.totalEmployees}
                        color="blue"
                      />
                      <MetricCard
                        label="Timesheets Processados"
                        value={branchData.summary.processedTimesheets}
                        color="slate"
                      />
                      <MetricCard
                        label="Timesheets Aprovados"
                        value={branchData.summary.approvedTimesheets}
                        color="green"
                      />
                      <MetricCard
                        label="Média de Horas"
                        value={`${branchData.summary.averageWorkedHours.toFixed(1)}h`}
                        color="blue"
                      />
                      <MetricCard
                        label="Total Extra"
                        value={`${branchData.summary.totalOvertimeHours.toFixed(1)}h`}
                        color="green"
                      />
                    </div>

                    {/* Employees Table */}
                    <div>
                      <h3 className="mb-4 text-lg font-bold text-white">Colaboradores</h3>
                      <div className="overflow-x-auto rounded-lg border border-slate-600">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-700 border-b border-slate-600">
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">Funcionário</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">CPF</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Horas Trab.</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Horas Extra</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Atraso (min)</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Faltas (min)</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Saldo</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...branchData.timesheets]
                              .sort((a, b) => a.employee.name.localeCompare(b.employee.name))
                              .map((item, idx) => (
                                <tr
                                  key={idx}
                                  className={`${
                                    idx % 2 === 0 ? 'bg-slate-750' : 'bg-slate-700'
                                  } border-b border-slate-600 hover:bg-slate-600 transition`}
                                >
                                  <td className="px-4 py-3 font-medium text-white">{item.employee.name}</td>
                                  <td className="px-4 py-3 font-mono text-slate-300 text-xs">{item.employee.cpf}</td>
                                  <td className="px-4 py-3 text-right text-slate-300">
                                    {formatMinutesToHours(item.totalWorkedMinutes)}h
                                  </td>
                                  <td className="px-4 py-3 text-right text-green-400">
                                    {formatMinutesToHours(item.totalOvertimeMinutes)}h
                                  </td>
                                  <td className="px-4 py-3 text-right text-orange-400">{item.totalLateMinutes}</td>
                                  <td className="px-4 py-3 text-right text-red-400">{item.totalAbsenceMinutes}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-indigo-400">
                                    {formatMinutesToHours(item.totalBalanceMinutes)}h
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-3 py-1 rounded text-xs font-semibold ${getStatusBadgeColor(item.status)}`}>
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState message="Preencha o formulário e gere o relatório para ver os resultados" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payroll Report Tab */}
        {activeTab === 'payroll' && (
          <div className="p-8">
            <div className="grid gap-8 lg:grid-cols-5">
              {/* Form */}
              <div className="lg:col-span-2">
                <h2 className="mb-6 text-2xl font-bold text-white">Folha de Pagamento</h2>
                <p className="mb-6 text-sm text-slate-400">
                  Consulte folha de pagamento com horas trabalhadas, extras e descontos por filial
                </p>

                <form onSubmit={handlePayrollReport} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Filial</label>
                    <select
                      value={payrollReport.branchId}
                      onChange={(e) => setPayrollReport({ ...payrollReport, branchId: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      required
                    >
                      <option value="">Selecione uma filial</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Mês</label>
                      <select
                        value={payrollReport.month}
                        onChange={(e) => setPayrollReport({ ...payrollReport, month: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                        required
                      >
                        <option value="">Mês</option>
                        {MONTHS.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Ano</label>
                      <input
                        type="number"
                        value={payrollReport.year}
                        onChange={(e) => setPayrollReport({ ...payrollReport, year: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={payrollLoading}
                    className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-600 disabled:opacity-50 font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {payrollLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Gerando...
                      </>
                    ) : (
                      'Gerar Relatório'
                    )}
                  </button>
                </form>
              </div>

              {/* Results */}
              <div className="lg:col-span-3 overflow-x-auto">
                {payrollLoading ? (
                  <LoadingSpinner />
                ) : payrollData ? (
                  <div className="space-y-6">
                    {/* Summary Metric */}
                    <div>
                      <MetricCard
                        label="Total de Colaboradores Processados"
                        value={payrollData.totalProcessed}
                        color="blue"
                      />
                    </div>

                    {/* Payroll Table */}
                    <div>
                      <h3 className="mb-4 text-lg font-bold text-white">Detalhamento da Folha</h3>
                      <div className="overflow-x-auto rounded-lg border border-slate-600">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-700 border-b border-slate-600">
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">Funcionário</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">Cargo</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">Depto</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">CPF</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-300">PIS</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Horas Trab.</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Horas Extra</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">H. Noturnas</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Atraso (min)</th>
                              <th className="px-4 py-3 text-right font-semibold text-slate-300">Faltas (min)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payrollData.payrollData.map((item, idx) => (
                              <tr
                                key={idx}
                                className={`${
                                  idx % 2 === 0 ? 'bg-slate-750' : 'bg-slate-700'
                                } border-b border-slate-600 hover:bg-slate-600 transition`}
                              >
                                <td className="px-4 py-3 font-medium text-white">{item.employee.name}</td>
                                <td className="px-4 py-3 text-slate-300 text-xs">{item.employee.position}</td>
                                <td className="px-4 py-3 text-slate-300 text-xs">{item.employee.department}</td>
                                <td className="px-4 py-3 font-mono text-slate-300 text-xs">{item.employee.cpf}</td>
                                <td className="px-4 py-3 font-mono text-slate-300 text-xs">{item.employee.pis}</td>
                                <td className="px-4 py-3 text-right text-slate-300">{item.workedHours}h</td>
                                <td className="px-4 py-3 text-right text-green-400">{item.overtimeHours}h</td>
                                <td className="px-4 py-3 text-right text-indigo-400">{item.nightHours}h</td>
                                <td className="px-4 py-3 text-right text-orange-400">{item.lateMinutes}m</td>
                                <td className="px-4 py-3 text-right text-red-400">{item.absenceMinutes}m</td>
                              </tr>
                            ))}
                            {payrollData.payrollData.length > 0 && (
                              <tr className="bg-slate-600 border-t-2 border-slate-500 font-bold">
                                <td colSpan={5} className="px-4 py-3 text-right text-white">
                                  TOTAIS:
                                </td>
                                <td className="px-4 py-3 text-right text-slate-100">
                                  {(
                                    payrollData.payrollData.reduce((sum, item) => sum + parseFloat(item.workedHours), 0)
                                  ).toFixed(1)}
                                  h
                                </td>
                                <td className="px-4 py-3 text-right text-green-400">
                                  {(
                                    payrollData.payrollData.reduce((sum, item) => sum + parseFloat(item.overtimeHours), 0)
                                  ).toFixed(1)}
                                  h
                                </td>
                                <td className="px-4 py-3 text-right text-indigo-400">
                                  {(
                                    payrollData.payrollData.reduce((sum, item) => sum + parseFloat(item.nightHours), 0)
                                  ).toFixed(1)}
                                  h
                                </td>
                                <td className="px-4 py-3 text-right text-orange-400">
                                  {payrollData.payrollData.reduce((sum, item) => sum + item.lateMinutes, 0)}m
                                </td>
                                <td className="px-4 py-3 text-right text-red-400">
                                  {payrollData.payrollData.reduce((sum, item) => sum + item.absenceMinutes, 0)}m
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState message="Preencha o formulário e gere o relatório para ver os resultados" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
