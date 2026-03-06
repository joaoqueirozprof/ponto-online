'use client';

import DataTable from '@/components/DataTable';
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

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (activeTab === 'schedules') fetchSchedules();
    else fetchHolidays();
  }, [activeTab, currentPage]);

  const fetchBranches = async () => {
    try {
      const response = await apiClient.get('/branches', { params: { take: 999 } });
      setBranches(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar filiais', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const response = await apiClient.get('/schedules', { params: { skip, take: pageSize } });
      setSchedules(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Erro ao carregar escalas');
      console.error(error);
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
      alert('Erro ao carregar feriados');
      console.error(error);
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
        await apiClient.put(`/schedules/${editingId}`, scheduleForm);
        alert('Escala atualizada com sucesso');
      } else {
        await apiClient.post('/schedules', scheduleForm);
        alert('Escala criada com sucesso');
      }
      setShowModal(false);
      fetchSchedules();
    } catch (error) {
      alert('Erro ao salvar escala');
      console.error(error);
    }
  };

  const handleSubmitHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiClient.put(`/holidays/${editingId}`, holidayForm);
        alert('Feriado atualizado com sucesso');
      } else {
        await apiClient.post('/holidays', holidayForm);
        alert('Feriado criado com sucesso');
      }
      setShowModal(false);
      fetchHolidays();
    } catch (error) {
      alert('Erro ao salvar feriado');
      console.error(error);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta escala?')) return;
    try {
      await apiClient.delete(`/schedules/${id}`);
      alert('Escala deletada com sucesso');
      fetchSchedules();
    } catch (error) {
      alert('Erro ao deletar escala');
      console.error(error);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este feriado?')) return;
    try {
      await apiClient.delete(`/holidays/${id}`);
      alert('Feriado deletado com sucesso');
      fetchHolidays();
    } catch (error) {
      alert('Erro ao deletar feriado');
      console.error(error);
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
      render: (id: string) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleDeleteSchedule(id)}
            className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
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
      render: (id: string) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleDeleteHoliday(id)}
            className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
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
          <h1 className="text-2xl font-bold text-slate-800">Escalas e Feriados</h1>
          <p className="text-slate-500 mt-1">Gerencie as escalas de trabalho e feriados</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('schedules');
            setCurrentPage(1);
          }}
          className={`px-6 py-3 font-medium text-sm transition-colors duration-200 border-b-2 ${
            activeTab === 'schedules'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-600 border-transparent hover:text-slate-800'
          }`}
        >
          Escalas
        </button>
        <button
          onClick={() => {
            setActiveTab('holidays');
            setCurrentPage(1);
          }}
          className={`px-6 py-3 font-medium text-sm transition-colors duration-200 border-b-2 ${
            activeTab === 'holidays'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-600 border-transparent hover:text-slate-800'
          }`}
        >
          Feriados
        </button>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={activeTab === 'schedules' ? handleAddSchedule : handleAddHoliday}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                {activeTab === 'schedules'
                  ? editingId
                    ? 'Editar Escala'
                    : 'Nova Escala'
                  : editingId
                    ? 'Editar Feriado'
                    : 'Novo Feriado'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {activeTab === 'schedules' ? (
              <form onSubmit={handleSubmitSchedule} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome*</label>
                  <input
                    type="text"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo*</label>
                  <select
                    value={scheduleForm.type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="FIXED">Fixo</option>
                    <option value="ROTATING">Rotativo</option>
                    <option value="FLEXIBLE">Flexível</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Filial*</label>
                  <select
                    value={scheduleForm.branchId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, branchId: e.target.value })}
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
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmitHoliday} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome*</label>
                  <input
                    type="text"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data*</label>
                  <input
                    type="date"
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo*</label>
                  <select
                    value={holidayForm.type}
                    onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="NATIONAL">Nacional</option>
                    <option value="STATE">Estadual</option>
                    <option value="MUNICIPAL">Municipal</option>
                    <option value="COMPANY">Empresa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Filial</label>
                  <select
                    value={holidayForm.branchId}
                    onChange={(e) => setHolidayForm({ ...holidayForm, branchId: e.target.value })}
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
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
