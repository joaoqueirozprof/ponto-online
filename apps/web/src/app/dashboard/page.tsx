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
  monthlyOvertimeMinutes: number;
  employeesNoPunch: number;
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
    employees: 0, branches: 0, devices: 0, devicesOnline: 0, pendingTimesheets: 0, approvedTimesheets: 0, todayPunches: 0, todayPresent: 0, nextHoliday: null, monthlyOvertimeMinutes: 0, employeesNoPunch: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentPunches, setRecentPunches] = useState<RecentPunch[]>([]);
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [systemHealth, setSystemHealth] = useState<{ api: boolean; db: boolean; redis: boolean }>({ api: false, db: false, redis: false });
  const [alerts, setAlerts] = useState<{ type: string; message: string; color: string; href?: string; actionLabel?: string }[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dashboard_dismissed_alerts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.month === new Date().getMonth() + 1 && parsed.year === new Date().getFullYear()) {
          return new Set(parsed.dismissed as string[]);
        }
      }
    } catch {}
    return new Set();
  });

  const dismissAlert = (message: string) => {
    setDismissedAlerts(prev => {
      const next = new Set([...prev, message]);
      try {
        const now = new Date();
        localStorage.setItem('dashboard_dismissed_alerts', JSON.stringify({
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          dismissed: [...next],
        }));
      } catch {}
      return next;
    });
  };

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
        apiClient.get('/branches', { params: { take: 50 } }).catch(() => ({ data: { data: [], total: 0 } })),
        apiClient.get('/devices', { params: { take: 999 } }).catch(() => ({ data: { data: [], total: 0 } })),
        apiClient.get('/timesheets', { params: { take: 1, month: currentMonth, year: currentYear, status: 'OPEN' } }).catch(() => ({ data: { total: 0 } })),
        apiClient.get('/timesheets', { params: { take: 1, month: currentMonth, year: currentYear, status: 'APPROVED' } }).catch(() => ({ data: { total: 0 } })),
        apiClient.get('/punches/raw', { params: { take: 500 } }).catch(() => ({ data: { data: [], total: 0 } })),
        apiClient.get('/holidays', { params: { take: 50, year: currentYear } }).catch(() => ({ data: { data: [] } })),
      ]);

      const devices = deviceRes.data.data || [];
      const onlineDevices = devices.filter((d: any) => d.status === 'online').length;

      // Fetch monthly overtime from first branch report
      let monthlyOvertimeMinutes = 0;
      let employeesNoPunch = 0;
      const allBranches = branchRes.data.data || [];
      if (allBranches.length > 0) {
        try {
          const branchReports = await Promise.all(
            allBranches.map((b: any) =>
              apiClient.get(`/reports/branch/${b.id}/${currentMonth}/${currentYear}`)
                .catch(() => ({ data: { summary: { totalOvertimeMinutes: 0, employeesWithoutPunches: 0 } } }))
            )
          );
          for (const br of branchReports) {
            monthlyOvertimeMinutes += br.data.summary?.totalOvertimeMinutes || 0;
            employeesNoPunch += br.data.summary?.employeesWithoutPunches || 0;
          }
        } catch { /* ignore */ }
      }

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
        branches: branchRes.data.total || allBranches.length || 0,
        devices: deviceRes.data.total || devices.length || 0,
        devicesOnline: onlineDevices,
        pendingTimesheets: tsOpenRes.data.total || 0,
        approvedTimesheets: tsApprovedRes.data.total || 0,
        todayPunches: todayPunches.length,
        todayPresent: uniqueEmployeesToday.size,
        nextHoliday,
        monthlyOvertimeMinutes,
        employeesNoPunch,
      };
      setStats(newStats);

      // Build alerts
      const newAlerts: { type: string; message: string; color: string; href?: string; actionLabel?: string }[] = [];
      if (newStats.pendingTimesheets > 0) {
        newAlerts.push({ type: 'warning', message: `${newStats.pendingTimesheets} folha(s) de ponto pendente(s) de aprovação`, color: 'amber', href: '/timesheets', actionLabel: 'Revisar' });
      }
      if (newStats.employeesNoPunch > 0) {
        newAlerts.push({ type: 'alert', message: `${newStats.employeesNoPunch} colaborador(es) sem registro de ponto no mês`, color: 'red', href: '/reports', actionLabel: 'Ver Relatório' });
      }
      if (newStats.monthlyOvertimeMinutes > 0) {
        const otH = Math.floor(newStats.monthlyOvertimeMinutes / 60);
        const otM = newStats.monthlyOvertimeMinutes % 60;
        newAlerts.push({ type: 'info', message: `Total de horas extras no mês: ${otH}h${otM > 0 ? String(otM).padStart(2,'0')+'min' : ''}`, color: 'blue', href: '/overtime', actionLabel: 'Ver Detalhes' });
      }
      if (newStats.employees > 0 && newStats.todayPresent === 0 && now.getHours() >= 9 && now.getDay() >= 1 && now.getDay() <= 5) {
        newAlerts.push({ type: 'alert', message: 'Nenhum colaborador registrou ponto hoje', color: 'red', href: '/punches', actionLabel: 'Ver Registros' });
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
      const isToday = d.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' }) === today.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
      const time = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hour12: false });
      if (isToday) return `Hoje, ${time}`;
      const datePart = d.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza', day: '2-digit', month: '2-digit' });
      return `${datePart} ${time}`;
    } catch {
      return dateStr;
    }
  };

  const fmtHHMM = (m: number) => {
    if (!m) return '0h';
    return `${Math.floor(m / 60)}h${m % 60 > 0 ? String(m % 60).padStart(2,'0')+'min' : ''}`;
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
    {
      label: 'Horas Extras (Mês)',
      value: fmtHHMM(stats.monthlyOvertimeMinutes),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'orange',
      href: '/overtime',
    },
    {
      label: 'Sem Registro (Mês)',
      value: stats.employeesNoPunch,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      color: stats.employeesNoPunch > 0 ? 'red' : 'slate',
      href: '/overtime',
    },
  ];

  const colorMap: Record<string, { iconBg: string; text: string }> = {
    indigo: { iconBg: 'bg-indigo-500/10', text: 'text-indigo-500' },
    emerald: { iconBg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    amber: { iconBg: 'bg-amber-500/10', text: 'text-amber-500' },
    violet: { iconBg: 'bg-violet-500/10', text: 'text-violet-500' },
    teal: { iconBg: 'bg-teal-500/10', text: 'text-teal-500' },
    orange: { iconBg: 'bg-orange-500/10', text: 'text-orange-500' },
    red: { iconBg: 'bg-red-500/10', text: 'text-red-500' },
    slate: { iconBg: 'bg-slate-500/10', text: 'text-slate-500' },
  };

  const quickLinks = [
    { label: 'Colaboradores', href: '/employees', desc: 'Gerenciar equipe', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'text-indigo-500' },
    { label: 'Registros', href: '/punches', desc: 'Ver batidas', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-violet-500' },
    { label: 'Horas Extras', href: '/overtime', desc: 'Relatório rápido RH', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-emerald-500' },
    { label: 'Relatórios', href: '/reports', desc: 'Gerar relatórios', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'text-blue-500' },
    { label: 'Escalas', href: '/schedules', desc: 'Horários de trabalho', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'text-amber-500' },
    { label: 'Folhas de Ponto', href: '/timesheets', desc: 'Controle mensal', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'text-teal-500' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
      {/* Header Premium */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 mb-6 text-white shadow-2xl border border-white/10">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-indigo-500/20 blur-[80px]"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-purple-500/20 blur-[80px]"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {greeting}, <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{user?.name?.split(' ')[0] || 'Usuário'}</span>
            </h1>
            <p className="text-slate-300 mt-2 font-medium max-w-lg">
              Bem-vindo ao centro de controle do seu sistema de gestão de ponto eletrônico.
            </p>
          </div>
          <div className="text-left md:text-right bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-inner">
            <div className="text-2xl font-bold text-white tabular-nums font-mono">
              {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-sm text-indigo-200 mt-1 font-medium">
              {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.filter((a) => !dismissedAlerts.has(a.message)).length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => {
            if (dismissedAlerts.has(alert.message)) return null;
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
            const btnColors: Record<string, string> = {
              amber: 'bg-amber-600 hover:bg-amber-700 text-white',
              red: 'bg-red-600 hover:bg-red-700 text-white',
              blue: 'bg-blue-600 hover:bg-blue-700 text-white',
            };
            const closeBtnColors: Record<string, string> = {
              amber: 'text-amber-400 hover:text-amber-600 hover:bg-amber-100',
              red: 'text-red-400 hover:text-red-600 hover:bg-red-100',
              blue: 'text-blue-400 hover:text-blue-600 hover:bg-blue-100',
            };
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${alertColors[alert.color] || alertColors.blue}`}>
                <svg className={`w-5 h-5 flex-shrink-0 ${iconColors[alert.color] || iconColors.blue}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {alert.type === 'warning' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />}
                  {alert.type === 'alert' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  {alert.type === 'info' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                </svg>
                <span className="text-sm font-medium flex-1">{alert.message}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {alert.href && (
                    <Link
                      href={alert.href}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${btnColors[alert.color] || btnColors.blue}`}
                    >
                      {alert.actionLabel || 'Resolver'}
                    </Link>
                  )}
                  <button
                    onClick={() => dismissAlert(alert.message)}
                    className={`p-1 rounded-md transition-colors ${closeBtnColors[alert.color] || closeBtnColors.blue}`}
                    title="Dispensar notificação"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Grid - Glassmorphism */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const colors = colorMap[stat.color];
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white/80 backdrop-blur-xl border border-white/80 rounded-2xl p-5 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:-translate-y-1 hover:bg-white transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${colors.iconBg} rounded-xl flex items-center justify-center ${colors.text} shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                  {stat.icon}
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="text-3xl font-black text-slate-800 tracking-tight">
                {statsLoading ? (
                  <div className="h-9 w-16 bg-slate-200 rounded-lg animate-pulse" />
                ) : (
                  stat.value
                )}
              </div>
              <div className="text-sm font-semibold text-slate-500 mt-1">{stat.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Weekly Chart Premium */}
      {weekData.length > 0 && (
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/80 p-6 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800">Registros dos Últimos 7 Dias</h2>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
          </div>
          <div className="flex items-end justify-between gap-3 sm:gap-4 relative" style={{ height: '180px' }}>
            {/* Guide lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="w-full border-t border-slate-200/50"></div>
              <div className="w-full border-t border-slate-200/50"></div>
              <div className="w-full border-t border-slate-200/50"></div>
              <div className="w-full border-t border-slate-200/50"></div>
            </div>
            
            {weekData.map((day, i) => {
              const maxCount = Math.max(...weekData.map((d) => d.count), 1);
              const heightPct = Math.max((day.count / maxCount) * 100, 6);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative z-10 group cursor-default">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-800 text-white text-xs font-bold py-1 px-2 rounded-md whitespace-nowrap shadow-lg">
                    {day.count} batidas
                  </div>
                  <div className="text-sm font-bold text-slate-700 mb-1.5">{day.count > 0 ? day.count : ''}</div>
                  <div
                    className={`w-full max-w-[48px] rounded-t-xl transition-all duration-700 ease-out shadow-inner relative overflow-hidden ${day.isToday ? 'bg-gradient-to-t from-indigo-500 to-indigo-400' : 'bg-gradient-to-t from-indigo-200 to-indigo-100 hover:from-indigo-300 hover:to-indigo-200'}`}
                    style={{ height: `${heightPct}%` }}
                  >
                    {day.isToday && <div className="absolute top-0 left-0 right-0 h-2 bg-white/20"></div>}
                  </div>
                  <div className={`text-sm mt-3 ${day.isToday ? 'font-black text-indigo-600' : 'font-semibold text-slate-500'}`}>
                    {day.label}
                  </div>
                  <div className={`text-[10px] font-medium ${day.isToday ? 'text-indigo-400' : 'text-slate-400'}`}>
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
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/80 p-6 shadow-xl shadow-slate-200/50">
            <h2 className="text-lg font-bold text-slate-800 mb-5">Acesso Rápido</h2>
            <div className="space-y-3">
              {quickLinks.map((link, idx) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-white border border-transparent hover:border-slate-100 transition-all duration-200 group shadow-sm hover:shadow-md bg-slate-50/50"
                  style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white shadow-sm border border-slate-100 ${link.color} group-hover:scale-110 transition-transform`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{link.label}</div>
                    <div className="text-xs font-medium text-slate-500">{link.desc}</div>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-3xl border border-slate-700 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-[50px] pointer-events-none"></div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="text-lg font-bold text-white">Status do Sistema</h2>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full shadow-inner ${systemHealth.api ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${systemHealth.api ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {systemHealth.api ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="space-y-3 relative z-10">
              {[
                { name: 'API Services', status: systemHealth.api ? 'Operacional' : 'Erro Crítico', ok: systemHealth.api },
                { name: 'Banco de Dados', status: systemHealth.db ? 'Conectado' : 'Verificando...', ok: systemHealth.db },
                { name: 'Redis Cache', status: systemHealth.redis ? 'Conectado' : 'Verificando...', ok: systemHealth.redis },
                { name: 'Integração de Relógios', status: stats.devices > 0 ? `${stats.devices} ativos` : 'Nenhum', ok: stats.devices > 0 },
              ].map((service) => (
                <div key={service.name} className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${service.ok ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500'}`} />
                    <span className="text-sm font-semibold text-slate-200">{service.name}</span>
                  </div>
                  <span className={`text-xs font-bold ${service.ok ? 'text-emerald-400' : 'text-slate-400'}`}>
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
