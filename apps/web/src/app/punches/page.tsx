'use client';

import DataTable from '@/components/DataTable';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface RawPunch {
  id: string;
  deviceName: string;
  employeeName: string;
  timestamp: string;
  recordedAt: string;
}

interface NormalizedPunch {
  id: string;
  employeeName: string;
  timestamp: string;
  type: string;
  status: string;
  recordedAt: string;
}

interface Adjustment {
  id: string;
  employeeName: string;
  date: string;
  originalTime: string;
  adjustedTime: string;
  reason: string;
  recordedAt: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function PunchesPage() {
  const [activeTab, setActiveTab] = useState<'raw' | 'normalized' | 'adjustments'>('raw');
  const [rawPunches, setRawPunches] = useState<RawPunch[]>([]);
  const [normalizedPunches, setNormalizedPunches] = useState<NormalizedPunch[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  const [filterEmployee, setFilterEmployee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (activeTab === 'raw') fetchRawPunches();
    else if (activeTab === 'normalized') fetchNormalizedPunches();
    else fetchAdjustments();
  }, [activeTab, currentPage, filterEmployee, startDate, endDate]);

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
    return new Date(date).toLocaleString('pt-BR');
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold';
    switch (status) {
      case 'approved':
        return (
          <span className={`${baseClasses} bg-emerald-100 text-emerald-700`}>
            Aprovado
          </span>
        );
      case 'pending':
        return (
          <span className={`${baseClasses} bg-amber-100 text-amber-700`}>
            Pendente
          </span>
        );
      case 'rejected':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-700`}>
            Rejeitado
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-slate-100 text-slate-700`}>
            {status}
          </span>
        );
    }
  };

  const rawColumns = [
    { key: 'deviceName', label: 'Dispositivo' },
    { key: 'employeeName', label: 'Colaborador' },
    { key: 'timestamp', label: 'Horário', render: (val: string) => formatDateTime(val) },
  ];

  const normalizedColumns = [
    { key: 'employeeName', label: 'Colaborador' },
    { key: 'timestamp', label: 'Horário', render: (val: string) => formatDateTime(val) },
    { key: 'type', label: 'Tipo' },
    {
      key: 'status',
      label: 'Status',
      render: (status: string) => getStatusBadge(status),
    },
  ];

  const adjustmentColumns = [
    { key: 'employeeName', label: 'Colaborador' },
    { key: 'date', label: 'Data', render: (val: string) => formatDate(val) },
    { key: 'originalTime', label: 'Horário Original' },
    { key: 'adjustedTime', label: 'Horário Ajustado' },
    { key: 'reason', label: 'Motivo' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animation-slideIn ${
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

      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Registros de Ponto</h1>
          <p className="text-slate-400">Visualize e gerencie todos os registros de ponto</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 bg-slate-800 rounded-xl p-1 inline-flex">
          {(['raw', 'normalized', 'adjustments'] as const).map((tab) => {
            const labels = {
              raw: 'Registros Brutos',
              normalized: 'Registros Normalizados',
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
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Filters Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
          <h2 className="text-slate-200 font-semibold mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Employee Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Colaborador
              </label>
              <select
                value={filterEmployee}
                onChange={(e) => {
                  setFilterEmployee(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              >
                <option value="">Todos os colaboradores</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date Filter - Only for Raw and Normalized tabs */}
            {(activeTab === 'raw' || activeTab === 'normalized') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  />
                </div>

                {/* End Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Data Table Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
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
