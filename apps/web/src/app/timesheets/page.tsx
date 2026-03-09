'use client';

import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
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

interface PunchRecord {
  time: string;
  type: string;
  status: string;
}

interface TimesheetDay {
  id: string;
  date: string;
  dayOfWeek: number;
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  absenceMinutes: number;
  breakMinutes: number;
  punchCount: number;
  status: string;
  scheduleEntry: {
    startTime: string;
    endTime: string;
    breakStartTime: string | null;
    breakEndTime: string | null;
    isWorkDay: boolean;
  } | null;
}

interface TimesheetDetail {
  id: string;
  month: number;
  year: number;
  status: string;
  totalWorkedMinutes: number;
  totalOvertimeMinutes: number;
  totalLateMinutes: number;
  totalAbsenceMinutes: number;
  totalBalanceMinutes: number;
  employee: { id: string; name: string; cpf: string };
  timesheetDays: TimesheetDay[];
  punchesByDate?: Record<string, PunchRecord[]>;
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
  1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
  7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
};

const MONTHS_SHORT: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
};

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const formatHHMM = (minutes: number): string => {
  if (!minutes || minutes === 0) return '00:00';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatTime = (dateStr: string | null): string => {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
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

const getDayPunchTimes = (
  dateStr: string,
  punchesByDate?: Record<string, PunchRecord[]>
): { entry: string; exit: string; allPunches: string } => {
  if (!punchesByDate) return { entry: '--:--', exit: '--:--', allPunches: '-' };
  const dateKey = dateStr?.split('T')[0] || '';
  const punches = punchesByDate[dateKey];
  if (!punches || punches.length === 0) return { entry: '--:--', exit: '--:--', allPunches: '-' };

  const entryPunch = punches.find(p => p.type === 'ENTRY');
  const exitPunch = [...punches].reverse().find(p => p.type === 'EXIT');
  const allTimes = punches.map(p => formatTime(p.time)).join(' | ');

  return {
    entry: entryPunch ? formatTime(entryPunch.time) : '--:--',
    exit: exitPunch ? formatTime(exitPunch.time) : '--:--',
    allPunches: allTimes,
  };
};

const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
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
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchApproving, setBatchApproving] = useState(false);
  const pageSize = 15;

  // Manual punch modal state
  const [manualPunchModal, setManualPunchModal] = useState(false);
  const [manualPunchEmployee, setManualPunchEmployee] = useState<{ id: string; name: string } | null>(null);
  const [manualPunchDate, setManualPunchDate] = useState('');
  const [manualPunchTime, setManualPunchTime] = useState('');
  const [manualPunchType, setManualPunchType] = useState('ENTRY');
  const [manualPunchReason, setManualPunchReason] = useState('');
  const [manualPunchLoading, setManualPunchLoading] = useState(false);

  // Detail modal
  const [detailModal, setDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [timesheetDetail, setTimesheetDetail] = useState<TimesheetDetail | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchTimesheets();
    fetchBranches();
    setSelectedIds([]);
  }, [currentPage, filterBranch, debouncedSearch, filterMonth, filterYear]);

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
      const params: any = { skip, take: pageSize, month: filterMonth, year: filterYear };
      if (filterBranch) params.branchId = filterBranch;
      if (debouncedSearch) params.search = debouncedSearch;
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

  const handleViewDetails = async (ts: Timesheet) => {
    try {
      setDetailModal(true);
      setDetailLoading(true);
      const response = await apiClient.get(`/timesheets/${ts.employeeId}/${ts.month}/${ts.year}`);
      setTimesheetDetail(response.data);
    } catch (error) {
      showToast('Erro ao carregar detalhes da folha', 'error');
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await apiClient.patch(`/timesheets/${id}/status`, { status: newStatus });
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
      await apiClient.patch(`/timesheets/${confirmDialog.timesheetId}/status`, { status: 'APPROVED' });
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const approvable = timesheets.filter((t) => t.status !== 'APPROVED').map((t) => t.id);
    if (approvable.length === 0) return;
    const allSelected = approvable.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !approvable.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...approvable])]);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    setBatchApproving(true);
    try {
      const response = await apiClient.post('/timesheets/batch-approve', { ids: selectedIds });
      showToast(response.data.message || `${response.data.approved} folhas aprovadas`, 'success');
      setSelectedIds([]);
      setBatchConfirmOpen(false);
      fetchTimesheets();
    } catch (error) {
      showToast('Erro ao aprovar folhas em lote', 'error');
      console.error(error);
    } finally {
      setBatchApproving(false);
    }
  };

  const handleOpenManualPunch = (ts: Timesheet, prefillDate?: string) => {
    setManualPunchEmployee({ id: ts.employeeId, name: ts.employee?.name || 'Funcionário' });
    // Pre-fill date: if prefillDate provided use it, else use today
    if (prefillDate) {
      setManualPunchDate(prefillDate);
    } else {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      setManualPunchDate(`${y}-${m}-${d}`);
    }
    setManualPunchTime('08:00');
    setManualPunchType('ENTRY');
    setManualPunchReason('');
    setManualPunchModal(true);
  };

  const handleSubmitManualPunch = async () => {
    if (!manualPunchEmployee || !manualPunchDate || !manualPunchTime || !manualPunchReason.trim()) {
      showToast('Preencha todos os campos obrigatórios, incluindo a justificativa', 'error');
      return;
    }
    setManualPunchLoading(true);
    try {
      const punchTime = new Date(`${manualPunchDate}T${manualPunchTime}:00`).toISOString();
      await apiClient.post('/punches/manual', {
        employeeId: manualPunchEmployee.id,
        punchTime,
        punchType: manualPunchType,
        reason: manualPunchReason.trim(),
        createdBy: 'RH',
      });
      showToast(`Batida registrada com sucesso para ${manualPunchEmployee.name}`, 'success');
      setManualPunchModal(false);
      setManualPunchEmployee(null);
      setManualPunchReason('');
      fetchTimesheets();
      // Refresh detail if open
      if (detailModal && timesheetDetail) {
        setDetailLoading(true);
        try {
          const response = await apiClient.get(`/timesheets/${timesheetDetail.employee.id}/${timesheetDetail.month}/${timesheetDetail.year}`);
          setTimesheetDetail(response.data);
        } catch { /* silent */ } finally {
          setDetailLoading(false);
        }
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Erro ao registrar batida';
      showToast(msg, 'error');
    } finally {
      setManualPunchLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (timesheets.length === 0) {
      showToast('Nenhuma folha de ponto para exportar', 'error');
      return;
    }
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const headers = ['Colaborador', 'Filial', 'Período', 'Status', 'Horas Trabalhadas', 'Horas Extras', 'Atrasos', 'Saldo'];
    const rows = timesheets.map((ts) => [
      ts.employee?.name || '-',
      ts.employee?.branch?.name || '-',
      `${monthNames[ts.month - 1]}/${ts.year}`,
      ts.status === 'OPEN' ? 'Aberta' : ts.status === 'APPROVED' ? 'Aprovada' : ts.status === 'CALCULATED' ? 'Calculada' : ts.status,
      `${Math.floor((ts.totalWorkedMinutes || 0) / 60)}:${String((ts.totalWorkedMinutes || 0) % 60).padStart(2, '0')}`,
      `${Math.floor((ts.totalOvertimeMinutes || 0) / 60)}:${String((ts.totalOvertimeMinutes || 0) % 60).padStart(2, '0')}`,
      `${Math.floor((ts.totalLateMinutes || 0) / 60)}:${String((ts.totalLateMinutes || 0) % 60).padStart(2, '0')}`,
      `${Math.floor(Math.abs(ts.totalBalanceMinutes || 0) / 60)}:${String(Math.abs(ts.totalBalanceMinutes || 0) % 60).padStart(2, '0')}${(ts.totalBalanceMinutes || 0) < 0 ? ' (neg)' : ''}`,
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `folhas-ponto-${monthNames[filterMonth - 1].toLowerCase()}-${filterYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV exportado com sucesso!');
  };

  const getStatusBadge = (status: string) => {
    const badgeConfig: Record<string, { bg: string; text: string; label: string }> = {
      OPEN: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Aberta' },
      CALCULATED: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Calculada' },
      CLOSED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Fechada' },
      APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Aprovada' },
    };
    const config = badgeConfig[status] || badgeConfig.OPEN;
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getDayStatus = (day: TimesheetDay) => {
    const datePart = day.date?.includes('T') ? day.date.split('T')[0] : day.date;
    const d = new Date(datePart + 'T12:00:00');
    const dow = d.getDay();
    if (day.status === 'HOLIDAY') return { label: 'Feriado', color: 'text-purple-600 bg-purple-50' };
    if (day.status === 'ABSENCE') return { label: 'Falta', color: 'text-red-600 bg-red-50' };
    if (day.status === 'DAY_OFF' || (day.scheduleEntry && !day.scheduleEntry.isWorkDay)) return { label: 'Folga', color: 'text-slate-400 bg-slate-50' };
    if (dow === 0 && (day.punchCount || 0) === 0) return { label: 'Folga', color: 'text-slate-400 bg-slate-50' };
    if ((day.punchCount || 0) > 0 || day.workedMinutes > 0) return { label: 'Presente', color: 'text-emerald-600 bg-emerald-50' };
    // Future date
    const today = new Date();
    if (d > today) return { label: '-', color: 'text-slate-300 bg-white' };
    return { label: 'Sem registro', color: 'text-orange-500 bg-orange-50' };
  };

  const approvableOnPage = timesheets.filter((t) => t.status !== 'APPROVED').map((t) => t.id);
  const allPageSelected = approvableOnPage.length > 0 && approvableOnPage.every((id) => selectedIds.includes(id));

  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={allPageSelected}
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          title="Selecionar todos"
        />
      ) as any,
      render: (_: any, row: Timesheet) => (
        row.status !== 'APPROVED' ? (
          <input
            type="checkbox"
            checked={selectedIds.includes(row.id)}
            onChange={(e) => { e.stopPropagation(); toggleSelect(row.id); }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        ) : (
          <span className="text-slate-300 text-xs">✓</span>
        )
      ),
    },
    {
      key: 'employee',
      label: 'Colaborador',
      render: (_: any, row: Timesheet) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{row.employee?.name || '-'}</div>
          <div className="text-xs text-slate-500">{row.employee?.branch?.name || ''}</div>
        </div>
      ),
    },
    {
      key: 'period',
      label: 'Período',
      render: (_: any, row: Timesheet) => (
        <div className="text-sm text-slate-600 font-mono">
          {MONTHS_SHORT[row.month] || String(row.month).padStart(2, '0')}/{row.year}
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
        <div className="text-sm font-medium text-slate-700 font-mono">
          {formatHHMM(row.totalWorkedMinutes)}
        </div>
      ),
    },
    {
      key: 'totalOvertimeMinutes',
      label: 'Extras',
      render: (_: any, row: Timesheet) => (
        <div className="text-sm font-medium text-emerald-600 font-mono">
          {formatHHMM(row.totalOvertimeMinutes)}
        </div>
      ),
    },
    {
      key: 'totalLateMinutes',
      label: 'Atraso',
      render: (_: any, row: Timesheet) => (
        <div className={`text-sm font-medium font-mono ${row.totalLateMinutes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
          {formatHHMM(row.totalLateMinutes)}
        </div>
      ),
    },
    {
      key: 'totalBalanceMinutes',
      label: 'Saldo',
      render: (_: any, row: Timesheet) => (
        <div className={`text-sm font-bold font-mono ${row.totalBalanceMinutes >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {formatHHMM(row.totalBalanceMinutes)}
        </div>
      ),
    },
    {
      key: 'id',
      label: 'Ações',
      render: (_: any, row: Timesheet) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDetails(row)}
            className="px-2.5 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Ver Detalhes
          </button>
          <button
            onClick={() => handleOpenManualPunch(row)}
            className="px-2.5 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            title="Lançar batida manual"
          >
            + Ponto
          </button>
          <select
            value={row.status}
            onChange={(e) => handleStatusChange(row.id, e.target.value)}
            className="px-2 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            <option value="OPEN">Aberta</option>
            <option value="CALCULATED">Calculada</option>
            <option value="APPROVED">Aprovada</option>
          </select>
          {row.status !== 'APPROVED' && (
            <button
              onClick={() => openConfirmDialog(row.id)}
              className="px-2.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Aprovar
            </button>
          )}
        </div>
      ),
    },
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              Folhas de Ponto
            </h1>
            <p className="text-base text-slate-600">
              Visualize e gerencie as folhas de ponto dos colaboradores
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={() => setBatchConfirmOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition-colors font-medium text-sm shadow-sm hover:shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Aprovar em Lote ({selectedIds.length})
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors font-medium text-sm shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Month Filter */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mês</label>
              <select
                value={filterMonth}
                onChange={(e) => { setFilterMonth(Number(e.target.value)); setCurrentPage(1); }}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                {Object.entries(MONTHS_PT).map(([num, name]) => (
                  <option key={num} value={num}>{name}</option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Ano</label>
              <select
                value={filterYear}
                onChange={(e) => { setFilterYear(Number(e.target.value)); setCurrentPage(1); }}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Branch Filter */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Filial</label>
              <select
                value={filterBranch}
                onChange={(e) => { setFilterBranch(e.target.value); setCurrentPage(1); }}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                <option value="">Todas as filiais</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Buscar</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Nome do funcionário..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{timesheets.length}</div>
            <div className="text-xs text-slate-500 mt-1">Total de Folhas</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{timesheets.filter(t => t.status === 'APPROVED').length}</div>
            <div className="text-xs text-slate-500 mt-1">Aprovadas</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{timesheets.filter(t => t.status === 'CALCULATED').length}</div>
            <div className="text-xs text-slate-500 mt-1">Calculadas</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-slate-600">{timesheets.filter(t => t.status === 'OPEN').length}</div>
            <div className="text-xs text-slate-500 mt-1">Abertas</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {formatHHMM(timesheets.reduce((sum, t) => sum + (t.totalOvertimeMinutes || 0), 0))}
            </div>
            <div className="text-xs text-slate-500 mt-1">Total Extras</div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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

      {/* Detail Modal */}
      <Modal
        isOpen={detailModal}
        onClose={() => { setDetailModal(false); setTimesheetDetail(null); }}
        title={timesheetDetail ? `Folha de Ponto - ${timesheetDetail.employee?.name || ''}` : 'Carregando...'}
        size="xl"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-slate-500">Carregando detalhes...</span>
          </div>
        ) : timesheetDetail ? (
          <div className="space-y-6">
            {/* Summary header */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-slate-900">{formatHHMM(timesheetDetail.totalWorkedMinutes)}</div>
                <div className="text-xs text-slate-500">Trabalhadas</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-600">{formatHHMM(timesheetDetail.totalOvertimeMinutes)}</div>
                <div className="text-xs text-slate-500">Extras</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-amber-600">{formatHHMM(timesheetDetail.totalLateMinutes)}</div>
                <div className="text-xs text-slate-500">Atraso</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-red-600">{formatHHMM(timesheetDetail.totalAbsenceMinutes)}</div>
                <div className="text-xs text-slate-500">Faltas</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${timesheetDetail.totalBalanceMinutes >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <div className={`text-lg font-bold ${timesheetDetail.totalBalanceMinutes >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatHHMM(timesheetDetail.totalBalanceMinutes)}
                </div>
                <div className="text-xs text-slate-500">Saldo</div>
              </div>
            </div>

            {/* Period info */}
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              {MONTHS_PT[timesheetDetail.month]} / {timesheetDetail.year} &bull; {getStatusBadge(timesheetDetail.status)}
            </div>

            {/* Day-by-day table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Data</th>
                    <th className="text-left px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Dia</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Entrada</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Saída Int.</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Retorno</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Saída</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Trab.</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Extras</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Atraso</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-600 uppercase">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheetDetail.timesheetDays && timesheetDetail.timesheetDays.length > 0 ? (
                    timesheetDetail.timesheetDays.map((day) => {
                      const datePart = day.date?.includes('T') ? day.date.split('T')[0] : day.date;
                      const d = new Date(datePart + 'T12:00:00');
                      const dayInfo = getDayStatus(day);
                      const isSunday = d.getDay() === 0;
                      // Get punch times from punchesByDate
                      const dayPunches = timesheetDetail.punchesByDate?.[datePart] || [];
                      const entryPunch = dayPunches.find(p => p.type === 'ENTRY');
                      const breakStartPunch = dayPunches.find(p => p.type === 'BREAK_START');
                      const breakEndPunch = dayPunches.find(p => p.type === 'BREAK_END');
                      const exitPunch = [...dayPunches].reverse().find(p => p.type === 'EXIT');
                      return (
                        <tr key={day.id} className={`border-b border-slate-100 ${isSunday ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                          <td className="px-2 py-2 font-mono text-slate-700">{formatDate(day.date)}</td>
                          <td className={`px-2 py-2 ${isSunday ? 'text-red-500 font-semibold' : 'text-slate-600'}`}>
                            {DAY_NAMES_SHORT[d.getDay()]}
                          </td>
                          <td className="px-2 py-2 text-center font-mono text-emerald-700 text-xs">{entryPunch ? formatTime(entryPunch.time) : '--:--'}</td>
                          <td className="px-2 py-2 text-center font-mono text-amber-700 text-xs">{breakStartPunch ? formatTime(breakStartPunch.time) : '--:--'}</td>
                          <td className="px-2 py-2 text-center font-mono text-blue-700 text-xs">{breakEndPunch ? formatTime(breakEndPunch.time) : '--:--'}</td>
                          <td className="px-2 py-2 text-center font-mono text-red-700 text-xs">{exitPunch ? formatTime(exitPunch.time) : '--:--'}</td>
                          <td className="px-2 py-2 text-center font-mono font-medium text-slate-700">{day.workedMinutes > 0 ? formatHHMM(day.workedMinutes) : '-'}</td>
                          <td className="px-2 py-2 text-center font-mono text-emerald-600">{day.overtimeMinutes > 0 ? formatHHMM(day.overtimeMinutes) : '-'}</td>
                          <td className="px-2 py-2 text-center font-mono text-amber-600">{day.lateMinutes > 0 ? formatHHMM(day.lateMinutes) : '-'}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${dayInfo.color}`}>
                              {dayInfo.label}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {timesheetDetail && (
                              <button
                                onClick={() => {
                                  if (!timesheetDetail) return;
                                  const fakeTs: Timesheet = {
                                    id: timesheetDetail.id,
                                    employeeId: timesheetDetail.employee.id,
                                    month: timesheetDetail.month,
                                    year: timesheetDetail.year,
                                    status: timesheetDetail.status as any,
                                    totalWorkedMinutes: timesheetDetail.totalWorkedMinutes,
                                    totalOvertimeMinutes: timesheetDetail.totalOvertimeMinutes,
                                    totalNightMinutes: 0,
                                    totalAbsenceMinutes: timesheetDetail.totalAbsenceMinutes,
                                    totalLateMinutes: timesheetDetail.totalLateMinutes,
                                    totalBalanceMinutes: timesheetDetail.totalBalanceMinutes,
                                    employee: {
                                      id: timesheetDetail.employee.id,
                                      name: timesheetDetail.employee.name,
                                      cpf: timesheetDetail.employee.cpf,
                                      branch: { id: '', name: '' },
                                    },
                                  };
                                  handleOpenManualPunch(fakeTs, datePart);
                                }}
                                className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded hover:bg-violet-200 transition-colors"
                                title={`Lançar ponto para ${datePart}`}
                              >
                                + Ponto
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-slate-400">
                        Nenhum registro encontrado para este período.
                        <br />
                        <span className="text-xs">Os registros diários são gerados automaticamente quando as batidas são processadas.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-4 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Confirmar Aprovação</h2>
            <p className="text-slate-600 text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={handleCancelApprove} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleConfirmApprove} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Approve Confirmation */}
      {batchConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-4 border border-slate-200">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 text-center mb-2">Aprovar em Lote</h2>
            <p className="text-slate-600 text-sm text-center mb-6">
              Tem certeza que deseja aprovar <strong>{selectedIds.length}</strong> folha{selectedIds.length > 1 ? 's' : ''} de ponto selecionada{selectedIds.length > 1 ? 's' : ''}?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBatchConfirmOpen(false)}
                disabled={batchApproving}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBatchApprove}
                disabled={batchApproving}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {batchApproving ? 'Aprovando...' : `Aprovar ${selectedIds.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Punch Modal */}
      {manualPunchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Lançamento Manual de Ponto</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[200px]">{manualPunchEmployee?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setManualPunchModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Alert */}
              <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-700">
                  Este lançamento ficará registrado no histórico de auditoria com a justificativa informada.
                </p>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data *</label>
                  <input
                    type="date"
                    value={manualPunchDate}
                    onChange={(e) => setManualPunchDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hora *</label>
                  <input
                    type="time"
                    value={manualPunchTime}
                    onChange={(e) => setManualPunchTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                  />
                </div>
              </div>

              {/* Punch Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipo de Batida *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'ENTRY', label: 'Entrada', color: 'text-emerald-700 border-emerald-300 bg-emerald-50', active: 'ring-2 ring-emerald-500 border-emerald-500' },
                    { value: 'BREAK_START', label: 'Saída Intervalo', color: 'text-amber-700 border-amber-300 bg-amber-50', active: 'ring-2 ring-amber-500 border-amber-500' },
                    { value: 'BREAK_END', label: 'Retorno Intervalo', color: 'text-blue-700 border-blue-300 bg-blue-50', active: 'ring-2 ring-blue-500 border-blue-500' },
                    { value: 'EXIT', label: 'Saída', color: 'text-red-700 border-red-300 bg-red-50', active: 'ring-2 ring-red-500 border-red-500' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setManualPunchType(opt.value)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${opt.color} ${manualPunchType === opt.value ? opt.active : 'opacity-60 hover:opacity-100'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Justificativa <span className="text-red-500">*</span>
                  <span className="text-slate-400 font-normal ml-1">(obrigatória)</span>
                </label>
                <textarea
                  value={manualPunchReason}
                  onChange={(e) => setManualPunchReason(e.target.value)}
                  placeholder="Descreva o motivo do lançamento manual (ex: esqueceu de bater o ponto, sistema offline, etc.)"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{manualPunchReason.length}/200 caracteres</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => setManualPunchModal(false)}
                disabled={manualPunchLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitManualPunch}
                disabled={manualPunchLoading || !manualPunchReason.trim()}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {manualPunchLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Registrar Batida
                  </>
                )}
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
