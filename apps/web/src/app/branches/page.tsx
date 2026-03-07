'use client';

import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Branch {
  id: string;
  name: string;
  code: string;
  company: { id: string; name: string };
  address: string;
  phone: string;
  timezone: string;
  companyId: string;
  toleranceMinutes?: number;
}

interface Company {
  id: string;
  name: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

const Toast = ({ toast, onClose }: { toast: Toast; onClose: () => void }) => {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(onClose, toast.duration || 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  const bgColor = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  };

  const textColor = {
    success: 'text-emerald-800',
    error: 'text-red-800',
    info: 'text-blue-800',
  };

  const iconColor = {
    success: 'text-emerald-600',
    error: 'text-red-600',
    info: 'text-blue-600',
  };

  return (
    <div
      className={`border ${bgColor[toast.type]} rounded-lg p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300`}
    >
      {toast.type === 'success' && (
        <svg className={`w-5 h-5 ${iconColor[toast.type]}`} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {toast.type === 'error' && (
        <svg className={`w-5 h-5 ${iconColor[toast.type]}`} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {toast.type === 'info' && (
        <svg className={`w-5 h-5 ${iconColor[toast.type]}`} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className={`text-sm font-medium ${textColor[toast.type]}`}>{toast.message}</span>
      <button
        onClick={onClose}
        className={`ml-auto flex-shrink-0 ${iconColor[toast.type]} hover:opacity-75 transition-opacity`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 10;
  const [formData, setFormData] = useState({
    companyId: '',
    name: '',
    code: '',
    address: '',
    phone: '',
    timezone: 'America/Sao_Paulo',
    toleranceMinutes: '',
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchBranches();
    fetchCompanies();
  }, [currentPage, debouncedSearch]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await apiClient.get('/branches', { params });
      setBranches(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      addToast('Erro ao carregar filiais', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await apiClient.get('/companies', { params: { take: 999 } });
      setCompanies(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar empresas', error);
      addToast('Erro ao carregar empresas', 'error');
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setFormData({
      companyId: '',
      name: '',
      code: '',
      address: '',
      phone: '',
      timezone: 'America/Sao_Paulo',
      toleranceMinutes: '',
    });
    setShowModal(true);
  };

  const handleEditClick = (branch: Branch) => {
    setEditingId(branch.id);
    setFormData({
      companyId: branch.companyId,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      timezone: branch.timezone,
      toleranceMinutes: String(branch.toleranceMinutes || ''),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const data: any = {
        companyId: formData.companyId,
        name: formData.name,
        code: formData.code,
        address: formData.address,
        phone: formData.phone,
        timezone: formData.timezone,
      };
      if (formData.toleranceMinutes) {
        data.toleranceMinutes = parseInt(formData.toleranceMinutes);
      }

      if (editingId) {
        await apiClient.put(`/branches/${editingId}`, data);
        addToast('Filial atualizada com sucesso', 'success');
      } else {
        await apiClient.post('/branches', data);
        addToast('Filial criada com sucesso', 'success');
      }
      setShowModal(false);
      setCurrentPage(1);
      fetchBranches();
    } catch (error) {
      addToast('Erro ao salvar filial', 'error');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (branches.length === 0) {
      addToast('Nenhuma filial para exportar', 'error');
      return;
    }
    const headers = ['Nome', 'Código', 'Empresa', 'Endereço', 'Telefone', 'Fuso Horário', 'Tolerância (min)'];
    const rows = branches.map((b) => [
      b.name,
      b.code,
      b.company?.name || '-',
      b.address,
      b.phone || '-',
      b.timezone,
      String(b.toleranceMinutes ?? '-'),
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `filiais-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('CSV exportado com sucesso!', 'success');
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      await apiClient.delete(`/branches/${id}`);
      addToast('Filial deletada com sucesso', 'success');
      setShowDeleteConfirm(null);
      fetchBranches();
    } catch (error) {
      addToast('Erro ao deletar filial', 'error');
      console.error(error);
    } finally {
      setDeleting(null);
    }
  };

  const timezones = [
    'America/Sao_Paulo',
    'America/Fortaleza',
    'America/Manaus',
    'America/Rio_Branco',
    'America/Belem',
  ];

  const columns = [
    {
      key: 'name',
      label: 'Nome',
    },
    {
      key: 'code',
      label: 'Código',
    },
    {
      key: 'company',
      label: 'Empresa',
      render: (company: Company) => company?.name || '-',
    },
    {
      key: 'address',
      label: 'Endereço',
    },
    {
      key: 'phone',
      label: 'Telefone',
    },
    {
      key: 'timezone',
      label: 'Fuso Horário',
    },
    {
      key: 'id',
      label: 'Ações',
      render: (id: string, row: Branch) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(row);
            }}
            className="px-3 py-1 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
          >
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(id);
            }}
            className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
            disabled={deleting === id}
          >
            Deletar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Filiais</h1>
          <p className="text-slate-500 mt-2">Gerencie todas as filiais das empresas</p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors font-medium text-sm shadow-sm hover:shadow-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar Filial
        </button>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors font-medium text-sm shadow-sm hover:shadow-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nome, código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
        />
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={branches}
        loading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage((p) => p + 1)}
      />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Editar Filial' : 'Nova Filial'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5">
            {/* Company Select */}
            <div>
              <label htmlFor="company" className="block text-sm font-semibold text-slate-700 mb-2">
                Empresa <span className="text-red-500">*</span>
              </label>
              <select
                id="company"
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-slate-900"
                required
              >
                <option value="">Selecione uma empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Ex: Filial São Paulo"
                required
              />
            </div>

            {/* Code Input */}
            <div>
              <label htmlFor="code" className="block text-sm font-semibold text-slate-700 mb-2">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                id="code"
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Ex: SP-001"
                required
              />
            </div>

            {/* Address Input */}
            <div>
              <label htmlFor="address" className="block text-sm font-semibold text-slate-700 mb-2">
                Endereço <span className="text-red-500">*</span>
              </label>
              <input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Rua, número, complemento"
                required
              />
            </div>

            {/* Phone Input */}
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-2">
                Telefone <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="(11) 99999-9999"
                required
              />
            </div>

            {/* Timezone Select */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-semibold text-slate-700 mb-2">
                Fuso Horário <span className="text-red-500">*</span>
              </label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-slate-900"
                required
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Tolerance Input */}
            <div>
              <label htmlFor="tolerance" className="block text-sm font-semibold text-slate-700 mb-2">
                Tolerância (minutos)
              </label>
              <input
                id="tolerance"
                type="number"
                value={formData.toleranceMinutes}
                onChange={(e) => setFormData({ ...formData, toleranceMinutes: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="0"
                min="0"
              />
              <p className="mt-1 text-xs text-slate-500">Tolerância de tempo para registros</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4v2m0 4v2m-6.363-2.141l1.414-1.414m2.828 0l1.414 1.414m-8.485-5.657l1.414-1.414m2.828 0l1.414 1.414"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-600">
                Tem certeza que deseja deletar esta filial? Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (showDeleteConfirm) {
                  handleDelete(showDeleteConfirm);
                }
              }}
              disabled={deleting !== null}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Deletando...
                </>
              ) : (
                'Deletar'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
