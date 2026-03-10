'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

interface Role {
  id: string;
  name: string;
  description: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  branch: { id: string; name: string; code: string } | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-500/20 text-red-300',
  COMPANY_ADMIN: 'bg-purple-500/20 text-purple-300',
  MANAGER: 'bg-blue-500/20 text-blue-300',
  HR: 'bg-amber-500/20 text-amber-300',
  VIEWER: 'bg-slate-500/20 text-slate-300',
};

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', email: '', password: '', roleId: '', branchId: '',
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/users', { params: { search, take: 50 } });
      setUsers(res.data.data);
      setTotal(res.data.total);
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchRoles = async () => {
    try {
      const res = await apiClient.get('/users/roles');
      setRoles(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchBranches = async () => {
    try {
      const res = await apiClient.get('/branches');
      setBranches(res.data.data || res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchRoles(); fetchBranches(); }, []);

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', roleId: roles[0]?.id || '', branchId: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', roleId: u.role.id, branchId: u.branch?.id || '' });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        const data: any = { name: form.name, email: form.email, roleId: form.roleId, branchId: form.branchId || null };
        if (form.password) data.password = form.password;
        await apiClient.put(`/users/${editingUser.id}`, data);
      } else {
        await apiClient.post('/users', form);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      if (u.isActive) {
        await apiClient.delete(`/users/${u.id}`);
      } else {
        await apiClient.put(`/users/${u.id}`, { isActive: true });
      }
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro');
    }
  };

  const canManage = hasPermission('users.create') || hasPermission('admin.all');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestão de Usuários</h1>
          <p className="text-sm text-slate-400 mt-1">{total} usuário{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Usuário
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Usuário</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Perfil</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Filial</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Último Acesso</th>
              {canManage && <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">Carregando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">Nenhum usuário encontrado</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role.name] || 'bg-slate-500/20 text-slate-300'}`}>
                    {u.role.name === 'COMPANY_ADMIN' ? 'Admin' : u.role.name === 'SUPER_ADMIN' ? 'Super Admin' : u.role.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {u.branch?.name || <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    {u.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => toggleActive(u)}
                          className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400'}`}
                          title={u.isActive ? 'Desativar' : 'Reativar'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={u.isActive ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nome Completo</label>
                <input
                  type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="Nome do usuário"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email</label>
                <input
                  type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="email@empresa.com.br"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Senha {editingUser && <span className="text-slate-600">(deixe vazio para manter a atual)</span>}
                </label>
                <input
                  type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder={editingUser ? '••••••' : 'Mínimo 6 caracteres'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Perfil</label>
                <select
                  value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name === 'COMPANY_ADMIN' ? 'Administrador' : r.name === 'MANAGER' ? 'Gestor' : r.name === 'HR' ? 'RH' : r.name === 'VIEWER' ? 'Visualizador' : r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Filial <span className="text-slate-600">(opcional)</span></label>
                <select
                  value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Todas as filiais</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.email || !form.roleId || (!editingUser && !form.password)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving ? 'Salvando...' : editingUser ? 'Salvar' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
