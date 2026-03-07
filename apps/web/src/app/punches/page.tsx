'use client';

import DataTable from '@/components/DataTable';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface RawPunch {
  id: string;
  punchTime: string;
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

const PUNCH_TYPE_PT: Record<string, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Saída',
  BREAK_START: 'Início Intervalo',
  BREAK_END: 'Fim Intervalo',
};

const PUNCH_STATUS_PT: Record<string, string> = {
  ORIGINAL: 'Original',
  ADJUSTED: 'Ajustado',
  MANUAL: 'Manual',
  DELETED: 'Excluído',
};

interface PunchSummary {
  totalToday: number;
  uniqueEmployees: number;
  entriesCount: number;
  exitsCount: number;
}

export default function PunchesPage() {
  const [activeTab, setActiveTab] = useState<'raw' | 'normalized' | 'adjustments'>('raw');
  const [rawPunches, setRawPunches] = useState<RawPunch[]>([]);
  const [normalizedPunches, setNormalizedPunches] = useState<NormalizedPunch[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;
  const [filterEmployee, setFilterEmployee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [summary, setSummary] = useState<PunchSummary>({ totalToday: 0, uniqueEmployees: 0, entriesCount: 0, exitsCount: 0 });

  useEffect(() => {
    fetchEmployees();
    fetchSummary();
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
        totalToday: rawRes.data.total || rawData.length,
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
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'raw') fetchRawPunches();
    else if (activeTab === 'normalized') fetchNormalizedPunches();
    else fetchAdjustments();
  }, [activeTab, currentPage, filterEmployee, startDate, endDate, debouncedSearch]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
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
      return new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch {
      return '-';
    }
  };

  const formatTime = (date: string) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold';
    const label = PUNCH_STATUS_PT[status] || status;
    switch (status) {
      case 'ORIGINAL':
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
    const baseClasses = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold';
    const label = PUNCH_TYPE_PT[type] || type;
    switch (type) {
      case 'ENTRY':
        return <span className={`${baseClasses} bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300`}>{label}</span>;
      case 'EXIT':
        return <span className={`${baseClasses} bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300`}>{label}</span>;
      case 'BREAK_START':
        return <span className={`${baseClasses} bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300`}>{label}</span>;
      case 'BREAK_END':
        return <span className={`${baseClasses} bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300`}>{label}</span>;
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
      key: 'punchTime',
      label: 'Horário',
      render: (_: any, row: RawPunch) => (
        <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
          {formatDateTime(row.punchTime)}
        </div>
      ),
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
      key: 'punchTime',
      label: 'Horário',
      render: (_: any, row: NormalizedPunch) => (
        <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
          {formatDateTime(row.punchTime)}
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
        <div className="text-sm font-mono text-red-600 dark:text-red-400">
          {formatDateTime(row.originalTime)}
        </div>
      ),
    },
    {
      key: 'newTime',
      label: 'Novo Horário',
      render: (_: any, row: Adjustment) => (
        <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
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
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Registros de Ponto</h1>
          <p className="text-base text-slate-600 dark:text-slate-400">Visualize e gerencie todos os registros de ponto</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Registros Hoje', value: summary.totalToday, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
            { label: 'Colaboradores Presentes', value: summary.uniqueEmployees, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Entradas', value: summary.entriesCount, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label: 'Saídas', value: summary.exitsCount, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} ${card.border} border rounded-xl p-4 text-center`}>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-slate-500 mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shadow-sm inline-flex">
          {(['raw', 'normalized', 'adjustments'] as const).map((tab) => {
            const labels = {
              raw: 'Registros Brutos',
              normalized: 'Normalizados',
              adjustments: 'Ajustes',
            };
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setCurrentPage(1);
                }}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Filters Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Filtros</h2>
          <div className="space-y-4">
            {/* Search Input */}
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

            {/* Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Employee Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                Colaborador
              </label>
              <select
                value={filterEmployee}
                onChange={(e) => {
                  setFilterEmployee(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                <option value="">Todos os colaboradores</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date Filter */}
            {(activeTab === 'raw' || activeTab === 'normalized') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </>
            )}
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

          {activeTab === 'normalized' && (
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
    </div>
  );
}
