'use client';

import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

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

export default function ReportsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  const [employeeReport, setEmployeeReport] = useState({ employeeId: '', month: '', year: '' });
  const [employeeData, setEmployeeData] = useState<ReportData | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [branchReport, setBranchReport] = useState({ branchId: '', month: '', year: '' });
  const [branchData, setBranchData] = useState<ReportData | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);

  const [payrollReport, setPayrollReport] = useState({ branchId: '', month: '', year: '' });
  const [payrollData, setPayrollData] = useState<ReportData | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  useEffect(() => {
    fetchEmployeesAndBranches();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeReport.employeeId || !employeeReport.month || !employeeReport.year) {
      alert('Preencha todos os campos');
      return;
    }
    try {
      setEmployeeLoading(true);
      const response = await apiClient.get('/reports/employee', {
        params: {
          employeeId: employeeReport.employeeId,
          month: employeeReport.month,
          year: employeeReport.year,
        },
      });
      setEmployeeData(response.data.data || {});
    } catch (error) {
      alert('Erro ao gerar relatório');
      console.error(error);
    } finally {
      setEmployeeLoading(false);
    }
  };

  const handleBranchReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchReport.branchId || !branchReport.month || !branchReport.year) {
      alert('Preencha todos os campos');
      return;
    }
    try {
      setBranchLoading(true);
      const response = await apiClient.get('/reports/branch', {
        params: {
          branchId: branchReport.branchId,
          month: branchReport.month,
          year: branchReport.year,
        },
      });
      setBranchData(response.data.data || {});
    } catch (error) {
      alert('Erro ao gerar relatório');
      console.error(error);
    } finally {
      setBranchLoading(false);
    }
  };

  const handlePayrollReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payrollReport.branchId || !payrollReport.month || !payrollReport.year) {
      alert('Preencha todos os campos');
      return;
    }
    try {
      setPayrollLoading(true);
      const response = await apiClient.get('/reports/payroll', {
        params: {
          branchId: payrollReport.branchId,
          month: payrollReport.month,
          year: payrollReport.year,
        },
      });
      setPayrollData(response.data.data || {});
    } catch (error) {
      alert('Erro ao gerar relatório');
      console.error(error);
    } finally {
      setPayrollLoading(false);
    }
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
        <p className="text-slate-500 mt-1">Gere relatórios detalhados de ponto, filial e folha de pagamento</p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Report */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">Relatório do Colaborador</h2>
            <p className="text-sm text-slate-500 mt-1">Horas trabalhadas, faltas e banco de horas</p>
          </div>

          <form onSubmit={handleEmployeeReport} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Colaborador*</label>
              <select
                value={employeeReport.employeeId}
                onChange={(e) => setEmployeeReport({ ...employeeReport, employeeId: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mês*</label>
              <input
                type="number"
                min="1"
                max="12"
                value={employeeReport.month}
                onChange={(e) => setEmployeeReport({ ...employeeReport, month: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                placeholder="1-12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ano*</label>
              <input
                type="number"
                value={employeeReport.year}
                onChange={(e) => setEmployeeReport({ ...employeeReport, year: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={employeeLoading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
            >
              {employeeLoading ? 'Gerando...' : 'Gerar Relatório'}
            </button>
          </form>

          {employeeData && (
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Horas Trabalhadas:</span>
                <span className="font-semibold text-slate-800">{employeeData.workedHours?.toFixed(2) || '-'}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Horas Extras:</span>
                <span className="font-semibold text-slate-800">{employeeData.overtime?.toFixed(2) || '-'}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Faltas:</span>
                <span className="font-semibold text-slate-800">{employeeData.absences || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Banco de Horas:</span>
                <span className="font-semibold text-slate-800">{employeeData.bankBalance?.toFixed(2) || '-'}h</span>
              </div>
            </div>
          )}
        </div>

        {/* Branch Report */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">Relatório da Filial</h2>
            <p className="text-sm text-slate-500 mt-1">Resumo de colaboradores e registros</p>
          </div>

          <form onSubmit={handleBranchReport} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Filial*</label>
              <select
                value={branchReport.branchId}
                onChange={(e) => setBranchReport({ ...branchReport, branchId: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mês*</label>
              <input
                type="number"
                min="1"
                max="12"
                value={branchReport.month}
                onChange={(e) => setBranchReport({ ...branchReport, month: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                placeholder="1-12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ano*</label>
              <input
                type="number"
                value={branchReport.year}
                onChange={(e) => setBranchReport({ ...branchReport, year: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={branchLoading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
            >
              {branchLoading ? 'Gerando...' : 'Gerar Relatório'}
            </button>
          </form>

          {branchData && (
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total Colaboradores:</span>
                <span className="font-semibold text-slate-800">{branchData.totalEmployees || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Registros Totais:</span>
                <span className="font-semibold text-slate-800">{branchData.totalPunches || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Média de Horas:</span>
                <span className="font-semibold text-slate-800">{branchData.averageHours?.toFixed(2) || '-'}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Taxa de Presença:</span>
                <span className="font-semibold text-slate-800">{branchData.attendanceRate?.toFixed(2) || '-'}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Payroll Report */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">Relatório de Folha</h2>
            <p className="text-sm text-slate-500 mt-1">Resumo de payroll e descontos</p>
          </div>

          <form onSubmit={handlePayrollReport} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Filial*</label>
              <select
                value={payrollReport.branchId}
                onChange={(e) => setPayrollReport({ ...payrollReport, branchId: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mês*</label>
              <input
                type="number"
                min="1"
                max="12"
                value={payrollReport.month}
                onChange={(e) => setPayrollReport({ ...payrollReport, month: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                placeholder="1-12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ano*</label>
              <input
                type="number"
                value={payrollReport.year}
                onChange={(e) => setPayrollReport({ ...payrollReport, year: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={payrollLoading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
            >
              {payrollLoading ? 'Gerando...' : 'Gerar Relatório'}
            </button>
          </form>

          {payrollData && (
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total em Folha:</span>
                <span className="font-semibold text-slate-800">R$ {payrollData.totalPayroll?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Horas Extras:</span>
                <span className="font-semibold text-slate-800">R$ {payrollData.overtimeValue?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total Descontos:</span>
                <span className="font-semibold text-slate-800">R$ {payrollData.totalDiscounts?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Folhas Processadas:</span>
                <span className="font-semibold text-slate-800">{payrollData.processedPayrolls || '-'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
