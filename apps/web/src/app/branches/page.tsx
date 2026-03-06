'use client';

import DataTable from '@/components/DataTable';
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

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
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
    fetchBranches();
    fetchCompanies();
  }, [currentPage]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      const response = await apiClient.get('/branches', { params: { skip, take: pageSize } });
      setBranches(response.data.data || []);
      setTotalCount(response.data.total || 0);
    } catch (error) {
      alert('Erro ao carregar filiais');
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
        alert('Filial atualizada com sucesso');
      } else {
        await apiClient.post('/branches', data);
        alert('Filial criada com sucesso');
      }
      setShowModal(false);
      setCurrentPage(1);
      fetchBranches();
    } catch (error) {
      alert('Erro ao salvar filial');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta filial?')) return;
    try {
      await apiClient.delete(`/branches/${id}`);
      alert('Filial deletada com sucesso');
      fetchBranches();
    } catch (error) {
      alert('Erro ao deletar filial');
      console.error(error);
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
            className="px-3 py-1 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(id);
            }}
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
          <h1 className="text-2xl font-bold text-slate-800">Filiais</h1>
          <p className="text-slate-500 mt-1">Gerencie todas as filiais das empresas</p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar
        </button>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? 'Editar Filial' : 'Nova Filial'}
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
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-96 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Empresa*</label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome*</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código*</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Endereço*</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone*</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fuso Horário*</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tolerância (minutos)</label>
                <input
                  type="number"
                  value={formData.toleranceMinutes}
                  onChange={(e) => setFormData({ ...formData, toleranceMinutes: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
          </div>
        </div>
      )}
    </div>
  );
}
