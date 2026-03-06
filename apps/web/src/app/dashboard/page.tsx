'use client';

import { useAuth } from '@/components/AuthProvider';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <h3 className="text-gray-600 text-sm font-medium mb-2">Colaboradores Ativos</h3>
          <p className="text-4xl font-bold">--</p>
        </div>

        <div className="card">
          <h3 className="text-gray-600 text-sm font-medium mb-2">Registros Hoje</h3>
          <p className="text-4xl font-bold">--</p>
        </div>

        <div className="card">
          <h3 className="text-gray-600 text-sm font-medium mb-2">Folhas Pendentes</h3>
          <p className="text-4xl font-bold">--</p>
        </div>

        <div className="card">
          <h3 className="text-gray-600 text-sm font-medium mb-2">Dispositivos Online</h3>
          <p className="text-4xl font-bold">--</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Últimos Registros</h2>
          <div className="text-gray-600 text-sm">Nenhum registro encontrado</div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Informações do Usuário</h2>
          <div className="space-y-2">
            <p><strong>Nome:</strong> {user?.name}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Função:</strong> {user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
