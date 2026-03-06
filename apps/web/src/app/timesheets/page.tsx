'use client';

import DataTable from '@/components/DataTable';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Timesheet {
  id: string;
  employeeName: string;
  month: number;
  year: number;
  status: 'OPEN' | 'CALCULATED' | 'APPROVED';
  workedHours: number;
  overtime: number;
  employeeId: string;
}

interface Branch {
  id: string;
  name: string;
}

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  const [filterBranch, setFilterBranch] = useState('');

  useEffect(() => {
    fetchTimesheets();
    fetchBranches();
  }, [currentPage, filterBranch]);

  const fetchTimesheets = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (filterBranch) params.branchId = filterBranch;
      const response = await apiClient.get('/timesheets', { params });
      setTimesheets(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Erro ao carregar folhas de ponto');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await apiClient.get('/branches', { params: { take: 999 } });
      setBranches(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar filiais', error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await apiClient.patch(`/timesheets/${id}`, { status: newStatus });
      alert('Status da folha atualizado com sucesso');
      fetchTimesheets();
    } catch (error) {
      alert('Erro ao atualizar status');
      console.error(error);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Tem certeza que deseja aprovar esta folha de ponto?')) return;
    try {
      await apiClient.patch(`/timesheets/${id}`, { status: 'APPROVED' });
      alert('Folha de ponto aprovada com sucesso');
      fetchTimesheets();
    } catch (error) {
      alert('Erro ao aprovar folha');
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-slate-50 text-slate-700',
      CALCULATED: 'bg-amber-50 text-amber-700',
      APPROVED: 'bg-emerald-50 text-emerald-700',
    };
    const labels: Record<string, string> = {
      OPEN: 'Aberta',
      CALCULATED: 'Calculada',
      APPROVED: 'Aprovada',
    };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.OPEN}`}>
        {labels[status] || status}
      </span>
    );
  };

  const columns = [
    {
      key: 'employeeName',
      label: 'Colaborador',
    },
    {
      key: 'month',
      label: 'Período',
      render: (month: number, row: Timesheet) => `${String(row.month).padStart(2, '0')}/${row.year}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (status: string) => getStatusBadge(status),
    },
    {
      key: 'workedHours',
      label: 'Horas Trabalhadas',
      render: (hours: number) => `${hours.toFixed(2)}h`,
    },
    {
      key: 'overtime',
      label: 'Horas Extras',
      render: (overtime: number) => `${overtime.toFixed(2)}h`,
    },
    {
      key: 'id',
      label: 'Ações',
      render: (id: string, row: Timesheet) => (
        <div className="flex gap-2">
          <select
            value={row.status}
            onChange={(e) => handleStatusChange(id, e.target.value)}
            className="px-3 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="OPEN">Aberta</option>
            <option value="CALCULATED">Calculada</option>
            <option value="APPROVED">Aprovada</option>
          </select>
          {row.status !== 'APPROVED' && (
            <button
              onClick={() => handleApprove(id)}
              className="px-3 py-1 text-sm bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors font-medium"
            >
              Aprovar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Folhas de Ponto</h1>
        <p className="text-slate-500 mt-1">Visualize e gerencie as folhas de ponto dos colaboradores</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Filtrar por Filial</label>
            <select
              value={filterBranch}
              onChange={(e) => {
                setFilterBranch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas as filiais</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={timesheets}
        loading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage((p) => p + 1)}
      />
    </div>
  );
}
