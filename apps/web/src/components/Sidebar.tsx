'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold">Ponto Online</h1>
        <p className="text-gray-400 text-sm mt-2">{user?.name || 'Usuario'}</p>
      </div>

      <nav className="p-4 space-y-2">
        <Link href="/dashboard" className="block px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          Dashboard
        </Link>
        <Link href="/employees" className="block px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          Colaboradores
        </Link>
        <Link href="/punches" className="block px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          Registros de Ponto
        </Link>
        <Link href="/timesheets" className="block px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          Folhas de Ponto
        </Link>
        <Link href="/devices" className="block px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          Dispositivos
        </Link>
        <Link href="/reports" className="block px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          Relatórios
        </Link>
      </nav>

      <div className="p-4 border-t border-gray-800 mt-auto">
        <button
          onClick={logout}
          className="w-full px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
