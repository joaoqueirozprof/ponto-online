'use client';

import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Employee {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  branch: { id: string; name: string };
  schedule: { id: string; name: string; type: string } | null;
  status: 'active' | 'inactive';
  admissionDate: string;
  branchId: string;
  scheduleId: string | null;
}

interface Branch {
  id: string;
  name: string;
}

interface ScheduleOption {
  id: string;
  name: string;
  type: string;
  branch: { id: string; name: string };
  scheduleEntries: ScheduleEntry[];
}

interface ScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
  breakMinutes: number;
  isWorkDay: boolean;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface FormData {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  branchId: string;
  admissionDate: string;
  scheduleId: string;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const initialFormData: FormData = {
  name: '',
  cpf: '',
  email: '',
  phone: '',
  position: '',
  department: '',
  branchId: '',
  admissionDate: '',
  scheduleId: '',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const pageSize = 10;
  const [filterBranch, setFilterBranch] = useState('');
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedScheduleEntries, setSelectedScheduleEntries] = useState<ScheduleEntry[]>([]);

  useEffect(() => {
    fetchEmployees();
    fetchBranches();
  }, [currentPage, filterBranch, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch schedules when branch changes in form
  useEffect(() => {
    if (formData.branchId) {
      fetchSchedulesForBranch(formData.branchId);
    } else {
      setSchedules([]);
    }
  }, [formData.branchId]);

  // Update schedule preview when scheduleId changes
  useEffect(() => {
    if (formData.scheduleId) {
      const found = schedules.find((s) => s.id === formData.scheduleId);
      if (found && found.scheduleEntries) {
        setSelectedScheduleEntries(found.scheduleEntries);
      } else {
        // Fetch from API if not in local list
        fetchScheduleDetails(formData.scheduleId);
      }
    } else {
      setSelectedScheduleEntries([]);
    }
  }, [formData.scheduleId, schedules]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (filterBranch) params.branchId = filterBranch;
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await apiClient.get('/employees', { params });
      setEmployees(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      addToast('Erro ao carregar colaboradores', 'error');
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

  const fetchSchedulesForBranch = async (branchId: string) => {
    try {
      const response = await apiClient.get('/schedules', { params: { branchId, take: 999 } });
      setSchedules(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar escalas', error);
    }
  };

  const fetchScheduleDetails = async (scheduleId: string) => {
    try {
      const response = await apiClient.get(`/schedules/${scheduleId}`);
      if (response.data?.scheduleEntries) {
        setSelectedScheduleEntries(response.data.scheduleEntries);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes da escala', error);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setSelectedScheduleEntries([]);
    setShowModal(true);
  };

  const handleEditClick = (employee: Employee) => {
    setEditingId(employee.id);
    setFormData({
      name: employee.name,
      cpf: employee.cpf,
      email: employee.email || '',
      phone: employee.phone || '',
      position: employee.position || '',
      department: employee.department || '',
      branchId: employee.branchId || employee.branch?.id || '',
      admissionDate: employee.admissionDate ? employee.admissionDate.split('T')[0] : '',
      scheduleId: employee.scheduleId || employee.schedule?.id || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...formData,
        scheduleId: formData.scheduleId || null,
      };
      if (editingId) {
        await apiClient.patch(`/employees/${editingId}`, payload);
        addToast('Colaborador atualizado com sucesso', 'success');
      } else {
        await apiClient.post('/employees', payload);
        addToast('Colaborador criado com sucesso', 'success');
      }
      setShowModal(false);
      setCurrentPage(1);
      fetchEmployees();
    } catch (error) {
      addToast('Erro ao salvar colaborador', 'error');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/employees/${id}`);
      addToast('Colaborador deletado com sucesso', 'success');
      setShowDeleteConfirm(null);
      fetchEmployees();
    } catch (error) {
      addToast('Erro ao deletar colaborador', 'error');
      console.error(error);
    }
  };

  const columns = [
    { key: 'name', label: 'Nome' },
    { key: 'cpf', label: 'CPF' },
    { key: 'position', label: 'Cargo' },
    { key: 'department', label: 'Departamento' },
    {
      key: 'branch',
      label: 'Filial',
      render: (branch: Branch) => branch?.name || '-',
    },
    {
      key: 'schedule',
      label: 'Escala',
      render: (schedule: any) => schedule?.name ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
          {schedule.name}
        </span>
      ) : (
        <span className="text-slate-400 text-xs">Sem escala</span>
      ),
    },
    {
      key: 'id',
      label: 'Ações',
      render: (id: string, row: Employee) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            className="px-3 py-1 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
          >
            Editar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(id); }}
            className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium"
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
          <h1 className="text-3xl font-bold text-slate-900">Colaboradores</h1>
          <p className="text-slate-600 mt-1">Gerencie todos os colaboradores da empresa</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex gap-4 items-end">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome, CPF, função..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Filtrar por Filial</label>
            <select
              value={filterBranch}
              onChange={(e) => { setFilterBranch(e.target.value); setCurrentPage(1); }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-700"
            >
              <option value="">Todas as filiais</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              const headers = ['Nome', 'CPF', 'Cargo', 'Departamento', 'Filial', 'Escala', 'Telefone', 'Email', 'Admissão'];
              const rows = employees.map((e: any) => [
                e.name, e.cpf, e.position || '', e.department || '', e.branch?.name || '', e.schedule?.name || '', e.phone || '', e.email || '',
                e.admissionDate ? new Date(e.admissionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '',
              ]);
              const csv = [headers.join(';'), ...rows.map((r: any) => r.join(';'))].join('\n');
              const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `colaboradores_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition-colors font-semibold text-sm shadow-md hover:shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar CSV
          </button>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors font-semibold text-sm shadow-md hover:shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar
          </button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={employees}
        loading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage((p) => p + 1)}
      />

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar Colaborador' : 'Novo Colaborador'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nome*</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">CPF*</label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                placeholder="XXX.XXX.XXX-XX"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Telefone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Cargo</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                placeholder="Ex: Auxiliar"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Departamento</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                placeholder="Ex: Açougue"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Filial*</label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value, scheduleId: '' })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                required
              >
                <option value="">Selecione uma filial</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Data de Admissão</label>
              <input
                type="date"
                value={formData.admissionDate}
                onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
              />
            </div>
          </div>

          {/* Schedule Selection */}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m7 8H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z" />
              </svg>
              Escala de Trabalho
            </h3>
            <select
              value={formData.scheduleId}
              onChange={(e) => setFormData({ ...formData, scheduleId: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
            >
              <option value="">Sem escala atribuída</option>
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.name} ({({ FIXED: 'Fixo', ROTATING: 'Rotativo', FLEXIBLE: 'Flexível' } as any)[schedule.type] || schedule.type})
                </option>
              ))}
            </select>
            {!formData.branchId && (
              <p className="text-xs text-amber-600 mt-1">Selecione uma filial primeiro para ver as escalas disponíveis.</p>
            )}

            {/* Schedule Preview */}
            {formData.scheduleId && selectedScheduleEntries.length > 0 && (
              <div className="mt-3 border border-indigo-100 rounded-xl overflow-hidden bg-indigo-50/30">
                <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                  <span className="text-sm font-semibold text-indigo-700">
                    Horários da Escala Selecionada
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-indigo-100">
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Dia</th>
                        <th className="px-3 py-2 text-center font-medium text-slate-600">Entrada</th>
                        <th className="px-3 py-2 text-center font-medium text-slate-600">Saída</th>
                        <th className="px-3 py-2 text-center font-medium text-slate-600">Intervalo</th>
                        <th className="px-3 py-2 text-center font-medium text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                        const entry = selectedScheduleEntries.find((e) => e.dayOfWeek === day);
                        const isWork = entry?.isWorkDay !== false && entry?.startTime;
                        return (
                          <tr key={day} className={`border-b border-indigo-50 last:border-0 ${!isWork ? 'bg-slate-50/50' : ''}`}>
                            <td className="px-3 py-2 font-medium text-slate-700">{DAY_NAMES[day]}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{isWork ? entry.startTime : '-'}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{isWork ? entry.endTime : '-'}</td>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {isWork && entry.breakStartTime ? `${entry.breakStartTime} - ${entry.breakEndTime}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
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
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 active:bg-slate-100 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-semibold transition-colors shadow-md hover:shadow-lg"
            >
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title="Confirmar Exclusão"
      >
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">
              Tem certeza que deseja deletar este colaborador? Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 active:bg-slate-100 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 font-semibold transition-colors shadow-md hover:shadow-lg"
            >
              Deletar
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 space-y-3 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : toast.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-slate-50 text-slate-800 border border-slate-200'
            }`}
          >
            {toast.type === 'success' && (
              <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" />
              </svg>
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
