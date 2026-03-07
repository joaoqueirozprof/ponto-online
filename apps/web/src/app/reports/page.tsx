'use client';

import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ReportData {
  [key: string]: any;
}

interface Employee {
  id: string;
  name: string;
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
  const [employeeData, setEmployeeData] = useState<ReportData | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  // Branch report state
  const [branchReport, setBranchReport] = useState({ branchId: '', month: '', year: currentYear.toString() });
  const [branchData, setBranchData] = useState<ReportData | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);

  // Payroll report state
  const [payrollReport, setPayrollReport] = useState({ branchId: '', month: '', year: currentYear.toString() });
  const [payrollData, setPayrollData] = useState<ReportData | null>(null);
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
      setEmployeeData(response.data.data || {});
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
      setBranchData(response.data.data || {});
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
      setPayrollData(response.data.data || {});
      showToast('Relatório gerado com sucesso', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao gerar relatório', 'error');
    } finally {
      setPayrollLoading(false);
    }
  };

  const MetricCard = ({ label, value, color = 'slate', icon }: { label: string; value: string | number; color?: 'green' | 'red' | 'blue' | 'slate'; icon?: React.ReactNode }) => {
    const colorClasses = {
      green: 'bg-green-50 border-green-200 text-green-700',
      red: 'bg-red-50 border-red-200 text-red-700',
      blue: 'bg-blue-50 border-blue-200 text-blue-700',
      slate: 'bg-slate-50 border-slate-200 text-slate-700',
    };

    return (
      <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
        <p className="text-sm font-medium opacity-75">{label}</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-2xl font-bold">{value}</p>
          {icon && <span className="text-xl opacity-50">{icon}</span>}
        </div>
      </div>
    );
  };

  const LoadingSpinner = () => (
    <div className="flex justify-center py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12">
      <p className="text-slate-500">{message}</p>
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
      <div className="rounded-xl bg-slate-800 shadow-2xl border border-slate-700">
        {/* Employee Report Tab */}
        {activeTab === 'employee' && (
          <div className="p-8">
            <div className="grid gap-8 lg:grid-cols-5">
              {/* Form */}
              <div className="lg:col-span-2">
                <h2 className="mb-6 text-2xl font-bold text-white">Espelho de Ponto</h2>
                <p className="mb-6 text-sm text-slate-400">Consulte as horas trabalhadas, extras e banco de horas de um colaborador</p>

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
              <div className="lg:col-span-3">
                {employeeLoading ? (
                  <LoadingSpinner />
                ) : employeeData ? (
                  <div>
                    <h3 className="mb-6 text-xl font-bold text-white">Resultado</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MetricCard
                        label="Horas Trabalhadas"
                        value={`${employeeData.workedHours?.toFixed(2) || '0'}h`}
                        color="blue"
                      />
                      <MetricCard
                        label="Horas Extras"
                        value={`${employeeData.overtime?.toFixed(2) || '0'}h`}
                        color="green"
                      />
                      <MetricCard
                        label="Faltas"
                        value={employeeData.absences || '0'}
                        color={employeeData.absences > 0 ? 'red' : 'slate'}
                      />
                      <MetricCard
                        label="Banco de Horas"
                        value={`${employeeData.bankBalance?.toFixed(2) || '0'}h`}
                        color={employeeData.bankBalance >= 0 ? 'green' : 'red'}
                      />
                      <MetricCard
                        label="Minutos Atrasado"
                        value={employeeData.lateMinutes || '0'}
                        color={employeeData.lateMinutes > 0 ? 'red' : 'slate'}
                      />
                      <MetricCard
                        label="Saída Antecipada (min)"
                        value={employeeData.earlyDepartureMinutes || '0'}
                        color={employeeData.earlyDepartureMinutes > 0 ? 'red' : 'slate'}
                      />
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
                <p className="mb-6 text-sm text-slate-400">Visualize resumo de colaboradores, registros e taxa de presença</p>

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
              <div className="lg:col-span-3">
                {branchLoading ? (
                  <LoadingSpinner />
                ) : branchData ? (
                  <div>
                    <h3 className="mb-6 text-xl font-bold text-white">Resultado</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MetricCard
                        label="Total de Colaboradores"
                        value={branchData.totalEmployees || '0'}
                        color="blue"
                      />
                      <MetricCard
                        label="Total de Registros"
                        value={branchData.totalPunches || '0'}
                        color="slate"
                      />
                      <MetricCard
                        label="Média de Horas"
                        value={`${branchData.averageHours?.toFixed(2) || '0'}h`}
                        color="blue"
                      />
                      <MetricCard
                        label="Taxa de Presença"
                        value={`${branchData.attendanceRate?.toFixed(1) || '0'}%`}
                        color={branchData.attendanceRate >= 80 ? 'green' : 'red'}
                      />
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
                <p className="mb-6 text-sm text-slate-400">Consulte totais de folha, extras e descontos processados</p>

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
              <div className="lg:col-span-3">
                {payrollLoading ? (
                  <LoadingSpinner />
                ) : payrollData ? (
                  <div>
                    <h3 className="mb-6 text-xl font-bold text-white">Resultado</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MetricCard
                        label="Total em Folha"
                        value={`R$ ${payrollData.totalPayroll?.toFixed(2) || '0'}`}
                        color="green"
                      />
                      <MetricCard
                        label="Valor de Extras"
                        value={`R$ ${payrollData.overtimeValue?.toFixed(2) || '0'}`}
                        color="green"
                      />
                      <MetricCard
                        label="Total de Descontos"
                        value={`R$ ${payrollData.totalDiscounts?.toFixed(2) || '0'}`}
                        color="red"
                      />
                      <MetricCard
                        label="Folhas Processadas"
                        value={payrollData.processedPayrolls || '0'}
                        color="blue"
                      />
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
