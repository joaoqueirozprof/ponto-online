'use client';

import DataTable from '@/components/DataTable';
import { apiClient } from '@/lib/api';
import { useEffect, useState, useMemo } from 'react';

interface RawPunch {
  id: string;
  punchTime: string;
  source?: string;
  device: { id: string; name: string } | null;
  employee: { id: string; name: string; cpf: string } | null;
}

interface NormalizedPunch {
  id: string;
  punchTime: string;
  punchType: string;
  status: string;
  employee: { id: string; name: string } | null;
}

interface Adjustment {
  id: string;
  originalTime: string;
  newTime: string;
  reason: string;
  createdAt: string;
  employee: { id: string; name: string } | null;
  normalizedPunch: { id: string; punchTime: string } | null;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface GroupedPunch {
  key: string;
  employeeName: string;
  employeeId: string;
  date: string;
  dayOfWeek: string;
  entry: NormalizedPunch | null;
  breakStart: NormalizedPunch | null;
  breakEnd: NormalizedPunch | null;
  exit: NormalizedPunch | null;
}

const PUNCH_TYPE_PT: Record<string, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Saída',
  BREAK_START: 'Saída Intervalo',
  BREAK_END: 'Retorno Intervalo',
};

const PUNCH_STATUS_PT: Record<string, string> = {
  ORIGINAL: 'Original',
  ADJUSTED: 'Ajustado',
  MANUAL: 'Manual',
  DELETED: 'Excluído',
  NORMAL: 'Normal',
};

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface PunchSummary {
  totalToday: number;
  uniqueEmployees: number;
  entriesCount: number;
  exitsCount: number;
}

