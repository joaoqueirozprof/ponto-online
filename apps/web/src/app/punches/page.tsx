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
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (activeTab === 'raw') fetchRawPunches();
    else if (activeTab === 'normalized') fetchNormalizedPunches();
    else fetchAdjustments();
  }, [activeTab, currentPage, filterEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await apiClient.get('/employees', { params: { take: 999 } });
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar colaboradores', error);
    }
  };

  const fetchRawPunches = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (filterEmployee) params.employeeId = filterEmployee;
      const response = await apiClient.get('/punches/raw', { params });
      setRawPunches(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Erro ao carregar registros brutos');
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
      const response = await apiClient.get('/punches/normalized', { params });
      setNormalizedPunches(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Erro ao carregar registros normalizados');
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
      alert('Erro ao carregar ajustes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR');
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
      render: (status: string) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            status === 'approved'
              ? 'bg-emerald-50 text-emerald-700'
              : status === 'pending'
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-red-50 text-red-700'
          }`}
        >
          {status === 'approved' ? 'Aprovado' : status === 'pending' ? 'Pendente' : 'Rejeitado'}
        </span>
      ),
    },
  ];

  const adjustmentColumns = [
    { key: 'employeeName', label: 'Colaborador' },
    { key: 'date', label: 'Data', render: (val: string) => new Date(val).toLocaleDateString('pt-BR') },
    { key: 'originalTime', label: 'Horário Original' },
    { key: 'adjustedTime', label: 'Horário Ajustado' },
    { key: 'reason', label: 'Motivo' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Registros de Ponto</h1>
        <p className="text-slate-500 mt-1">Visualize e gerencie todos os registros de ponto</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('raw');
            setCurrentPage(1);
          }}
          className={`px-6 py-3 font-medium text-sm transition-colors duration-200 border-b-2 ${
            activeTab === 'raw'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-600 border-transparent hover:text-slate-800'
          }`}
        >
          Registros Brutos
        </button>
        <button
          onClick={() => {
            setActiveTab('normalized');
            setCurrentPage(1);
          }}
          className={`px-6 py-3 font-medium text-sm transition-colors duration-200 border-b-2 ${
            activeTab === 'normalized'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-600 border-transparent hover:text-slate-800'
          }`}
        >
          Registros Normalizados
        </button>
        <button
          onClick={() => {
            setActiveTab('adjustments');
            setCurrentPage(1);
          }}
          className={`px-6 py-3 font-medium text-sm transition-colors duration-200 border-b-2 ${
            activeTab === 'adjustments'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-600 border-transparent hover:text-slate-800'
          }`}
        >
          Ajustes
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Filtrar por Colaborador</label>
            <select
              value={filterEmployee}
              onChange={(e) => {
                setFilterEmployee(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos os colaboradores</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Data Tables */}
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
  );
}
