'use client';

import { apiClient } from '@/lib/api';
import { useEffect, useState, useCallback } from 'react';

interface Branch { id: string; name: string; }

interface OvertimeEmployee {
  employee: {
    id: string;
    name: string;
    cpf: string;
    position: string;
    department: string;
  };
  workedMinutes: number;
  workedHours: string;
  expectedMinutes: number;
  expectedHours: string;
  overtimeMinutes: number;
  overtimeHours: string;
  nightMinutes: number;
  lateMinutes: number;
  absenceMinutes: number;
  balanceMinutes: number;
  status: string;
  hasPunches: boolean;
  daysWorked: number;
}

const fmtHHMM = (m: number): string => {
  if (!m || m === 0) return '00:00';
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

const MONTHS = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

export default function OvertimePage() {
  const now = new Date();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<OvertimeEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'with_overtime' | 'no_punch'>('with_overtime');
  const [minHours, setMinHours] = useState('0');
  const [searchEmployee, setSearchEmployee] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    apiClient.get('/branches', { params: { take: 50 } })
      .then(r => {
        const list: Branch[] = r.data.data || [];
        setBranches(list);
        if (list.length > 0) setSelectedBranch(list[0].id);
      })
      .catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      const r = await apiClient.get(`/reports/payroll/${selectedBranch}/${month}/${year}`);
      setData(r.data.payrollData || []);
      setFetched(true);
    } catch {
      setToast('Erro ao carregar relatório.');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, month, year]);

  const filtered = data.filter(e => {
    if (filterMode === 'with_overtime') return e.overtimeMinutes > 0;
    if (filterMode === 'no_punch') return !e.hasPunches;
    return true;
  }).filter(e => {
    const minMin = parseFloat(minHours) * 60;
    return e.overtimeMinutes >= minMin;
  }).filter(e => {
    if (!searchEmployee.trim()) return true;
    return e.employee.name.toLowerCase().includes(searchEmployee.toLowerCase());
  }).filter(e => {
    if (!selectedEmployee) return true;
    return e.employee.id === selectedEmployee;
  }).sort((a, b) => b.overtimeMinutes - a.overtimeMinutes);

  const totalOT = filtered.reduce((s, e) => s + e.overtimeMinutes, 0);
  const totalWorked = data.reduce((s, e) => s + e.workedMinutes, 0);
  const withPunches = data.filter(e => e.hasPunches).length;
  const noPunch = data.filter(e => !e.hasPunches).length;

  const generatePDF = () => {
    const mLabel = MONTHS.find(m2 => m2.value === month)?.label || month;
    const bName = branches.find(b => b.id === selectedBranch)?.name || '';
    const totalWorkedF = filtered.reduce((s, e) => s + e.workedMinutes, 0);
    const totalExpectedF = filtered.reduce((s, e) => s + e.expectedMinutes, 0);
    const totalOTF = filtered.reduce((s, e) => s + e.overtimeMinutes, 0);
    const totalLateF = filtered.reduce((s, e) => s + e.lateMinutes, 0);
    const totalDaysF = filtered.reduce((s, e) => s + e.daysWorked, 0);

    const rowsHtml = filtered.map((item, i) => {
      const otClass = item.overtimeMinutes > 480 ? 'color:#dc2626;font-weight:700' :
        item.overtimeMinutes > 240 ? 'color:#d97706;font-weight:700' :
        item.overtimeMinutes > 0 ? 'color:#16a34a;font-weight:700' : 'color:#94a3b8';
      const noPunchStyle = !item.hasPunches ? 'opacity:0.6' : '';
      return `
        <tr style="${noPunchStyle}">
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#94a3b8;font-size:11px">${i + 1}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">
            <div style="font-weight:600;color:#0f172a;font-size:12px">${item.employee.name}</div>
            <div style="color:#94a3b8;font-size:10px">${item.employee.cpf}</div>
          </td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">
            <div style="color:#475569;font-size:11px">${item.employee.position || '—'}</div>
            <div style="color:#94a3b8;font-size:10px">${item.employee.department || '—'}</div>
          </td>
          <td contenteditable="true" style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;outline:none;cursor:text" onfocus="this.style.background='#eff6ff';this.style.borderRadius='4px'" onblur="this.style.background='transparent'">
            ${item.hasPunches ? fmtHHMM(item.workedMinutes) : 'Sem ponto'}
          </td>
          <td contenteditable="true" style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;color:#64748b;outline:none;cursor:text" onfocus="this.style.background='#eff6ff';this.style.borderRadius='4px'" onblur="this.style.background='transparent'">${fmtHHMM(item.expectedMinutes)}</td>
          <td contenteditable="true" style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;${otClass};outline:none;cursor:text" onfocus="this.style.background='#eff6ff';this.style.borderRadius='4px'" onblur="this.style.background='transparent'">${fmtHHMM(item.overtimeMinutes)}</td>
          <td contenteditable="true" style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;color:${item.lateMinutes > 0 ? '#ef4444' : '#94a3b8'};outline:none;cursor:text" onfocus="this.style.background='#eff6ff';this.style.borderRadius='4px'" onblur="this.style.background='transparent'">${fmtHHMM(item.lateMinutes)}</td>
          <td contenteditable="true" style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px;color:#475569;outline:none;cursor:text" onfocus="this.style.background='#eff6ff';this.style.borderRadius='4px'" onblur="this.style.background='transparent'">${item.daysWorked}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Horas Extras — ${bName} — ${mLabel}/${year}</title>
      <style>
        @media print { #toolbar { display: none !important; } }
        @page { margin: 15mm; size: A4 landscape; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #4f46e5; }
        .header-left h1 { font-size: 18px; font-weight: 700; color: #1e293b; }
        .header-left p { color: #64748b; font-size: 12px; margin-top: 2px; }
        .header-right { text-align: right; }
        .header-right .branch { font-size: 14px; font-weight: 600; color: #4f46e5; }
        .header-right .period { font-size: 12px; color: #64748b; margin-top: 2px; }
        .summary { display: flex; gap: 12px; margin-bottom: 16px; }
        .card { flex: 1; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .card .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .card .value { font-size: 18px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #f8fafc; }
        th { padding: 8px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        th.right { text-align: right; }
        tfoot tr { background: #f1f5f9; }
        tfoot td { padding: 8px; font-weight: 700; font-size: 12px; border-top: 2px solid #cbd5e1; }
        .legend { margin-top: 12px; display: flex; gap: 16px; font-size: 10px; color: #64748b; }
        .legend span { display: flex; align-items: center; gap: 4px; }
        .dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
        .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>
    </head><body>
      <div class="header">
        <div class="header-left">
          <h1>Relatório de Horas Extras</h1>
          <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <div class="header-right">
          <div class="branch">${bName}</div>
          <div class="period">${mLabel} / ${year}</div>
        </div>
      </div>

      <div class="summary">
        <div class="card">
          <div class="label">Total Funcionários</div>
          <div class="value" style="color:#1e293b">${data.length}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${withPunches} com ponto · ${noPunch} sem ponto</div>
        </div>
        <div class="card" style="border-color:#fde68a">
          <div class="label" style="color:#d97706">Total Horas Extras</div>
          <div class="value" style="color:#d97706;font-family:monospace">${fmtHHMM(totalOT)}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${filtered.filter(e => e.overtimeMinutes > 0).length} funcionários</div>
        </div>
        <div class="card">
          <div class="label">Total Trabalhadas</div>
          <div class="value" style="color:#1e293b;font-family:monospace">${fmtHHMM(totalWorked)}</div>
        </div>
        <div class="card" style="border-color:${noPunch > 0 ? '#fecaca' : '#e2e8f0'}">
          <div class="label" style="color:${noPunch > 0 ? '#ef4444' : '#94a3b8'}">Sem Registro</div>
          <div class="value" style="color:${noPunch > 0 ? '#dc2626' : '#1e293b'}">${noPunch}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Colaborador</th>
            <th>Cargo / Setor</th>
            <th class="right">Trabalhadas</th>
            <th class="right">Previstas</th>
            <th class="right" style="color:#d97706">H. Extras</th>
            <th class="right">Atrasos</th>
            <th class="right">Dias</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        ${filtered.length > 0 ? `<tfoot>
          <tr>
            <td colspan="3" style="padding:8px;color:#475569;font-size:11px">TOTAL — ${filtered.length} colaboradores</td>
            <td style="padding:8px;text-align:right;font-family:monospace;color:#1e293b">${fmtHHMM(totalWorkedF)}</td>
            <td style="padding:8px;text-align:right;font-family:monospace;color:#64748b">${fmtHHMM(totalExpectedF)}</td>
            <td style="padding:8px;text-align:right;font-family:monospace;color:#d97706">${fmtHHMM(totalOTF)}</td>
            <td style="padding:8px;text-align:right;font-family:monospace;color:#ef4444">${fmtHHMM(totalLateF)}</td>
            <td style="padding:8px;text-align:right;color:#475569">${totalDaysF}</td>
          </tr>
        </tfoot>` : ''}
      </table>

      <div class="legend">
        <span><span class="dot" style="background:#dcfce7;border:1px solid #86efac"></span>Normal (até 4h)</span>
        <span><span class="dot" style="background:#fef3c7;border:1px solid #fcd34d"></span>Atenção (4h–8h)</span>
        <span><span class="dot" style="background:#fee2e2;border:1px solid #fca5a5"></span>Excessivo (acima de 8h)</span>
      </div>

      <div class="footer">Ponto Online — Relatório gerado automaticamente • ${bName} • ${mLabel}/${year}</div>

      <script>
        function imprimirRelatorio() {
          document.getElementById('toolbar').style.display = 'none';
          window.print();
          document.getElementById('toolbar').style.display = 'flex';
        }
      </script>
      <div id="toolbar" style="position:fixed;top:0;left:0;right:0;background:#4f46e5;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="color:white;font-size:13px;font-weight:600">Pre-visualizacao do Relatorio</span>
          <span style="color:rgba(255,255,255,0.7);font-size:11px">Clique em qualquer valor da tabela para editar antes de imprimir</span>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="imprimirRelatorio()" style="background:white;color:#4f46e5;border:none;padding:8px 20px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer">Imprimir / Salvar PDF</button>
          <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.3);padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer">Fechar</button>
        </div>
      </div>
      <div style="height:50px"></div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const getOTColor = (min: number) => {
    if (min === 0) return 'text-slate-400';
    if (min <= 240) return 'text-emerald-600';
    if (min <= 480) return 'text-amber-600';
    return 'text-red-600';
  };

  const getOTBadge = (min: number) => {
    if (min === 0) return null;
    if (min <= 240) return { label: 'Normal', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (min <= 480) return { label: 'Atenção', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Excessivo', cls: 'bg-red-50 text-red-700 border-red-200' };
  };

  const monthLabel = MONTHS.find(m2 => m2.value === month)?.label || '';
  const branchName = branches.find(b => b.id === selectedBranch)?.name || '';

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Horas Extras</h1>
          <p className="text-slate-500 mt-1">Relatório de horas extras por colaborador — geração rápida para o RH</p>
        </div>
        {fetched && (
          <div className="flex gap-2">
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Exportar PDF
            </button>
          </div>
        )}
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Relatório de Horas Extras — {branchName}</h1>
        <p className="text-sm text-gray-600">{monthLabel}/{year}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 print:hidden">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Filtros</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Filial</label>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Mês</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {MONTHS.map(m2 => (
                <option key={m2.value} value={m2.value}>{m2.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Ano</label>
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {['2024', '2025', '2026'].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Min. Horas Extras</label>
            <input
              type="number"
              value={minHours}
              min="0"
              step="1"
              onChange={e => setMinHours(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0"
            />
          </div>
        </div>

        {/* Employee filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Funcionario Individual</label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className={`w-full h-9 px-3 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${selectedEmployee ? 'border-violet-400 text-violet-900 font-medium' : 'border-slate-200'}`}
            >
              <option value="">Todos os funcionarios</option>
              {data.sort((a, b) => a.employee.name.localeCompare(b.employee.name)).map(e => (
                <option key={e.employee.id} value={e.employee.id}>
                  {e.employee.name} — {e.employee.position || 'Sem cargo'} ({fmtHHMM(e.overtimeMinutes)} extras)
                </option>
              ))}
            </select>
            {selectedEmployee && (
              <p className="text-xs text-violet-600 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Relatorio individual selecionado
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Buscar por nome</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={searchEmployee}
                onChange={e => setSearchEmployee(e.target.value)}
                className="w-full h-9 pl-10 pr-4 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchEmployee && (
                <button
                  onClick={() => setSearchEmployee('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-4">
          {[
            { value: 'with_overtime', label: 'Com Horas Extras' },
            { value: 'all', label: 'Todos' },
            { value: 'no_punch', label: 'Sem Ponto' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterMode(opt.value as typeof filterMode)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                filterMode === opt.value
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchReport}
          disabled={loading || !selectedBranch}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Carregando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Gerar Relatório
            </>
          )}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Summary cards */}
      {fetched && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Total Funcionários</p>
              <p className="text-2xl font-bold text-slate-900">{data.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">{withPunches} com ponto · {noPunch} sem ponto</p>
            </div>
            <div className="bg-white rounded-xl border border-amber-200 p-4">
              <p className="text-xs text-amber-600 mb-1">Total Horas Extras</p>
              <p className="text-2xl font-bold text-amber-700">{fmtHHMM(totalOT)}</p>
              <p className="text-xs text-amber-500 mt-0.5">{filtered.filter(e => e.overtimeMinutes > 0).length} funcionários</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Total Trabalhadas</p>
              <p className="text-2xl font-bold text-slate-900">{fmtHHMM(totalWorked)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{monthLabel}/{year}</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 ${noPunch > 0 ? 'border-red-200' : 'border-slate-200'}`}>
              <p className={`text-xs mb-1 ${noPunch > 0 ? 'text-red-500' : 'text-slate-500'}`}>Sem Registro</p>
              <p className={`text-2xl font-bold ${noPunch > 0 ? 'text-red-600' : 'text-slate-900'}`}>{noPunch}</p>
              <p className="text-xs text-slate-400 mt-0.5">funcionários sem ponto</p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 print:hidden">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block"></span> Normal (até 4h)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 inline-block"></span> Atenção (4h–8h)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 inline-block"></span> Excessivo (acima de 8h)</span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {branchName} — {monthLabel}/{year}
              </h2>
              <span className="text-xs text-slate-400">{filtered.length} colaboradores</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Colaborador</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cargo / Setor</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trabalhadas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Previstas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wide">H. Extras</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Atrasos</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dias</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nível</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        {loading ? 'Carregando...' : 'Nenhum colaborador encontrado com os filtros selecionados.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, i) => {
                      const badge = getOTBadge(item.overtimeMinutes);
                      return (
                        <tr
                          key={item.employee.id}
                          className={`hover:bg-slate-50 transition-colors ${!item.hasPunches ? 'opacity-60' : ''}`}
                        >
                          <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 truncate max-w-[200px]">{item.employee.name}</div>
                            <div className="text-xs text-slate-400">{item.employee.cpf}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-700 truncate max-w-[180px]">{item.employee.position || '—'}</div>
                            <div className="text-xs text-slate-400">{item.employee.department || '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {item.hasPunches ? (
                              <span className="text-slate-900">{fmtHHMM(item.workedMinutes)}</span>
                            ) : (
                              <span className="text-red-400 text-xs">Sem ponto</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">{fmtHHMM(item.expectedMinutes)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-mono font-semibold ${getOTColor(item.overtimeMinutes)}`}>
                              {fmtHHMM(item.overtimeMinutes)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">
                            {item.lateMinutes > 0 ? (
                              <span className="text-red-500">{fmtHHMM(item.lateMinutes)}</span>
                            ) : '00:00'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{item.daysWorked}</td>
                          <td className="px-4 py-3 text-center">
                            {badge ? (
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border ${badge.cls}`}>
                                {badge.label}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                        {fmtHHMM(filtered.reduce((s, e) => s + e.workedMinutes, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {fmtHHMM(filtered.reduce((s, e) => s + e.expectedMinutes, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">
                        {fmtHHMM(totalOT)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-500">
                        {fmtHHMM(filtered.reduce((s, e) => s + e.lateMinutes, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {filtered.reduce((s, e) => s + e.daysWorked, 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {!fetched && !loading && (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">Selecione a filial, mês e ano</p>
          <p className="text-slate-400 text-sm mt-1">Depois clique em "Gerar Relatório" para ver as horas extras</p>
        </div>
      )}
    </div>
  );
}
