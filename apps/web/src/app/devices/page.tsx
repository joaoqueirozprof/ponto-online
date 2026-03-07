'use client';

import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Device {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  ipAddress: string;
  port: number;
  branch: { id: string; name: string };
  status: 'online' | 'offline';
  lastSync: string;
  branchId: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
  timestamp: number;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;
  const [filterBranch, setFilterBranch] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    model: '',
    serialNumber: '',
    ipAddress: '',
    port: '',
    login: '',
    encryptedPassword: '',
    branchId: '',
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchDevices();
    fetchBranches();
  }, [currentPage, filterBranch, debouncedSearch]);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, message, type, timestamp: Date.now() }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (filterBranch) params.branchId = filterBranch;
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await apiClient.get('/devices', { params });
      setDevices(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      addToast('Erro ao carregar dispositivos', 'error');
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) errors.name = 'Nome é obrigatório';
    if (!formData.model.trim()) errors.model = 'Modelo é obrigatório';
    if (!formData.serialNumber.trim()) errors.serialNumber = 'Número de série é obrigatório';
    if (!formData.ipAddress.trim()) errors.ipAddress = 'Endereço IP é obrigatório';
    if (!formData.port) errors.port = 'Porta é obrigatória';
    if (!formData.branchId) errors.branchId = 'Filial é obrigatória';

    if (!editingId) {
      if (!formData.login.trim()) errors.login = 'Login é obrigatório para novo dispositivo';
      if (!formData.encryptedPassword.trim()) errors.encryptedPassword = 'Senha é obrigatória para novo dispositivo';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddClick = () => {
    setEditingId(null);
    setFormErrors({});
    setFormData({
      name: '',
      model: '',
      serialNumber: '',
      ipAddress: '',
      port: '',
      login: '',
      encryptedPassword: '',
      branchId: '',
    });
    setShowModal(true);
  };

  const handleEditClick = (device: Device) => {
    setEditingId(device.id);
    setFormErrors({});
    setFormData({
      name: device.name,
      model: device.model,
      serialNumber: device.serialNumber,
      ipAddress: device.ipAddress,
      port: String(device.port),
      login: '',
      encryptedPassword: '',
      branchId: device.branchId,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      addToast('Por favor, corrija os erros do formulário', 'error');
      return;
    }

    try {
      const data: any = {
        name: formData.name.trim(),
        model: formData.model.trim(),
        serialNumber: formData.serialNumber.trim(),
        ipAddress: formData.ipAddress.trim(),
        port: parseInt(formData.port),
        branchId: formData.branchId,
      };

      if (formData.login.trim()) {
        data.login = formData.login.trim();
      }
      if (formData.encryptedPassword.trim()) {
        data.encryptedPassword = formData.encryptedPassword.trim();
      }

      if (editingId) {
        await apiClient.put(`/devices/${editingId}`, data);
        addToast('Dispositivo atualizado com sucesso', 'success');
      } else {
        await apiClient.post('/devices', data);
        addToast('Dispositivo criado com sucesso', 'success');
      }
      setShowModal(false);
      setCurrentPage(1);
      setFormErrors({});
      fetchDevices();
    } catch (error) {
      addToast('Erro ao salvar dispositivo', 'error');
      console.error(error);
    }
  };

  const handleExportCSV = () => {
    if (devices.length === 0) {
      addToast('Nenhum dispositivo para exportar', 'error');
      return;
    }
    const headers = ['Nome', 'Modelo', 'Número de Série', 'IP', 'Porta', 'Filial', 'Status', 'Última Sincronização'];
    const rows = devices.map((d) => [
      d.name,
      d.model,
      d.serialNumber,
      d.ipAddress,
      String(d.port),
      d.branch?.name || '-',
      d.status === 'online' ? 'Online' : 'Offline',
      d.lastSync ? new Date(d.lastSync).toLocaleString('pt-BR') : '-',
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dispositivos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('CSV exportado com sucesso!', 'success');
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/devices/${id}`);
      addToast('Dispositivo deletado com sucesso', 'success');
      setDeleteConfirmId(null);
      fetchDevices();
    } catch (error) {
      addToast('Erro ao deletar dispositivo', 'error');
      console.error(error);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR');
  };

  const columns = [
    {
      key: 'name',
      label: 'Nome',
    },
    {
      key: 'model',
      label: 'Modelo',
    },
    {
      key: 'serialNumber',
      label: 'Número de Série',
    },
    {
      key: 'ipAddress',
      label: 'IP',
    },
    {
      key: 'port',
      label: 'Porta',
    },
    {
      key: 'branch',
      label: 'Filial',
      render: (branch: Branch) => branch?.name || '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (status: string) => (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold gap-1 ${
            status === 'online'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          {status === 'online' ? 'Online' : 'Offline'}
        </span>
      ),
    },
    {
      key: 'lastSync',
      label: 'Última Sincronização',
      render: (val: string) => formatDate(val),
    },
    {
      key: 'id',
      label: 'Ações',
      render: (id: string, row: Device) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(row);
            }}
            className="px-3 py-1 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
          >
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(id);
            }}
            className="px-3 py-1 text-sm font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
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
          <h1 className="text-3xl font-bold text-slate-900">Dispositivos</h1>
          <p className="text-slate-500 mt-2">Gerencie todos os dispositivos de ponto do sistema</p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Filtrar por Filial</label>
            <select
              value={filterBranch}
              onChange={(e) => {
                setFilterBranch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 bg-white transition-all"
            >
              <option value="">Todas as filiais</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
            />
          </div>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-all font-semibold text-sm shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Dispositivo
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-all font-semibold text-sm shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={devices}
        loading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage((p) => p + 1)}
      />

      {/* Modal for Add/Edit */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setFormErrors({});
        }}
        title={editingId ? 'Editar Dispositivo' : 'Novo Dispositivo'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                formErrors.name
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                  : 'border-slate-300 focus:ring-indigo-500 focus:border-transparent'
              } bg-white text-slate-900`}
              placeholder="Ex: Terminal Biométrico 01"
            />
            {formErrors.name && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Modelo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                formErrors.model
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                  : 'border-slate-300 focus:ring-indigo-500 focus:border-transparent'
              } bg-white text-slate-900`}
              placeholder="Ex: TZ100"
            />
            {formErrors.model && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.model}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Número de Série <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                formErrors.serialNumber
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                  : 'border-slate-300 focus:ring-indigo-500 focus:border-transparent'
              } bg-white text-slate-900`}
              placeholder="Ex: SN123456789"
            />
            {formErrors.serialNumber && (
              <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.serialNumber}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Endereço IP <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.ipAddress}
              onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                formErrors.ipAddress
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                  : 'border-slate-300 focus:ring-indigo-500 focus:border-transparent'
              } bg-white text-slate-900`}
              placeholder="Ex: 192.168.1.100"
            />
            {formErrors.ipAddress && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.ipAddress}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Porta <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="65535"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                formErrors.port
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                  : 'border-slate-300 focus:ring-indigo-500 focus:border-transparent'
              } bg-white text-slate-900`}
              placeholder="Ex: 5000"
            />
            {formErrors.port && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.port}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Login <span className="text-red-500">{!editingId ? '*' : ''}</span>
            </label>
            <input
              type="text"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                formErrors.login
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                  : 'border-slate-300 focus:ring-indigo-500 focus:border-transparent'
              } bg-white text-slate-900`}
              placeholder="Ex: admin"
            />
            {formErrors.login && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.login}</p>}
            {!editingId && <p className="text-slate-500 text-xs mt-1">Obrigatório para novo dispositivo</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Senha <span className="text-red-500">{!editingId ? '*' : ''}</span>
            </label>
            <input
              type="password"
              value={formData.encryptedPassword}
              onChange={(e) => setFormData({ ...formData, encryptedPassword: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                formErrors.encryptedPassword
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                  : 'border-slate-300 focus:ring-indigo-500 focus:border-transparent'
              } bg-white text-slate-900`}
              placeholder="••••••••"
            />
            {formErrors.encryptedPassword && (
              <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.encryptedPassword}</p>
            )}
            {!editingId && <p className="text-slate-500 text-xs mt-1">Obrigatória para novo dispositivo</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Filial <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.branchId}
              onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                formErrors.branchId
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent'
                  : 'border-slate-300 focus:ring-indigo-500 focus:border-transparent'
              } bg-white text-slate-900`}
            >
              <option value="">Selecione uma filial</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {formErrors.branchId && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.branchId}</p>}
          </div>

          <div className="flex gap-3 pt-5 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setFormErrors({});
              }}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 active:bg-slate-100 font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-semibold transition-all shadow-sm hover:shadow-md"
            >
              {editingId ? 'Atualizar' : 'Criar Dispositivo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-slate-700">
            Tem certeza que deseja deletar este dispositivo? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 active:bg-slate-100 font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 font-semibold transition-all shadow-sm hover:shadow-md"
            >
              Deletar
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-md">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-right-4 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <div className="flex-shrink-0">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <p className="flex-1">{toast.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
