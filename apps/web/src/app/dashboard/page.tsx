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
  approvedTimesheets: number;
  todayPunches: number;
  todayPresent: number;
  nextHoliday: { name: string; date: string } | null;
}

interface RecentPunch {
  id: string;
  punchTime: string;
  employee: { id: string; name: string } | null;
  device: { id: string; name: string } | null;
}

interface WeekDay {
  label: string;
  date: string;
  count: number;
  isToday: boolean;
}

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState<DashboardStats>({
    employees: 0, branches: 0, devices: 0, devicesOnline: 0, pendingTimesheets: 0, approvedTimesheets: 0, todayPunches: 0, todayPresent: 0, nextHoliday: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentPunches, setRecentPunches] = useState<RecentPunch[]>([]);
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [systemHealth, setSystemHealth] = useState<{ api: boolean; db: boolean; redis: boolean }>({ api: false, db: false, redis: false });
  const [alerts, setAlerts] = useState<{ type: string; message: string; color: string }[]>([]);

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
    if (isAuthenticated) {
      fetchStats();
      fetchRecentPunches();
      fetchWeekData();
      checkSystemHealth();
    }
  }, [isAuthenticated]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const [empRes, branchRes, deviceRes, tsOpenRes, tsApprovedRes, punchesRes, holidaysRes] = await Promise.all([
        apiClient.get('/employees', { params: { take: 1 } }).catch(() => ({ data: { total: 0 } })),
        apiClient.get('/branches', { params: { take: 1 } }).catch(() => ({ data: { total: 0 } })),
        apiClient.get('/devices', { params: { take: 999 } }).catch(() => ({ data: { data: [], total: 0 } })),
        apiClient.get('/timesheets', { params: { take: 1, month: currentMonth, year: currentYear, status: 'OPEN' } }).catch(() => ({ data: { total: 0 } })),
        apiClient.get('/timesheets', { params: { take: 1, month: currentMonth, year: currentYear, status: 'APPROVED' } }).catch(() => ({ data: { total: 0 } })),
        apiClient.get('/punches/raw', { params: { take: 500 } }).catch(() => ({ data: { data: [], total: 0 } })),
        apiClient.get('/holidays', { params: { take: 50, year: currentYear } }).catch(() => ({ data: { data: [] } })),
      ]);

      const devices = deviceRes.data.data || [];
      const onlineDevices = devices.filter((d: any) => d.status === 'online').length;

      // Calculate today's stats from punches
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const allPunches = punchesRes.data.data || [];
      const todayPunches = allPunches.filter((p: any) => p.punchTime && p.punchTime.startsWith(todayStr));
      const uniqueEmployeesToday = new Set(todayPunches.map((p: any) => p.employee?.id).filter(Boolean));

      // Find next holiday
      const holidays = holidaysRes.data.data || [];
      const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const upcoming = holidays
        .map((h: any) => ({ ...h, dateObj: new Date(h.date) }))
        .filter((h: any) => h.dateObj.getTime() >= todayTime)
        .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime());
      const nextHoliday = upcoming.length > 0 ? { name: upcoming[0].name, date: upcoming[0].date } : null;

      const newStats = {
        employees: empRes.data.total || 0,
        branches: branchRes.data.total || 0,
        devices: deviceRes.data.total || devices.length || 0,
        devicesOnline: onlineDevices,
        pendingTimesheets: tsOpenRes.data.total || 0,
        approvedTimesheets: tsApprovedRes.data.total || 0,
        todayPunches: todayPunches.length,
        todayPresent: uniqueEmployeesToday.size,
        nextHoliday,
      };
      setStats(newStats);

      // Build alerts
      const newAlerts: { type: string; message: string; color: string }[] = [];
      if (newStats.pendingTimesheets > 0) {
        newAlerts.push({ type: 'warning', message: `${newStats.pendingTimesheets} folha(s) de ponto pendente(s) de aprovação`, color: 'amber' });
      }
      if (newStats.employees > 0 && newStats.todayPresent === 0 && now.getHours() >= 9 && now.getDay() >= 1 && now.getDay() <= 5) {
        newAlerts.push({ type: 'alert', message: 'Nenhum colaborador registrou ponto hoje', color: 'red' });
      }
      if (nextHoliday) {
        const daysUntil = Math.ceil((new Date(nextHoliday.date).getTime() - todayTime) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7 && daysUntil >= 0) {
          newAlerts.push({ type: 'info', message: `Próximo feriado: ${nextHoliday.name} em ${daysUntil === 0 ? 'hoje' : daysUntil === 1 ? 'amanhã' : `${daysUntil} dias`}`, color: 'blue' });
        }
      }
      setAlerts(newAlerts);
    } catch (err) {
      console.error('Erro ao carregar estatisticas', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const checkSystemHealth = async () => {
    try {
      const res = await apiClient.get('/health').catch(() => null);
      if (res && res.data) {
        setSystemHealth({
          api: true,
          db: res.data.database === 'connected' || res.data.status === 'ok',
          redis: res.data.redis === 'connected' || res.data.status === 'ok',
        });
      } else {
        setSystemHealth({ api: false, db: false, redis: false });
      }
    } catch {
      setSystemHealth({ api: false, db: false, redis: false });
    }
  };

  const fetchRecentPunches = async () => {
    try {
      const response = await apiClient.get('/punches/raw', { params: { take: 8 } });
      setRecentPunches(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar batidas recentes', error);
    }
  };

  const fetchWeekData = async () => {
    try {
      const today = new Date();
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const days: WeekDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        days.push({
          label: dayNames[d.getDay()],
          date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          count: 0,
          isToday: i === 0,
        });
      }
      // Fetch last 7 days of punches
      const startD = new Date(today);
      startD.setDate(startD.getDate() - 6);
      const startStr = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
      const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const res = await apiClient.get('/punches/raw', { params: { take: 2000, startDate: startStr, endDate: endStr } }).catch(() => ({ data: { data: [] } }));
      const punches = res.data.data || [];
      punches.forEach((p: any) => {
        if (!p.punchTime) return;
        const pDate = new Date(p.punchTime);
        const pStr = `${String(pDate.getDate()).padStart(2, '0')}/${String(pDate.getMonth() + 1).padStart(2, '0')}`;
        const day = days.find((d) => d.date === pStr);
        if (day) day.count++;
      });
      setWeekData(days);
    } catch (err) {
      console.error('Erro ao carregar dados da semana', err);
    }
  };

  if (loading || !isAuthenticated) return null;

  const greeting = currentTime.getHours() < 12 ? 'Bom dia' : currentTime.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  const formatPunchTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      if (isToday) return `Hoje, ${time}`;
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${time}`;
    } catch {
      return dateStr;
    }
  };

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
      label: 'Presentes Hoje',
      value: stats.todayPresent,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'teal',
      href: '/punches',
    },
    {
      label: 'Folhas Pendentes',
      value: stats.pendingTimesheets,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'amber',
      href: '/timesheets',
    },
    {
      label: 'Registros Hoje',
      value: stats.todayPunches,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'violet',
      href: '/punches',
    },
  ];

  const colorMap: Record<string, { iconBg: string; text: string }> = {
    indigo: { iconBg: 'bg-indigo-500/10', text: 'text-indigo-500' },
    emerald: { iconBg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    amber: { iconBg: 'bg-amber-500/10', text: 'text-amber-500' },
    violet: { iconBg: 'bg-violet-500/10', text: 'text-violet-500' },
    teal: { iconBg: 'bg-teal-500/10', text: 'text-teal-500' },
  };

  const quickLinks = [
    { label: 'Colaboradores', href: '/employees', desc: 'Gerenciar equipe' },
    { label: 'Registros', href: '/punches', desc: 'Ver batidas' },
    { label: 'Relatorios', href: '/reports', desc: 'Gerar relatorios' },
    { label: 'Escalas', href: '/schedules', desc: 'Horarios de trabalho' },
    { label: 'Folhas de Ponto', href: '/timesheets', desc: 'Controle mensal' },
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

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => {
            const alertColors: Record<string, string> = {
              amber: 'bg-amber-50 border-amber-200 text-amber-800',
              red: 'bg-red-50 border-red-200 text-red-800',
              blue: 'bg-blue-50 border-blue-200 text-blue-800',
            };
            const iconColors: Record<string, string> = {
              amber: 'text-amber-500',
              red: 'text-red-500',
              blue: 'text-blue-500',
            };
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${alertColors[alert.color] || alertColors.blue}`}>
                <svg className={`w-5 h-5 flex-shrink-0 ${iconColors[alert.color] || iconColors.blue}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {alert.type === 'warning' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />}
                  {alert.type === 'alert' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  {alert.type === 'info' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                </svg>
                <span className="text-sm font-medium">{alert.message}</span>
              </div>
            );
          })}
        </div>
      )}

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

      {/* Weekly Chart */}
      {weekData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Registros dos Últimos 7 Dias</h2>
          <div className="flex items-end justify-between gap-2" style={{ height: '160px' }}>
            {weekData.map((day, i) => {
              const maxCount = Math.max(...weekData.map((d) => d.count), 1);
              const heightPct = Math.max((day.count / maxCount) * 100, 4);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="text-xs font-semibold text-slate-600 mb-1">{day.count || ''}</div>
                  <div
                    className={`w-full max-w-[40px] rounded-t-md transition-all duration-500 ${day.isToday ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <div className={`text-xs mt-2 ${day.isToday ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>
                    {day.label}
                  </div>
                  <div className={`text-[10px] ${day.isToday ? 'text-indigo-500' : 'text-slate-300'}`}>
                    {day.date}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Punches */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Registros Recentes</h2>
            <Link href="/punches" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Ver todos &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {recentPunches.length > 0 ? recentPunches.map((punch) => (
              <div key={punch.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-600">
                      {punch.employee?.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700">{punch.employee?.name || 'Desconhecido'}</div>
                    <div className="text-xs text-slate-400">{punch.device?.name || 'Sem dispositivo'}</div>
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {formatPunchTime(punch.punchTime)}
                </div>
              </div>
            )) : (
              <div className="text-center py-6 text-slate-400 text-sm">
                Nenhum registro recente encontrado.
              </div>
            )}
          </div>
        </div>

        {/* Quick Links + Status */}
        <div className="space-y-6">
          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Acesso Rapido</h2>
            <div className="space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition-colors border border-slate-100 group"
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
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Status do Sistema</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${systemHealth.api ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${systemHealth.api ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {systemHealth.api ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="space-y-2">
              {[
                { name: 'API', status: systemHealth.api ? 'OK' : 'Erro', ok: systemHealth.api },
                { name: 'Banco de Dados', status: systemHealth.db ? 'Conectado' : 'Verificando...', ok: systemHealth.db },
                { name: 'Redis', status: systemHealth.redis ? 'Conectado' : 'Verificando...', ok: systemHealth.redis },
                { name: 'Dispositivos', status: stats.devices > 0 ? `${stats.devices} cadastrado(s)` : 'Nenhum', ok: stats.devices > 0 },
              ].map((service) => (
                <div key={service.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${service.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className="text-sm text-slate-600">{service.name}</span>
                  </div>
                  <span className={`text-xs font-medium ${service.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {service.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Holiday */}
          {stats.nextHoliday && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
              <h2 className="text-sm font-semibold text-blue-900 mb-2">Próximo Feriado</h2>
              <div className="text-lg font-bold text-blue-800">{stats.nextHoliday.name}</div>
              <div className="text-sm text-blue-600 mt-1">
                {new Date(stats.nextHoliday.date).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