export default function PunchesPage() {
  const [activeTab, setActiveTab] = useState<'raw' | 'normalized' | 'adjustments'>('normalized');
  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped');
  const [rawPunches, setRawPunches] = useState<RawPunch[]>([]);
  const [normalizedPunches, setNormalizedPunches] = useState<NormalizedPunch[]>([]);
  const [allNormalizedForGrouping, setAllNormalizedForGrouping] = useState<NormalizedPunch[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;
  const groupedPageSize = 20;
  const [filterEmployee, setFilterEmployee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [summary, setSummary] = useState<PunchSummary>({ totalToday: 0, uniqueEmployees: 0, entriesCount: 0, exitsCount: 0 });
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    time: '',
    punchType: 'ENTRY',
    reason: '',
  });
  const [submittingManual, setSubmittingManual] = useState(false);
  const [groupedPage, setGroupedPage] = useState(1);

  // Edit/Adjust state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPunch, setEditingPunch] = useState<NormalizedPunch | null>(null);
  const [editForm, setEditForm] = useState({
    newDate: '',
    newTime: '',
    reason: '',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchSummary();
    // Default: set date range to last 7 days for grouped view
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (!startDate) setStartDate(weekAgo.toISOString().slice(0, 10));
    if (!endDate) setEndDate(today.toISOString().slice(0, 10));
  }, []);

  const fetchSummary = async () => {
    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const [rawRes, normRes] = await Promise.all([
        apiClient.get('/punches/raw', { params: { take: 500, startDate: todayStr, endDate: todayStr } }).catch(() => ({ data: { data: [], total: 0 } })),
        apiClient.get('/punches/normalized', { params: { take: 500, startDate: todayStr, endDate: todayStr } }).catch(() => ({ data: { data: [] } })),
      ]);
      const rawData = rawRes.data.data || [];
      const normData = normRes.data.data || [];
      const uniqueEmps = new Set(rawData.map((p: any) => p.employee?.id).filter(Boolean));
      const entries = normData.filter((p: any) => p.punchType === 'ENTRY').length;
      const exits = normData.filter((p: any) => p.punchType === 'EXIT').length;
      setSummary({
        totalToday: rawData.length,
        uniqueEmployees: uniqueEmps.size,
        entriesCount: entries,
        exitsCount: exits,
      });
    } catch (err) {
      console.error('Erro ao carregar resumo', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
      setGroupedPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'raw') fetchRawPunches();
    else if (activeTab === 'normalized') {
      if (viewMode === 'individual') {
        fetchNormalizedPunches();
      } else {
        fetchGroupedPunches();
      }
    }
    else fetchAdjustments();
  }, [activeTab, currentPage, filterEmployee, startDate, endDate, debouncedSearch, viewMode]);

  // Re-fetch grouped when grouped page changes
  useEffect(() => {
    if (activeTab === 'normalized' && viewMode === 'grouped') {
      // No need to re-fetch, pagination is client-side on allNormalizedForGrouping
    }
  }, [groupedPage]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleManualSubmit = async () => {
    if (!manualForm.employeeId || !manualForm.date || !manualForm.time || !manualForm.reason) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    setSubmittingManual(true);
    try {
      const punchTime = new Date(`${manualForm.date}T${manualForm.time}:00`).toISOString();
      await apiClient.post('/punches/manual', {
        employeeId: manualForm.employeeId,
        punchTime,
        punchType: manualForm.punchType,
        reason: manualForm.reason,
        createdBy: 'admin',
      });
      showToast('Registro manual criado com sucesso!', 'success');
      setShowManualModal(false);
      setManualForm({ employeeId: '', date: new Date().toISOString().slice(0, 10), time: '', punchType: 'ENTRY', reason: '' });
      if (activeTab === 'raw') fetchRawPunches();
      else if (activeTab === 'normalized') {
        if (viewMode === 'grouped') fetchGroupedPunches();
        else fetchNormalizedPunches();
      }
      fetchSummary();
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Erro ao criar registro manual', 'error');
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingPunch || !editForm.newDate || !editForm.newTime || !editForm.reason) {
      showToast('Preencha todos os campos para o ajuste', 'error');
      return;
    }
    setSubmittingEdit(true);
    try {
      const newTime = new Date(`${editForm.newDate}T${editForm.newTime}:00`).toISOString();
      await apiClient.post(`/punches/${editingPunch.id}/adjust`, {
        newTime,
        reason: editForm.reason,
        adjustedBy: 'admin',
      });
      showToast('Batida ajustada com sucesso!', 'success');
      setShowEditModal(false);
      setEditingPunch(null);
      setEditForm({ newDate: '', newTime: '', reason: '' });
      if (viewMode === 'grouped') fetchGroupedPunches();
      else fetchNormalizedPunches();
      fetchAdjustments();
      fetchSummary();
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Erro ao ajustar batida', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const openEditModal = (punch: NormalizedPunch) => {
    const d = new Date(punch.punchTime);
    const brDate = d.toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' });
    const brTime = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hour12: false });
    setEditingPunch(punch);
    setEditForm({
      newDate: brDate,
      newTime: brTime,
      reason: '',
    });
    setShowEditModal(true);
  };

  const fetchEmployees = async () => {
    try {
      const response = await apiClient.get('/employees', { params: { take: 999 } });
      setEmployees(response.data.data || []);
    } catch (error) {
      showToast('Erro ao carregar colaboradores', 'error');
      console.error('Erro ao carregar colaboradores', error);
    }
  };

  const fetchRawPunches = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (filterEmployee) params.employeeId = filterEmployee;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await apiClient.get('/punches/raw', { params });
      setRawPunches(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      showToast('Erro ao carregar registros brutos', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNormalizedPunches = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (filterEmployee) params.employeeId = filterEmployee;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await apiClient.get('/punches/normalized', { params });
      setNormalizedPunches(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      showToast('Erro ao carregar registros normalizados', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupedPunches = async () => {
    try {
      setLoading(true);
      // Fetch a larger batch for grouping (all punches in date range)
      const params: any = { skip: 0, take: 5000 };
      if (filterEmployee) params.employeeId = filterEmployee;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await apiClient.get('/punches/normalized', { params });
      setAllNormalizedForGrouping(response.data.data || []);
    } catch (error) {
      showToast('Erro ao carregar registros agrupados', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Group punches by employee + date
  const groupedPunches = useMemo<GroupedPunch[]>(() => {
    const map = new Map<string, GroupedPunch>();

    for (const punch of allNormalizedForGrouping) {
      if (!punch.employee) continue;
      const d = new Date(punch.punchTime);
      const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' });
      const key = `${punch.employee.id}_${dateStr}`;

      if (!map.has(key)) {
        const localDate = new Date(dateStr + 'T12:00:00');
        map.set(key, {
          key,
          employeeName: punch.employee.name,
          employeeId: punch.employee.id,
          date: dateStr,
          dayOfWeek: DAY_NAMES[localDate.getDay()],
          entry: null,
          breakStart: null,
          breakEnd: null,
          exit: null,
        });
      }

      const group = map.get(key)!;
      switch (punch.punchType) {
        case 'ENTRY':
          if (!group.entry) group.entry = punch;
          break;
        case 'BREAK_START':
          if (!group.breakStart) group.breakStart = punch;
          break;
        case 'BREAK_END':
          if (!group.breakEnd) group.breakEnd = punch;
          break;
        case 'EXIT':
          if (!group.exit) group.exit = punch;
          break;
      }
    }

    // Sort by date desc, then employee name asc
    return Array.from(map.values()).sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return a.employeeName.localeCompare(b.employeeName);
    });
  }, [allNormalizedForGrouping]);

  // Paginated grouped data
  const paginatedGrouped = useMemo(() => {
    const start = (groupedPage - 1) * groupedPageSize;
    return groupedPunches.slice(start, start + groupedPageSize);
  }, [groupedPunches, groupedPage]);

  const totalGroupedPages = Math.ceil(groupedPunches.length / groupedPageSize);

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (filterEmployee) params.employeeId = filterEmployee;
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await apiClient.get('/punches/adjustments', { params });
      setAdjustments(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      showToast('Erro ao carregar ajustes', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: string) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
    } catch {
      return '-';
    }
  };

  const formatDateOnly = (date: string) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
    } catch {
      return '-';
    }
  };

  const formatTimeOnly = (date: string) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Fortaleza',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return '-';
    }
  };

  const formatTimeShort = (date: string) => {
    if (!date) return '--:--';
    try {
      return new Date(date).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Fortaleza',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return '--:--';
    }
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold';
    const label = PUNCH_STATUS_PT[status] || status;
    switch (status) {
      case 'ORIGINAL': case 'NORMAL':
        return <span className={`${baseClasses} bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300`}>{label}</span>;
      case 'ADJUSTED':
        return <span className={`${baseClasses} bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300`}>{label}</span>;
      case 'MANUAL':
        return <span className={`${baseClasses} bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300`}>{label}</span>;
      case 'DELETED':
        return <span className={`${baseClasses} bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300`}>{label}</span>;
      default:
        return <span className={`${baseClasses} bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300`}>{label}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    const baseClasses = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold';
    const label = PUNCH_TYPE_PT[type] || type;
    switch (type) {
      case 'ENTRY':
        return <span className={`${baseClasses} bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300`}>&#x2192; {label}</span>;
      case 'EXIT':
        return <span className={`${baseClasses} bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300`}>&#x2190; {label}</span>;
      case 'BREAK_START':
        return <span className={`${baseClasses} bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300`}>&#x23F8; {label}</span>;
      case 'BREAK_END':
        return <span className={`${baseClasses} bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300`}>&#x25B6; {label}</span>;
      default:
        return <span className={`${baseClasses} bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300`}>{label}</span>;
    }
  };

  const rawColumns = [
    {
      key: 'employee',
      label: 'Colaborador',
      render: (_: any, row: RawPunch) => (
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {row.employee?.name || '-'}
        </div>
      ),
    },
    {
      key: 'device',
      label: 'Dispositivo',
      render: (_: any, row: RawPunch) => (
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {row.device?.name || '-'}
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Data',
      render: (_: any, row: RawPunch) => (
        <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
          {formatDateOnly(row.punchTime)}
        </div>
      ),
    },
    {
      key: 'punchTime',
      label: 'Horário',
      render: (_: any, row: RawPunch) => (
        <div className="text-sm font-mono font-semibold text-indigo-700 dark:text-indigo-300">
          {formatTimeOnly(row.punchTime)}
        </div>
      ),
    },
    {
      key: 'source',
      label: 'Fonte',
      render: (_: any, row: RawPunch) => {
        const isManual = row.source === 'MANUAL' || row.device?.name === 'Registro Manual';
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            isManual
              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
              : 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300'
          }`}>
            {isManual ? '✍ Manual' : '📟 REP'}
          </span>
        );
      },
    },
  ];

  const normalizedColumns = [
    {
      key: 'employee',
      label: 'Colaborador',
      render: (_: any, row: NormalizedPunch) => (
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {row.employee?.name || '-'}
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Data',
      render: (_: any, row: NormalizedPunch) => (
        <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
          {formatDateOnly(row.punchTime)}
        </div>
      ),
    },
    {
      key: 'punchTime',
      label: 'Horário',
      render: (_: any, row: NormalizedPunch) => (
        <div className="text-sm font-mono font-semibold text-indigo-700 dark:text-indigo-300">
          {formatTimeOnly(row.punchTime)}
        </div>
      ),
    },
    {
      key: 'punchType',
      label: 'Tipo',
      render: (_: any, row: NormalizedPunch) => getTypeBadge(row.punchType),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: any, row: NormalizedPunch) => getStatusBadge(row.status),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_: any, row: NormalizedPunch) => (
        <button
          onClick={(e) => { e.stopPropagation(); openEditModal(row); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
          title="Editar / Ajustar batida"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </button>
      ),
    },
  ];

  const adjustmentColumns = [
    {
      key: 'employee',
      label: 'Colaborador',
      render: (_: any, row: Adjustment) => (
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {row.employee?.name || '-'}
        </div>
      ),
    },
    {
      key: 'originalTime',
      label: 'Horário Original',
      render: (_: any, row: Adjustment) => (
        <div className="text-sm font-mono text-red-600 dark:text-red-400 line-through">
          {formatDateTime(row.originalTime)}
        </div>
      ),
    },
    {
      key: 'newTime',
      label: 'Novo Horário',
      render: (_: any, row: Adjustment) => (
        <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
          {formatDateTime(row.newTime)}
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Motivo',
      render: (_: any, row: Adjustment) => (
        <div className="text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
          {row.reason || '-'}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Data Ajuste',
      render: (_: any, row: Adjustment) => (
        <div className="text-sm font-mono text-slate-500 dark:text-slate-400">
          {formatDateTime(row.createdAt)}
        </div>
      ),
    },
  ];

  // Render a clickable time cell for grouped view
  const renderTimeCell = (punch: NormalizedPunch | null, colorClass: string) => {
    if (!punch) {
      return <span className="text-slate-300 dark:text-slate-600 font-mono text-sm">--:--</span>;
    }
    return (
      <button
        onClick={(e) => { e.stopPropagation(); openEditModal(punch); }}
        className={`font-mono text-sm font-semibold ${colorClass} hover:underline cursor-pointer transition-colors`}
        title={`Clique para editar - ${PUNCH_TYPE_PT[punch.punchType] || punch.punchType}`}
      >
        {formatTimeShort(punch.punchTime)}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-red-500'
                : toast.type === 'success'
                  ? 'bg-emerald-500'
                  : 'bg-blue-500'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Registros de Ponto</h1>
            <p className="text-base text-slate-600 dark:text-slate-400">Visualize e gerencie todos os registros de ponto</p>
          </div>
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg font-medium text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Registro Manual
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Registros Hoje', value: summary.totalToday, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', icon: '📋' },
            { label: 'Colaboradores Presentes', value: summary.uniqueEmployees, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: '👥' },
            { label: 'Entradas', value: summary.entriesCount, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: '→' },
            { label: 'Saídas', value: summary.exitsCount, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: '←' },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} ${card.border} border rounded-xl p-4 text-center`}>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-slate-500 mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shadow-sm inline-flex">
            {(['normalized', 'raw', 'adjustments'] as const).map((tab) => {
              const labels = { raw: 'Registros Brutos', normalized: 'Batidas', adjustments: 'Ajustes' };
              const icons = { raw: '📟', normalized: '⏱', adjustments: '✏️' };
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setCurrentPage(1); setGroupedPage(1); }}
                  className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                    activeTab === tab
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{icons[tab]}</span>
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle - only for Batidas tab */}
          {activeTab === 'normalized' && (
            <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                onClick={() => { setViewMode('grouped'); setGroupedPage(1); }}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'grouped'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                📊 Agrupado
              </button>
              <button
                onClick={() => { setViewMode('individual'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'individual'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                📋 Individual
              </button>
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Filtros</h2>
          <div className="space-y-4">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nome do funcionário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Colaborador</label>
                <select
                  value={filterEmployee}
                  onChange={(e) => { setFilterEmployee(e.target.value); setCurrentPage(1); setGroupedPage(1); }}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                >
                  <option value="">Todos os colaboradores</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Data Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); setGroupedPage(1); }}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); setGroupedPage(1); }}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {activeTab === 'raw' && (
            <DataTable
              columns={rawColumns}
              data={rawPunches}
              loading={loading}
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
              onNextPage={() => setCurrentPage((p) => p + 1)}
            />
          )}

          {activeTab === 'normalized' && viewMode === 'individual' && (
            <DataTable
              columns={normalizedColumns}
              data={normalizedPunches}
              loading={loading}
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
              onNextPage={() => setCurrentPage((p) => p + 1)}
            />
          )}

          {activeTab === 'normalized' && viewMode === 'grouped' && (
            <div>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-slate-400 text-sm">Carregando...</div>
                </div>
              ) : paginatedGrouped.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-slate-400 text-sm">Nenhum registro encontrado no período selecionado</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Colaborador</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dia</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            <span className="flex items-center justify-center gap-1">→ Entrada</span>
                          </th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            <span className="flex items-center justify-center gap-1">⏸ Saída Int.</span>
                          </th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            <span className="flex items-center justify-center gap-1">▶ Retorno</span>
                          </th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                            <span className="flex items-center justify-center gap-1">← Saída</span>
                          </th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {paginatedGrouped.map((group) => {
                          const isWeekend = group.dayOfWeek === 'Dom' || group.dayOfWeek === 'Sáb';
                          const isIncomplete = group.entry && !group.exit;
                          const hasAllPunches = group.entry && group.breakStart && group.breakEnd && group.exit;
                          return (
                            <tr key={group.key} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${isWeekend ? 'bg-orange-50/30 dark:bg-orange-900/10' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                                  {group.employeeName}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{formatDateBR(group.date)}</span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                  isWeekend
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                  {group.dayOfWeek}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                {renderTimeCell(group.entry, 'text-emerald-700 dark:text-emerald-300')}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {renderTimeCell(group.breakStart, 'text-amber-700 dark:text-amber-300')}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {renderTimeCell(group.breakEnd, 'text-blue-700 dark:text-blue-300')}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {renderTimeCell(group.exit, 'text-red-700 dark:text-red-300')}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {hasAllPunches ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                    Completo
                                  </span>
                                ) : isIncomplete ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                    Incompleto
                                  </span>
                                ) : group.entry ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                    Parcial
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                                    -
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Grouped Pagination */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Página {groupedPage} de {totalGroupedPages} | Total: {groupedPunches.length} registros agrupados
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGroupedPage((p) => Math.max(1, p - 1))}
                        disabled={groupedPage <= 1}
                        className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-700 dark:text-slate-300"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setGroupedPage((p) => Math.min(totalGroupedPages, p + 1))}
                        disabled={groupedPage >= totalGroupedPages}
                        className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-700 dark:text-slate-300"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'adjustments' && (
            <DataTable
              columns={adjustmentColumns}
              data={adjustments}
              loading={loading}
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
              onNextPage={() => setCurrentPage((p) => p + 1)}
            />
          )}
        </div>
      </div>

      {/* Manual Punch Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowManualModal(false)} onKeyDown={(e) => { if (e.key === 'Escape') setShowManualModal(false); }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registro Manual de Ponto</h2>
                  <p className="text-sm text-slate-500 mt-1">Insira um registro quando o equipamento falhar ou o funcionário esquecer</p>
                </div>
                <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Colaborador *</label>
                <select
                  value={manualForm.employeeId}
                  onChange={(e) => setManualForm({ ...manualForm, employeeId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione o colaborador...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Data *</label>
                  <input type="date" value={manualForm.date} onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Horário *</label>
                  <input type="time" value={manualForm.time} onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tipo de Registro *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'ENTRY', label: 'Entrada', icon: '→', activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                    { value: 'EXIT', label: 'Saída', icon: '←', activeClass: 'border-red-500 bg-red-50 text-red-700' },
                    { value: 'BREAK_START', label: 'Saída Intervalo', icon: '⏸', activeClass: 'border-amber-500 bg-amber-50 text-amber-700' },
                    { value: 'BREAK_END', label: 'Retorno Intervalo', icon: '▶', activeClass: 'border-blue-500 bg-blue-50 text-blue-700' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setManualForm({ ...manualForm, punchType: type.value })}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                        manualForm.punchType === type.value
                          ? type.activeClass
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Motivo / Justificativa *</label>
                <textarea
                  value={manualForm.reason}
                  onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })}
                  placeholder="Ex: Equipamento fora do ar, funcionário esqueceu de registrar..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
              <button onClick={() => setShowManualModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={handleManualSubmit} disabled={submittingManual}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                {submittingManual ? 'Salvando...' : 'Registrar Ponto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Adjust Punch Modal */}
      {showEditModal && editingPunch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ajustar Batida</h2>
                  <p className="text-sm text-slate-500 mt-1">Corrija o horário de uma batida existente</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase">Registro Atual</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{editingPunch.employee?.name}</span>
                  {getTypeBadge(editingPunch.punchType)}
                </div>
                <div className="text-sm font-mono text-slate-600 dark:text-slate-300">
                  Horário atual: <strong className="text-red-600">{formatDateTime(editingPunch.punchTime)}</strong>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Novo Horário *</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Data</label>
                    <input type="date" value={editForm.newDate} onChange={(e) => setEditForm({ ...editForm, newDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Hora</label>
                    <input type="time" value={editForm.newTime} onChange={(e) => setEditForm({ ...editForm, newTime: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Motivo do Ajuste *</label>
                <textarea
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  placeholder="Ex: Horário registrado incorretamente, esqueceu de bater..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
              <button onClick={() => setShowEditModal(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={handleEditSubmit} disabled={submittingEdit}
                className="px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                {submittingEdit ? 'Salvando...' : 'Salvar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
