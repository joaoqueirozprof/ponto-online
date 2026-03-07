'use client';

import { useAuth } from '@/components/AuthProvider';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DashboardStats {
  employees: number;
  branches: number;
  devices: number;
  devicesOnline: number;
  pendingTimesheets: number;
}

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState<DashboardStats>({
    employees: 0, branches: 0, devices: 0, devicesOnline: 0, pendingTimesheets: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchStats();
  }, [isAuthenticated]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const [empRes, branchRes, deviceRes, tsRes] = await Promise.all([
        apiClient.get('/employees', { params: { take: 1 } }).catch(() => ({ data: { total: 0 } })),
        apiClient.get('/branches', { params: { take: 1 } }).catch(() => ({ data: { total: 0 } })),
        apiClient.get('/devices', { params: { take: 999 } }).catch(() => ({ data: { data: [], total: 0 } })),
        apiClient.get('/timesheets', { params: { take: 1 } }).catch(() => ({ data: { total: 0 } })),
      ]);

      const devices = deviceRes.data.data || [];
      const onlineDevices = devices.filter((d: any) => d.status === 'online').length;

      setStats({
        employees: empRes.data.total || 0,
        branches: branchRes.data.total || 0,
        devices: deviceRes.data.total || devices.length || 0,
        devicesOnline: onlineDevices,
        pendingTimesheets: tsRes.data.total || 0,
      });
    } catch (err) {
      console.error('Erro ao carregar estatisticas', err);
    } finally {
      setStatsLoading(false);
    }
  };

  if (loading || !isAuthenticated) return null;

  const greeting = currentTime.getHours() < 12 ? 'Bom dia' : currentTime.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  const statCards = [
    {
      label: 'Colaboradores',
      value: stats.employees,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'indigo',
      href: '/employees',
    },
    {
      label: 'Filiais',
      value: stats.branches,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'emerald',
      href: '/branches',
    },
    {
      label: 'Dispositivos',
      value: `${stats.devicesOnline}/${stats.devices}`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ),
      color: 'violet',
      href: '/devices',
    },
    {
      label: 'Folhas de Ponto',
      value: stats.pendingTimesheets,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'amber',
      href: '/timesheets',
    },
  ];

  const colorMap: Record<string, { iconBg: string; text: string }> = {
    indigo: { iconBg: 'bg-indigo-500/10', text: 'text-indigo-500' },
    emerald: { iconBg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    amber: { iconBg: 'bg-amber-500/10', text: 'text-amber-500' },
    violet: { iconBg: 'bg-violet-500/10', text: 'text-violet-500' },
  };

  const quickLinks = [
    { label: 'Colaboradores', href: '/employees', desc: 'Gerenciar equipe' },
    { label: 'Registros', href: '/punches', desc: 'Ver batidas' },
    { label: 'Relatorios', href: '/reports', desc: 'Gerar relatorios' },
    { label: 'Escalas', href: '/schedules', desc: 'Horarios de trabalho' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {user?.name?.split(' ')[0] || 'Usuario'}
          </h1>
          <p className="text-slate-500 mt-1">Resumo do sistema de ponto</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const colors = colorMap[stat.color];
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${colors.iconBg} rounded-lg flex items-center justify-center ${colors.text}`}>
                  {stat.icon}
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {statsLoading ? (
                  <div className="h-7 w-12 bg-slate-200 rounded animate-pulse" />
                ) : (
                  stat.value
                )}
              </div>
              <div className="text-sm text-slate-500 mt-0.5">{stat.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Links */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Acesso Rapido</h2>
          <div className="space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="flex items-center justify-between px-3 py-3 rounded-lg text-sm hover:bg-slate-50 transition-colors border border-slate-100 group"
              >
                <div>
                  <div className="font-medium text-slate-700 group-hover:text-slate-900">{link.label}</div>
                  <div className="text-xs text-slate-400">{link.desc}</div>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Status do Sistema</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Online
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'API Backend', status: 'Operacional', ok: true },
              { name: 'Banco de Dados', status: 'Conectado', ok: true },
              { name: 'Redis Cache', status: 'Ativo', ok: true },
              { name: 'Dispositivos', status: stats.devicesOnline > 0 ? `${stats.devicesOnline} online` : 'Nenhum conectado', ok: stats.devicesOnline > 0 },
            ].map((service) => (
              <div key={service.name} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${service.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="text-sm text-slate-600">{service.name}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${service.ok ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'}`}>
                  {service.status}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm">
            <span className="text-slate-500">Conectado como:</span>
            <span className="font-medium text-slate-700">{user?.name}</span>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded">{user?.role || 'admin'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
