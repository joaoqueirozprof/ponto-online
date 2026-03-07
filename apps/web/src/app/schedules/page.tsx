'use client';

import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Schedule {
  id: string;
  name: string;
  type: string;
  branch: { id: string; name: string };
  entries: number;
  branchId: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  branch: { id: string; name: string };
  branchId: string;
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

export default function SchedulesPage() {
  const [activeTab, setActiveTab] = useState<'schedules' | 'holidays'>('schedules');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'schedule' | 'holiday' | null;
    id: string | null;
  }>({
    isOpen: false,
    type: null,
    id: null,
  });

  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    type: 'FIXED',
    branchId: '',
  });

  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    type: 'NATIONAL',
    branchId: '',
  });

  // Toast helper
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (activeTab === 'schedules') fetchSchedules();
    else fetchHolidays();
  }, [activeTab, currentPage, debouncedSearch]);

  const fetchBranches = async () => {
    try {
      const response = await apiClient.get('/branches', { params: { take: 999 } });
      setBranches(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar filiais', error);
      addToast('Erro ao carregar filiais', 'error');
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await apiClient.get('/schedules', { params });
      setSchedules(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      console.error(error);
      addToast('Erro ao carregar escalas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const response = await apiClient.get('/holidays', { params: { skip, take: pageSize } });
      setHolidays(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      console.error(error);
      addToast('Erro ao carregar feriados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchedule = () => {
    setEditingId(null);
    setScheduleForm({
      name: '',
      type: 'FIXED',
      branchId: '',
    });
    setShowModal(true);
  };

  const handleAddHoliday = () => {
    setEditingId(null);
    setHolidayForm({
      name: '',
      date: '',
      type: 'NATIONAL',
      branchId: '',
    });
    setShowModal(true);
  };

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiClient.patch(`/schedules/${editingId}`, scheduleForm);
        addToast('Escala atualizada com sucesso', 'success');
      } else {
        await apiClient.post('/schedules', scheduleForm);
        addToast('Escala criada com sucesso', 'success');
      }
      setShowModal(false);
      setCurrentPage(1);
      fetchSchedules();
    } catch (error) {
      console.error(error);
      addToast('Erro ao salvar escala', 'error');
    }
  };

  const handleSubmitHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiClient.patch(`/holidays/${editingId}`, holidayForm);
        addToast('Feriado atualizado com sucesso', 'success');
      } else {
        await apiClient.post('/holidays', holidayForm);
        addToast('Feriado criado com sucesso', 'success');
      }
      setShowModal(false);
      setCurrentPage(1);
      fetchHolidays();
    } catch (error) {
      console.error(error);
      addToast('Erro ao salvar feriado', 'error');
    }
  };

  const handleEditSchedule = (schedule: any) => {
    setEditingId(schedule.id);
    setScheduleForm({
      name: schedule.name,
      type: schedule.type,
      branchId: schedule.branchId || schedule.branch?.id || '',
    });
    setShowModal(true);
  };

  const handleEditHoliday = (holiday: any) => {
    setEditingId(holiday.id);
    setHolidayForm({
      name: holiday.name,
      date: holiday.date ? holiday.date.split('T')[0] : '',
      type: holiday.type,
      branchId: holiday.branchId || holiday.branch?.id || '',
    });
    setShowModal(true);
  };

  const handleDeleteSchedule = (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'schedule',
      id,
    });
  };

  const handleDeleteHoliday = (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'holiday',
      id,
    });
  };

  const confirmDelete = async () => {
    const { type, id } = deleteConfirm;
    if (!id) return;

    try {
      if (type === 'schedule') {
        await apiClient.delete(`/schedules/${id}`);
        addToast('Escala deletada com sucesso', 'success');
        fetchSchedules();
      } else if (type === 'holiday') {
        await apiClient.delete(`/holidays/${id}`);
        addToast('Feriado deletado com sucesso', 'success');
        fetchHolidays();
      }
    } catch (error) {
      console.error(error);
      addToast('Erro ao deletar', 'error');
    } finally {
      setDeleteConfirm({
        isOpen: false,
        type: null,
        id: null,
      });
    }
  };

  const scheduleColumns = [
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Tipo' },
    {
      key: 'branch',
      label: 'Filial',
      render: (branch: Branch) => branch?.name || '-',
    },
    { key: 'entries', label: 'Registros' },
    {
      key: 'id',
      label: 'Ações',
      render: (id: string, row: any) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEditSchedule(row)}
            className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
          >
            Editar
          </button>
          <button
            onClick={() => handleDeleteSchedule(id)}
            className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
          >
            Deletar
          </button>
        </div>
      ),
    },
  ];

  const holidayColumns = [
    { key: 'name', label: 'Nome' },
    {
      key: 'date',
      label: 'Data',
      render: (date: string) => new Date(date).toLocaleDateString('pt-BR'),
    },
    { key: 'type', label: 'Tipo' },
    {
      key: 'branch',
      label: 'Filial',
      render: (branch: Branch) => branch?.name || '-',
    },
    {
      key: 'id',
      label: 'Ações',
      render: (id: string, row: any) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEditHoliday(row)}
            className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
          >
            Editar
          </button>
          <button
            onClick={() => handleDeleteHoliday(id)}
            className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
          >
            Deletar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
            Escalas e Feriados
          </h1>
          <p className="text-slate-500 mt-2">Gerencie as escalas de trabalho e feriados da empresa</p>
        </div>
      </div>

      {/* Modern Tabs with pill-style design */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => {
            setActiveTab('schedules');
            setCurrentPage(1);
          }}
          className={`px-6 py-2.5 font-medium text-sm rounded-lg transition-all duration-200 ${
            activeTab === 'schedules'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10m7 8H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z"
              />
            </svg>
            Escalas
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab('holidays');
            setCurrentPage(1);
          }}
          className={`px-6 py-2.5 font-medium text-sm rounded-lg transition-all duration-200 ${
            activeTab === 'holidays'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Feriados
          </span>
        </button>
      </div>

      {/* Search + Add Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={activeTab === 'schedules' ? 'Buscar escalas por nome...' : 'Buscar feriados por nome...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>
        <button
          onClick={activeTab === 'schedules' ? handleAddSchedule : handleAddHoliday}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:shadow-lg hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar {activeTab === 'schedules' ? 'Escala' : 'Feriado'}
        </button>
      </div>

      {/* Data Tables */}
      {activeTab === 'schedules' && (
        <DataTable
          columns={scheduleColumns}
          data={schedules}
          loading={loading}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setCurrentPage((p) => p + 1)}
        />
      )}

      {activeTab === 'holidays' && (
        <DataTable
          columns={holidayColumns}
          data={holidays}
          loading={loading}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setCurrentPage((p) => p + 1)}
        />
      )}

      {/* Form Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          activeTab === 'schedules'
            ? editingId
              ? 'Editar Escala'
              : 'Nova Escala'
            : editingId
              ? 'Editar Feriado'
              : 'Novo Feriado'
        }
        size="md"
      >
        {activeTab === 'schedules' ? (
          <form onSubmit={handleSubmitSchedule} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nome da Escala</label>
              <input
                type="text"
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                placeholder="Ex: Escala A"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Escala</label>
              <select
                value={scheduleForm.type}
                onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              >
                <option value="FIXED">Fixo</option>
                <option value="ROTATING">Rotativo</option>
                <option value="FLEXIBLE">Flexível</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Filial</label>
              <select
                value={scheduleForm.branchId}
                onChange={(e) => setScheduleForm({ ...scheduleForm, branchId: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                Salvar
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitHoliday} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Feriado</label>
              <input
                type="text"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                placeholder="Ex: Natal"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Data</label>
              <input
                type="date"
                value={holidayForm.date}
                onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Feriado</label>
              <select
                value={holidayForm.type}
                onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              >
                <option value="NATIONAL">Nacional</option>
                <option value="STATE">Estadual</option>
                <option value="MUNICIPAL">Municipal</option>
                <option value="COMPANY">Empresa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Filial (opcional)</label>
              <select
                value={holidayForm.branchId}
                onChange={(e) => setHolidayForm({ ...holidayForm, branchId: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="">Todas as filiais</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                Salvar
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() =>
          setDeleteConfirm({
            isOpen: false,
            type: null,
            id: null,
          })
        }
        title="Confirmar exclusão"
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4v2m0 0v2m0-6v-2m0 0V7a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h6a2 2 0 012 2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900">
                Deseja deletar este {deleteConfirm.type === 'schedule' ? 'escala' : 'feriado'}?
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Esta ação não pode ser desfeita. {deleteConfirm.type === 'schedule' ? 'A escala' : 'O feriado'} será
                removido permanentemente.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() =>
                setDeleteConfirm({
                  isOpen: false,
                  type: null,
                  id: null,
                })
              }
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
            >
              Deletar
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white animate-in slide-in-from-right-full fade-in duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-600'
                : toast.type === 'error'
                  ? 'bg-red-600'
                  : 'bg-blue-600'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
