'use client';

import DataTable from '@/components/DataTable';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface TimesheetEmployee {
  id: string;
  name: string;
  cpf: string;
  branch: {
    id: string;
    name: string;
  };
}

interface Timesheet {
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
  employee: TimesheetEmployee;
}

interface Branch {
  id: string;
  name: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

interface ConfirmDialog {
  isOpen: boolean;
  timesheetId: string | null;
  message: string;
}

const MONTHS_PT: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
};

const formatHHMM = (minutes: number): string => {
  if (!minutes || minutes === 0) return '00:00';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    isOpen: false,
    timesheetId: null,
    message: '',
  });
  const [filterBranch, setFilterBranch] = useState('');
  const pageSize = 10;

  useEffect(() => {
    fetchTimesheets();
    fetchBranches();
  }, [currentPage, filterBranch]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, type, visible: true };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

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
      showToast('Erro ao carregar folhas de ponto', 'error');
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
      showToast('Status da folha atualizado com sucesso', 'success');
      fetchTimesheets();
    } catch (error) {
      showToast('Erro ao atualizar status', 'error');
      console.error(error);
    }
  };

  const openConfirmDialog = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      timesheetId: id,
      message: 'Tem certeza que deseja aprovar esta folha de ponto?',
    });
  };

  const handleConfirmApprove = async () => {
    if (!confirmDialog.timesheetId) return;
    try {
      await apiClient.patch(`/timesheets/${confirmDialog.timesheetId}`, { status: 'APPROVED' });
      showToast('Folha de ponto aprovada com sucesso', 'success');
      setConfirmDialog({ isOpen: false, timesheetId: null, message: '' });
      fetchTimesheets();
    } catch (error) {
      showToast('Erro ao aprovar folha', 'error');
      console.error(error);
    }
  };

  const handleCancelApprove = () => {
    setConfirmDialog({ isOpen: false, timesheetId: null, message: '' });
  };

  const getStatusBadge = (status: string) => {
    const badgeConfig: Record<string, { bg: string; text: string; label: string }> = {
      OPEN: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', label: 'Aberta' },
      CALCULATED: { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-300', label: 'Calculada' },
      CLOSED: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300', label: 'Fechada' },
      APPROVED: { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300', label: 'Aprovada' },
    };
    const config = badgeConfig[status] || badgeConfig.OPEN;
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const columns = [
    {
      key: 'employee',
      label: 'Colaborador',
      render: (_: any, row: Timesheet) => (
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{row.employee?.name || '-'}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{row.employee?.branch?.name || ''}</div>
        </div>
      ),
    },
    {
      key: 'period',
      label: 'Período',
      render: (_: any, row: Timesheet) => (
        <div className="text-sm text-slate-600 dark:text-slate-400 font-mono">
          {MONTHS_PT[row.month] || String(row.month).padStart(2, '0')}/{row.year}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: any, row: Timesheet) => getStatusBadge(row.status),
    },
    {
      key: 'totalWorkedMinutes',
      label: 'Trabalhadas',
      render: (_: any, row: Timesheet) => (
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 font-mono">
          {formatHHMM(row.totalWorkedMinutes)}
        </div>
      ),
    },
    {
      key: 'totalOvertimeMinutes',
      label: 'Extras',
      render: (_: any, row: Timesheet) => (
        <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 font-mono">
          {formatHHMM(row.totalOvertimeMinutes)}
        </div>
      ),
    },
    {
      key: 'totalLateMinutes',
      label: 'Atraso',
      render: (_: any, row: Timesheet) => (
        <div className={`text-sm font-medium font-mono ${row.totalLateMinutes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
          {formatHHMM(row.totalLateMinutes)}
        </div>
      ),
    },
    {
      key: 'totalBalanceMinutes',
      label: 'Saldo',
      render: (_: any, row: Timesheet) => (
        <div className={`text-sm font-bold font-mono ${row.totalBalanceMinutes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {formatHHMM(row.totalBalanceMinutes)}
        </div>
      ),
    },
    {
      key: 'id',
      label: 'Ações',
      render: (_: any, row: Timesheet) => (
        <div className="flex items-center gap-2">
          <select
            value={row.status}
            onChange={(e) => handleStatusChange(row.id, e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 dark:focus:ring-offset-slate-900 transition-colors hover:border-slate-400 dark:hover:border-slate-500"
          >
            <option value="OPEN">Aberta</option>
            <option value="CALCULATED">Calculada</option>
            <option value="APPROVED">Aprovada</option>
          </select>
          {row.status !== 'APPROVED' && (
            <button
              onClick={() => openConfirmDialog(row.id)}
              className="px-2.5 py-1.5 text-xs font-medium bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Aprovar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
            Folhas de Ponto
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400">
            Visualize e gerencie as folhas de ponto dos colaboradores
          </p>
        </div>

        {/* Filter Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="space-y-3">
            <label htmlFor="branch-filter" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Filtrar por Filial
            </label>
            <select
              id="branch-filter"
              value={filterBranch}
              onChange={(e) => { setFilterBranch(e.target.value); setCurrentPage(1); }}
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 dark:focus:ring-offset-slate-800 transition-colors"
            >
              <option value="">Todas as filiais</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
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
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm mx-4 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Confirmar Aprovação</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={handleCancelApprove} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                Cancelar
              </button>
              <button onClick={handleConfirmApprove} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-700 rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors">
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-40 space-y-2 max-w-sm">
        {toasts.map((toast) => (
          <div key={toast.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          } ${toast.visible ? 'opacity-100' : 'opacity-0'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
