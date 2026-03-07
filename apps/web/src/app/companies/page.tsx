'use client';

import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import { apiClient } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Company {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  branchesCount?: number;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
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
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    address: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchCompanies();
  }, [currentPage, debouncedSearch]);

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const params: any = { skip, take: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await apiClient.get('/companies', { params });
      setCompanies(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      showToast('Erro ao carregar empresas', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setFormData({
      name: '',
      cnpj: '',
      address: '',
      phone: '',
      email: '',
    });
    setShowModal(true);
  };

  const handleEditClick = (company: Company) => {
    setEditingId(company.id);
    setFormData({
      name: company.name,
      cnpj: company.cnpj,
      address: company.address,
      phone: company.phone,
      email: company.email,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiClient.put(`/companies/${editingId}`, formData);
        showToast('Empresa atualizada com sucesso', 'success');
      } else {
        await apiClient.post('/companies', formData);
        showToast('Empresa criada com sucesso', 'success');
      }
      setShowModal(false);
      setCurrentPage(1);
      fetchCompanies();
    } catch (error) {
      showToast('Erro ao salvar empresa', 'error');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null);
    try {
      await apiClient.delete(`/companies/${id}`);
      showToast('Empresa deletada com sucesso', 'success');
      fetchCompanies();
    } catch (error) {
      showToast('Erro ao deletar empresa', 'error');
      console.error(error);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Nome',
    },
    {
      key: 'cnpj',
      label: 'CNPJ',
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
      key: 'email',
      label: 'Email',
    },
    {
      key: 'branchesCount',
      label: 'Filiais',
    },
    {
      key: 'id',
      label: 'Ações',
      render: (id: string, row: Company) => (
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
              setDeleteConfirmId(id);
            }}
            className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
          >
            Deletar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm pointer-events-auto animate-in slide-in-from-top-2 fade-in ${
              toast.type === 'success'
                ? 'bg-emerald-500/90 text-white border border-emerald-600/20'
                : 'bg-red-500/90 text-white border border-red-600/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Empresas</h1>
          <p className="text-slate-600 mt-1">Gerencie todas as empresas do sistema</p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors font-medium text-sm shadow-sm hover:shadow-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar Empresa
        </button>
      </div>

      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nome, CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
        />
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={companies}
        loading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage((p) => p + 1)}
      />

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="w-full max-w-md">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {editingId ? 'Editar Empresa' : 'Nova Empresa'}
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              {editingId ? 'Atualize os dados da empresa' : 'Preencha os dados para criar uma nova empresa'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Nome da empresa"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">CNPJ *</label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="XX.XXX.XXX/XXXX-XX"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Endereço *</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Rua, número, cidade"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="contato@empresa.com"
                required
              />
            </div>

            <div className="flex gap-3 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 active:bg-slate-100 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 font-medium transition-colors shadow-sm hover:shadow-md"
              >
                {editingId ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 text-center">Deletar Empresa</h2>
            <p className="text-slate-600 text-center text-sm mt-2">
              Tem certeza que deseja deletar esta empresa? Esta ação não pode ser desfeita.
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 active:bg-slate-100 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 font-medium transition-colors shadow-sm hover:shadow-md"
            >
              Deletar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
