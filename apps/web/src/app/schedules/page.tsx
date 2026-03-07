'use client';

import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface ScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
  breakMinutes: number;
  isWorkDay: boolean;
}

interface Schedule {
  id: string;
  name: string;
  type: string;
  weeklyHours: number;
  branch: { id: string; name: string };
  scheduleEntries: ScheduleEntry[];
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

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const defaultEntries: ScheduleEntry[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  dayOfWeek: day,
  startTime: day >= 1 && day <= 5 ? '08:00' : '',
  endTime: day >= 1 && day <= 5 ? '17:00' : '',
  breakStartTime: day >= 1 && day <= 5 ? '12:00' : '',
  breakEndTime: day >= 1 && day <= 5 ? '13:00' : '',
  breakMinutes: day >= 1 && day <= 5 ? 60 : 0,
  isWorkDay: day >= 1 && day <= 5,
}));

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
    weeklyHours: 44,
  });

  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>(defaultEntries);

  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    type: 'NATIONAL',
    branchId: '',
  });

  // View entries modal
  const [viewEntriesSchedule, setViewEntriesSchedule] = useState<Schedule | null>(null);

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
      weeklyHours: 44,
    });
    setScheduleEntries(defaultEntries);
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
      const payload = {
        ...scheduleForm,
        weeklyHours: Number(scheduleForm.weeklyHours) || 44,
        scheduleEntries: scheduleEntries.map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.isWorkDay ? entry.startTime : '',
          endTime: entry.isWorkDay ? entry.endTime : '',
          breakStartTime: entry.isWorkDay ? entry.breakStartTime : '',
          breakEndTime: entry.isWorkDay ? entry.breakEndTime : '',
          breakMinutes: entry.isWorkDay ? (entry.breakMinutes || 0) : 0,
          isWorkDay: entry.isWorkDay,
        })),
      };
      if (editingId) {
        await apiClient.patch(`/schedules/${editingId}`, payload);
        addToast('Escala atualizada com sucesso', 'success');
      } else {
        await apiClient.post('/schedules', payload);
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
      weeklyHours: schedule.weeklyHours || 44,
    });
    // Load existing entries or use defaults
    if (schedule.scheduleEntries && schedule.scheduleEntries.length > 0) {
      const entries: ScheduleEntry[] = [0, 1, 2, 3, 4, 5, 6].map((day) => {
        const existing = schedule.scheduleEntries.find((e: any) => e.dayOfWeek === day);
        if (existing) {
          return {
            dayOfWeek: day,
            startTime: existing.startTime || '',
            endTime: existing.endTime || '',
            breakStartTime: existing.breakStartTime || '',
            breakEndTime: existing.breakEndTime || '',
            breakMinutes: existing.breakMinutes || 0,
            isWorkDay: existing.isWorkDay !== false,
          };
        }
        return {
          dayOfWeek: day,
          startTime: '',
          endTime: '',
          breakStartTime: '',
          breakEndTime: '',
          breakMinutes: 0,
          isWorkDay: false,
        };
      });
      setScheduleEntries(entries);
    } else {
      setScheduleEntries(defaultEntries);
    }
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
    setDeleteConfirm({ isOpen: true, type: 'schedule', id });
  };

  const handleDeleteHoliday = (id: string) => {
    setDeleteConfirm({ isOpen: true, type: 'holiday', id });
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
      setDeleteConfirm({ isOpen: false, type: null, id: null });
    }
  };

  const updateEntry = (dayOfWeek: number, field: keyof ScheduleEntry, value: any) => {
    setScheduleEntries((prev) =>
      prev.map((entry) => {
        if (entry.dayOfWeek !== dayOfWeek) return entry;
        const updated = { ...entry, [field]: value };
        // Auto-calculate break minutes when break times change
        if (field === 'breakStartTime' || field === 'breakEndTime') {
          if (updated.breakStartTime && updated.breakEndTime) {
            const [bsh, bsm] = updated.breakStartTime.split(':').map(Number);
            const [beh, bem] = updated.breakEndTime.split(':').map(Number);
            updated.breakMinutes = Math.max(0, (beh * 60 + bem) - (bsh * 60 + bsm));
          }
        }
        // If toggling workDay off, clear times
        if (field === 'isWorkDay' && !value) {
          updated.startTime = '';
          updated.endTime = '';
          updated.breakStartTime = '';
          updated.breakEndTime = '';
          updated.breakMinutes = 0;
        }
        return updated;
      })
    );
  };

  const formatEntriesSummary = (entries: any[]) => {
    if (!entries || entries.length === 0) return 'Sem horários';
    const workDays = entries.filter((e: any) => e.isWorkDay);
    if (workDays.length === 0) return 'Sem horários';
    const first = workDays[0];
    return `${workDays.length} dias - ${first.startTime || '?'} às ${first.endTime || '?'}`;
  };

  const scheduleColumns = [
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Tipo', render: (type: string) => {
      const labels: any = { FIXED: 'Fixo', ROTATING: 'Rotativo', FLEXIBLE: 'Flexível' };
      return labels[type] || type;
    }},
    {
      key: 'branch',
      label: 'Filial',
      render: (branch: Branch) => branch?.name || '-',
    },
    {
      key: 'scheduleEntries',
      label: 'Horários',
      render: (entries: any[]) => (
        <span className="text-xs text-slate-500">{formatEntriesSummary(entries)}</span>
      ),
    },
    {
      key: 'id',
      label: 'Ações',
      render: (id: string, row: any) => (
        <div className="flex gap-2">
          <button
            onClick={() => setViewEntriesSchedule(row)}
            className="px-3 py-1.5 text-sm bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors font-medium"
          >
            Ver Horários
          </button>
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
    { key: 'type', label: 'Tipo', render: (type: string) => {
      const labels: any = { NATIONAL: 'Nacional', STATE: 'Estadual', MUNICIPAL: 'Municipal', COMPANY: 'Empresa' };
      return labels[type] || type;
    }},
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

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setActiveTab('schedules'); setCurrentPage(1); }}
          className={`px-6 py-2.5 font-medium text-sm rounded-lg transition-all duration-200 ${
            activeTab === 'schedules'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m7 8H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z" />
            </svg>
            Escalas
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('holidays'); setCurrentPage(1); }}
          className={`px-6 py-2.5 font-medium text-sm rounded-lg transition-all duration-200 ${
            activeTab === 'holidays'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

      {/* Schedule Form Modal */}
      <Modal
        isOpen={showModal && activeTab === 'schedules'}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Editar Escala' : 'Nova Escala'}
        size="xl"
      >
        <form onSubmit={handleSubmitSchedule} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nome da Escala</label>
              <input
                type="text"
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                placeholder="Ex: Escala Comercial"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
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
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Filial</label>
              <select
                value={scheduleForm.branchId}
                onChange={(e) => setScheduleForm({ ...scheduleForm, branchId: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              >
                <option value="">Selecione uma filial</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Carga Horária Semanal</label>
              <input
                type="number"
                value={scheduleForm.weeklyHours}
                onChange={(e) => setScheduleForm({ ...scheduleForm, weeklyHours: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                min="1"
                max="56"
              />
            </div>
          </div>

          {/* Schedule Entries - Time Grid */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Horários por Dia da Semana
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600 w-24">Dia</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-600 w-16">Trabalha</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-600">Entrada</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-600">Saída</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-600">Int. Início</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-600">Int. Fim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleEntries.map((entry) => (
                      <tr
                        key={entry.dayOfWeek}
                        className={`border-b border-slate-100 last:border-0 ${
                          !entry.isWorkDay ? 'bg-slate-50/50' : 'hover:bg-indigo-50/30'
                        } ${entry.dayOfWeek === 0 || entry.dayOfWeek === 6 ? 'bg-amber-50/30' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <span className={`font-medium ${entry.isWorkDay ? 'text-slate-700' : 'text-slate-400'}`}>
                            {DAY_NAMES[entry.dayOfWeek]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={entry.isWorkDay}
                            onChange={(e) => updateEntry(entry.dayOfWeek, 'isWorkDay', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            value={entry.startTime}
                            onChange={(e) => updateEntry(entry.dayOfWeek, 'startTime', e.target.value)}
                            disabled={!entry.isWorkDay}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            value={entry.endTime}
                            onChange={(e) => updateEntry(entry.dayOfWeek, 'endTime', e.target.value)}
                            disabled={!entry.isWorkDay}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            value={entry.breakStartTime}
                            onChange={(e) => updateEntry(entry.dayOfWeek, 'breakStartTime', e.target.value)}
                            disabled={!entry.isWorkDay}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            value={entry.breakEndTime}
                            onChange={(e) => updateEntry(entry.dayOfWeek, 'breakEndTime', e.target.value)}
                            disabled={!entry.isWorkDay}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
      </Modal>

      {/* Holiday Form Modal */}
      <Modal
        isOpen={showModal && activeTab === 'holidays'}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Editar Feriado' : 'Novo Feriado'}
        size="md"
      >
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
                <option key={branch.id} value={branch.id}>{branch.name}</option>
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
      </Modal>

      {/* View Entries Modal */}
      <Modal
        isOpen={viewEntriesSchedule !== null}
        onClose={() => setViewEntriesSchedule(null)}
        title={`Horários: ${viewEntriesSchedule?.name || ''}`}
        size="lg"
      >
        {viewEntriesSchedule && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm text-slate-600">
              <span>Tipo: <strong>{({ FIXED: 'Fixo', ROTATING: 'Rotativo', FLEXIBLE: 'Flexível' } as any)[viewEntriesSchedule.type] || viewEntriesSchedule.type}</strong></span>
              <span>Filial: <strong>{viewEntriesSchedule.branch?.name || '-'}</strong></span>
              <span>Carga: <strong>{viewEntriesSchedule.weeklyHours || 44}h/semana</strong></span>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Dia</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Entrada</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Saída</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Intervalo</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const entry = viewEntriesSchedule.scheduleEntries?.find((e: any) => e.dayOfWeek === day);
                    const isWork = entry?.isWorkDay !== false && entry?.startTime;
                    return (
                      <tr key={day} className={`border-b border-slate-100 last:border-0 ${!isWork ? 'bg-slate-50/50' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{DAY_NAMES[day]}</td>
                        <td className="px-4 py-2.5 text-center">{isWork ? entry.startTime : '-'}</td>
                        <td className="px-4 py-2.5 text-center">{isWork ? entry.endTime : '-'}</td>
                        <td className="px-4 py-2.5 text-center">
                          {isWork && entry.breakStartTime ? `${entry.breakStartTime} - ${entry.breakEndTime}` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            isWork ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isWork ? 'Trabalha' : 'Folga'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, type: null, id: null })}
        title="Confirmar exclusão"
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900">
                Deseja deletar {deleteConfirm.type === 'schedule' ? 'esta escala' : 'este feriado'}?
              </h3>
              <p className="text-sm text-slate-500 mt-1">Esta ação não pode ser desfeita.</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: null })}
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
              toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
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
