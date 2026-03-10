'use client';

import { apiClient } from '@/lib/api';
import { useEffect, useState, useCallback } from 'react';

interface Branch { id: string; name: string; }

interface SimpleEmployee {
  id: string;
  name: string;
  position: string;
}

interface DayDetail {
  date: string;
  dayOfWeek: number;
  status: string;
  workedMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  absenceMinutes: number;
  punchCount: number;
  punches: { time: string; type: string }[];
}

interface AdjustmentData {
  id?: string;
  field: string;
  originalMinutes: number;
  adjustedMinutes: number;
  reason: string;
  adjustedBy?: string;
  createdAt?: string;
}

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
  netOvertimeMinutes: number;
  netOvertimeHours: string;
  nightMinutes: number;
  lateMinutes: number;
  absenceMinutes: number;
  balanceMinutes: number;
  status: string;
  hasPunches: boolean;
  daysWorked: number;
  daysAbsent: number;
  daysIncomplete: number;
  dayDetails?: DayDetail[];
  adjustments?: Record<string, AdjustmentData>;
  adjustedOvertimeMinutes?: number;
  adjustedAbsenceMinutes?: number;
  adjustedLateMinutes?: number;
  adjustedNetOvertimeMinutes?: number;
}

const fmtHHMM = (m: number): string => {
  if (!m || m === 0) return '00:00';
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

const fmtBrtTime = (iso: string): string => {
  const d = new Date(iso);
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`;
};

const punchLabel = (type: string) => {
  switch (type) {
    case 'ENTRY': return 'Entrada';
    case 'EXIT': return 'Saída';
    case 'BREAK_START': return 'Início Intervalo';
    case 'BREAK_END': return 'Fim Intervalo';
    default: return type;
  }
};

const punchColor = (type: string) => {
  switch (type) {
    case 'ENTRY': return 'text-emerald-600 bg-emerald-50';
    case 'EXIT': return 'text-red-600 bg-red-50';
    case 'BREAK_START': return 'text-amber-600 bg-amber-50';
    case 'BREAK_END': return 'text-blue-600 bg-blue-50';
    default: return 'text-slate-600 bg-slate-50';
  }
};

const dayStatusLabel = (s: string) => {
  switch (s) {
    case 'NORMAL': return 'Normal';
    case 'HOLIDAY': return 'Feriado';
    case 'WEEKEND': return 'Fim de Semana';
    case 'ABSENCE': return 'Falta';
    case 'INCOMPLETE': return 'Incompleto';
    default: return s;
  }
};

const dayStatusColor = (s: string) => {
  switch (s) {
    case 'NORMAL': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'HOLIDAY': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'WEEKEND': return 'bg-slate-50 text-slate-600 border-slate-200';
    case 'ABSENCE': return 'bg-red-50 text-red-700 border-red-200';
    case 'INCOMPLETE': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

const DOW_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTHS = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

// ─── Punch Detail Modal ───
function PunchDetailModal({
  emp,
  month,
  year,
  onClose,
  onAdjustmentSaved,
}: {
  emp: OvertimeEmployee;
  month: string;
  year: string;
  onClose: () => void;
  onAdjustmentSaved: () => void;
}) {
  const [dayFilter, setDayFilter] = useState<'all' | 'overtime' | 'absence'>('all');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [adjustments, setAdjustments] = useState<AdjustmentData[]>([]);
  const [loadingAdj, setLoadingAdj] = useState(true);

  const days = emp.dayDetails || [];

  // Load adjustments
  useEffect(() => {
    setLoadingAdj(true);
    apiClient.get(`/reports/overtime-adjustments/${emp.employee.id}/${month}/${year}`)
      .then(r => {
        setAdjustments(r.data || []);
      })
      .catch(() => setAdjustments([]))
      .finally(() => setLoadingAdj(false));
  }, [emp.employee.id, month, year]);

  const filteredDays = days.filter(d => {
    if (dayFilter === 'overtime') return d.overtimeMinutes > 0;
    if (dayFilter === 'absence') return d.absenceMinutes > 0 || d.lateMinutes > 0 || d.status === 'ABSENCE';
    return true;
  });

  const startEdit = (field: string, currentMinutes: number) => {
    setEditingField(field);
    setEditMinutes(String(currentMinutes));
    setEditReason('');
    setSavedMsg('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditMinutes('');
    setEditReason('');
  };

  const saveAdjustment = async () => {
    if (!editingField || !editReason.trim()) return;
    setSaving(true);
    try {
      const originalMap: Record<string, number> = {
        overtime: emp.overtimeMinutes,
        absence: emp.absenceMinutes,
        late: emp.lateMinutes,
      };
      await apiClient.post('/reports/overtime-adjustment', {
        employeeId: emp.employee.id,
        month: Number(month),
        year: Number(year),
        field: editingField,
        originalMinutes: originalMap[editingField] || 0,
        adjustedMinutes: Number(editMinutes),
        reason: editReason.trim(),
      });
      setSavedMsg(`Ajuste de ${editingField === 'overtime' ? 'horas extras' : editingField === 'absence' ? 'faltas' : 'atrasos'} salvo!`);
      // Reload adjustments
      const r = await apiClient.get(`/reports/overtime-adjustments/${emp.employee.id}/${month}/${year}`);
      setAdjustments(r.data || []);
      setEditingField(null);
      setEditMinutes('');
      setEditReason('');
      setTimeout(() => setSavedMsg(''), 3000);
      onAdjustmentSaved();
    } catch (err: any) {
      setSavedMsg(`Erro: ${err?.response?.data?.message || err?.message || 'Falha'}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteAdjustment = async (adjId: string) => {
    if (!confirm('Excluir este ajuste?')) return;
    try {
      await apiClient.delete(`/reports/overtime-adjustment/${adjId}`);
      const r = await apiClient.get(`/reports/overtime-adjustments/${emp.employee.id}/${month}/${year}`);
      setAdjustments(r.data || []);
      onAdjustmentSaved();
    } catch {
      alert('Erro ao excluir ajuste');
    }
  };

  const adjFieldLabel = (f: string) => f === 'overtime' ? 'Horas Extras' : f === 'absence' ? 'Faltas' : f === 'late' ? 'Atrasos' : f;

  // Totals for the filtered view
  const totalOT = filteredDays.reduce((s, d) => s + d.overtimeMinutes, 0);
  const totalAbs = filteredDays.reduce((s, d) => s + d.absenceMinutes, 0);
  const totalLate = filteredDays.reduce((s, d) => s + d.lateMinutes, 0);
  const totalWorked = filteredDays.reduce((s, d) => s + d.workedMinutes, 0);
  const totalExpected = filteredDays.reduce((s, d) => s + d.expectedMinutes, 0);

  const mLabel = MONTHS.find(m => m.value === month)?.label || month;

  const generateEmployeePDF = () => {
    const allDays = emp.dayDetails || [];
    const tWorked = allDays.reduce((s, d) => s + d.workedMinutes, 0);
    const tExpected = allDays.reduce((s, d) => s + d.expectedMinutes, 0);
    const tOT = allDays.reduce((s, d) => s + d.overtimeMinutes, 0);
    const tAbs = allDays.reduce((s, d) => s + d.absenceMinutes, 0);
    const tLate = allDays.reduce((s, d) => s + d.lateMinutes, 0);
    const tNet = Math.max(0, tOT - tAbs);
    const daysWorked = allDays.filter(d => d.workedMinutes > 0).length;
    const daysAbsent = allDays.filter(d => d.status === 'ABSENCE').length;

    const rowsHtml = allDays.map(d => {
      const dateF = d.date.split('-').reverse().join('/');
      const dow = DOW_NAMES[d.dayOfWeek];
      const isWeekend = d.status === 'WEEKEND' || d.status === 'HOLIDAY';
      const isAbsence = d.status === 'ABSENCE';
      const rowStyle = isWeekend ? 'background:#f8fafc;color:#94a3b8;' : isAbsence ? 'background:#fef2f2;' : '';

      const punchesStr = d.punches.length === 0 ? '—' :
        d.punches
          .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
          .map(p => `${fmtBrtTime(p.time)} ${punchLabel(p.type)}`)
          .join(' · ');

      const statusMap: Record<string, string> = {
        NORMAL: 'Normal', WEEKEND: 'Fim de Semana', HOLIDAY: 'Feriado',
        ABSENCE: 'Falta', INCOMPLETE: 'Incompleto',
      };

      return `<tr style="${rowStyle}">
        <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;font-family:monospace">${dateF}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:11px">${dow}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:10px">${statusMap[d.status] || d.status}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#475569">${punchesStr}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-family:monospace">${fmtHHMM(d.workedMinutes)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-family:monospace;color:#94a3b8">${fmtHHMM(d.expectedMinutes)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-family:monospace;color:${d.overtimeMinutes > 0 ? '#16a34a' : '#cbd5e1'}">${d.overtimeMinutes > 0 ? fmtHHMM(d.overtimeMinutes) : '—'}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-family:monospace;color:${d.absenceMinutes > 0 ? '#dc2626' : '#cbd5e1'}">${d.absenceMinutes > 0 ? fmtHHMM(d.absenceMinutes) : '—'}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-family:monospace;color:${d.lateMinutes > 0 ? '#d97706' : '#cbd5e1'}">${d.lateMinutes > 0 ? fmtHHMM(d.lateMinutes) : '—'}</td>
      </tr>`;
    }).join('');

    // Adjustments section
    const adjHtml = adjustments.length > 0 ? `
      <div style="margin-top:16px;padding:10px 14px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px">
        <p style="font-size:11px;font-weight:700;color:#3730a3;margin-bottom:6px">Ajustes Realizados pelo RH:</p>
        ${adjustments.map(a => `
          <p style="font-size:10px;color:#4338ca;margin:3px 0">
            <strong>${a.field === 'overtime' ? 'Horas Extras' : a.field === 'absence' ? 'Faltas' : 'Atrasos'}:</strong>
            ${fmtHHMM(a.originalMinutes)} → <strong>${fmtHHMM(a.adjustedMinutes)}</strong>
            — Motivo: <em>"${a.reason}"</em>
            (${a.adjustedBy || 'RH'}${a.createdAt ? ' em ' + new Date(a.createdAt).toLocaleDateString('pt-BR') : ''})
          </p>
        `).join('')}
      </div>
    ` : '';

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Conferência — ${emp.employee.name} — ${mLabel}/${year}</title>
      <style>
        @media print { #toolbar { display: none !important; } body { margin: 0; } }
        @page { margin: 12mm; size: A4 portrait; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #f1f5f9; }
        th { padding: 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 2px solid #cbd5e1; }
        th.r { text-align: right; }
        tfoot td { padding: 6px; font-weight: 700; border-top: 2px solid #94a3b8; font-size: 11px; }
      </style>
    </head><body>

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid #4f46e5;margin-bottom:14px">
        <div>
          <h1 style="font-size:16px;font-weight:800;color:#1e293b;margin-bottom:2px">Relatório Individual de Ponto</h1>
          <p style="font-size:11px;color:#64748b">Conferência de batidas, horas extras e faltas</p>
        </div>
        <div style="text-align:right">
          <p style="font-size:13px;font-weight:700;color:#4f46e5">${mLabel} / ${year}</p>
          <p style="font-size:9px;color:#94a3b8">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <!-- Employee info -->
      <div style="display:flex;gap:20px;margin-bottom:14px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
        <div style="flex:1">
          <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Colaborador</p>
          <p style="font-size:14px;font-weight:700;color:#0f172a">${emp.employee.name}</p>
        </div>
        <div>
          <p style="font-size:9px;color:#94a3b8;text-transform:uppercase">Cargo</p>
          <p style="font-size:12px;font-weight:600;color:#334155">${emp.employee.position || '—'}</p>
        </div>
        <div>
          <p style="font-size:9px;color:#94a3b8;text-transform:uppercase">CPF</p>
          <p style="font-size:12px;font-weight:600;color:#334155;font-family:monospace">${emp.employee.cpf}</p>
        </div>
      </div>

      <!-- Summary cards -->
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:100px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;text-align:center">
          <p style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Trabalhadas</p>
          <p style="font-size:18px;font-weight:800;color:#0f172a;font-family:monospace">${fmtHHMM(tWorked)}</p>
        </div>
        <div style="flex:1;min-width:100px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;text-align:center">
          <p style="font-size:8px;color:#94a3b8;text-transform:uppercase">Previstas</p>
          <p style="font-size:18px;font-weight:800;color:#64748b;font-family:monospace">${fmtHHMM(tExpected)}</p>
        </div>
        <div style="flex:1;min-width:100px;padding:8px 10px;border:1px solid #86efac;border-radius:8px;text-align:center">
          <p style="font-size:8px;color:#16a34a;text-transform:uppercase;font-weight:600">H.E. Brutas</p>
          <p style="font-size:18px;font-weight:800;color:#16a34a;font-family:monospace">${fmtHHMM(tOT)}</p>
        </div>
        <div style="flex:1;min-width:100px;padding:8px 10px;border:1px solid #fecaca;border-radius:8px;text-align:center">
          <p style="font-size:8px;color:#dc2626;text-transform:uppercase;font-weight:600">Faltas</p>
          <p style="font-size:18px;font-weight:800;color:#dc2626;font-family:monospace">${fmtHHMM(tAbs)}</p>
        </div>
        <div style="flex:1;min-width:100px;padding:8px 10px;border:2px solid #fbbf24;border-radius:8px;text-align:center">
          <p style="font-size:8px;color:#d97706;text-transform:uppercase;font-weight:700">H.E. Líquidas</p>
          <p style="font-size:18px;font-weight:800;color:#d97706;font-family:monospace">${fmtHHMM(tNet)}</p>
        </div>
      </div>

      <!-- Calculation explanation -->
      <div style="padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:14px;font-size:11px;color:#92400e">
        <strong>Cálculo:</strong>
        <span style="font-family:monospace;font-weight:700;color:#16a34a">${fmtHHMM(tOT)}</span> (brutas)
        − <span style="font-family:monospace;font-weight:700;color:#dc2626">${fmtHHMM(tAbs)}</span> (faltas)
        = <span style="font-family:monospace;font-weight:700;color:#d97706">${fmtHHMM(tNet)}</span> (líquidas)
        · Dias trabalhados: <strong>${daysWorked}</strong> · Dias de falta: <strong>${daysAbsent}</strong> · Atrasos: <strong>${fmtHHMM(tLate)}</strong>
      </div>

      ${adjHtml}

      <!-- Daily table -->
      <table style="margin-top:${adjustments.length > 0 ? '14px' : '0'}">
        <thead>
          <tr>
            <th>Data</th><th>Dia</th><th>Status</th><th>Batidas</th>
            <th class="r">Trabalhadas</th><th class="r">Previstas</th>
            <th class="r" style="color:#16a34a">H. Extra</th>
            <th class="r" style="color:#dc2626">Falta</th>
            <th class="r" style="color:#d97706">Atraso</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#f1f5f9">
            <td colspan="4" style="padding:6px;font-size:10px;color:#475569;text-transform:uppercase">Total do Mês</td>
            <td style="padding:6px;text-align:right;font-family:monospace;color:#0f172a">${fmtHHMM(tWorked)}</td>
            <td style="padding:6px;text-align:right;font-family:monospace;color:#64748b">${fmtHHMM(tExpected)}</td>
            <td style="padding:6px;text-align:right;font-family:monospace;color:#16a34a">${fmtHHMM(tOT)}</td>
            <td style="padding:6px;text-align:right;font-family:monospace;color:#dc2626">${fmtHHMM(tAbs)}</td>
            <td style="padding:6px;text-align:right;font-family:monospace;color:#d97706">${fmtHHMM(tLate)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Signature area -->
      <div style="margin-top:40px;display:flex;gap:40px;justify-content:center">
        <div style="text-align:center;width:220px">
          <div style="border-top:1px solid #334155;padding-top:6px">
            <p style="font-size:10px;font-weight:600;color:#334155">${emp.employee.name}</p>
            <p style="font-size:9px;color:#94a3b8">Colaborador</p>
          </div>
        </div>
        <div style="text-align:center;width:220px">
          <div style="border-top:1px solid #334155;padding-top:6px">
            <p style="font-size:10px;font-weight:600;color:#334155">Responsável RH</p>
            <p style="font-size:9px;color:#94a3b8">Departamento Pessoal</p>
          </div>
        </div>
      </div>

      <div style="margin-top:20px;font-size:8px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:6px">
        Ponto Online v70 — Relatório individual gerado automaticamente · ${mLabel}/${year}
        · Este documento pode ser utilizado para conferência e eventual contestação junto ao RH.
      </div>

      <!-- Print toolbar -->
      <script>function imprimirDoc(){document.getElementById('toolbar').style.display='none';window.print();document.getElementById('toolbar').style.display='flex';}</script>
      <div id="toolbar" style="position:fixed;top:0;left:0;right:0;background:#4f46e5;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="color:white;font-size:13px;font-weight:600">Relatório de ${emp.employee.name}</span>
          <span style="color:rgba(255,255,255,0.7);font-size:11px">${mLabel}/${year} · Imprima ou salve como PDF</span>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="imprimirDoc()" style="background:white;color:#4f46e5;border:none;padding:8px 20px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer">Imprimir / Salvar PDF</button>
          <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.3);padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer">Fechar</button>
        </div>
      </div>
      <div style="height:50px"></div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 my-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{emp.employee.name}</h2>
            <p className="text-sm text-slate-500">{emp.employee.position || 'Sem cargo'} — CPF: {emp.employee.cpf}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateEmployeePDF}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              title="Gerar PDF para impressão"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Trabalhadas</p>
            <p className="text-lg font-bold font-mono text-slate-900">{fmtHHMM(emp.workedMinutes)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-emerald-600">H.E. Brutas</p>
            <p className="text-lg font-bold font-mono text-emerald-700">{fmtHHMM(emp.overtimeMinutes)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-red-500">Faltas</p>
            <p className="text-lg font-bold font-mono text-red-600">{fmtHHMM(emp.absenceMinutes)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-amber-600">H.E. Líquidas</p>
            <p className="text-lg font-bold font-mono text-amber-700">{fmtHHMM(emp.netOvertimeMinutes)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Atrasos</p>
            <p className="text-lg font-bold font-mono text-slate-700">{fmtHHMM(emp.lateMinutes)}</p>
          </div>
        </div>

        {/* HR Adjustment section */}
        <div className="px-6 py-4 border-b border-slate-200 bg-indigo-50/50">
          <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Ajustes do RH
          </h3>

          {/* Existing adjustments */}
          {loadingAdj ? (
            <p className="text-xs text-slate-400">Carregando ajustes...</p>
          ) : adjustments.length > 0 ? (
            <div className="space-y-2 mb-3">
              {adjustments.map(adj => (
                <div key={adj.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-indigo-100">
                  <span className="text-xs font-semibold text-indigo-700 w-24">{adjFieldLabel(adj.field)}</span>
                  <span className="text-xs text-slate-500">
                    <span className="line-through">{fmtHHMM(adj.originalMinutes)}</span>
                    {' → '}
                    <span className="font-bold text-indigo-700">{fmtHHMM(adj.adjustedMinutes)}</span>
                  </span>
                  <span className="text-xs text-slate-600 flex-1 italic">&ldquo;{adj.reason}&rdquo;</span>
                  <span className="text-[10px] text-slate-400">{adj.adjustedBy || 'RH'}</span>
                  <button
                    onClick={() => deleteAdjustment(adj.id!)}
                    className="text-red-400 hover:text-red-600 p-1"
                    title="Excluir ajuste"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-3">Nenhum ajuste registrado para este mês.</p>
          )}

          {/* Edit buttons */}
          {!editingField ? (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => startEdit('overtime', emp.overtimeMinutes)} className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors">
                Ajustar Horas Extras ({fmtHHMM(emp.overtimeMinutes)})
              </button>
              <button onClick={() => startEdit('absence', emp.absenceMinutes)} className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                Ajustar Faltas ({fmtHHMM(emp.absenceMinutes)})
              </button>
              <button onClick={() => startEdit('late', emp.lateMinutes)} className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors">
                Ajustar Atrasos ({fmtHHMM(emp.lateMinutes)})
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 border border-indigo-200">
              <p className="text-sm font-semibold text-indigo-900 mb-2">
                Ajustando: {editingField === 'overtime' ? 'Horas Extras' : editingField === 'absence' ? 'Faltas' : 'Atrasos'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Valor Original (min)</label>
                  <input type="text" readOnly value={editingField === 'overtime' ? emp.overtimeMinutes : editingField === 'absence' ? emp.absenceMinutes : emp.lateMinutes} className="w-full h-8 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-400" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Novo Valor (min)</label>
                  <input
                    type="number"
                    value={editMinutes}
                    onChange={e => setEditMinutes(e.target.value)}
                    className="w-full h-8 px-3 text-sm border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: 120"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Novo em HH:MM</label>
                  <p className="h-8 flex items-center text-sm font-mono font-bold text-indigo-700">{fmtHHMM(Number(editMinutes) || 0)}</p>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">Motivo / Observação (obrigatório)</label>
                <textarea
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="Descreva o motivo do ajuste..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveAdjustment}
                  disabled={saving || !editReason.trim()}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar Ajuste'}
                </button>
                <button onClick={cancelEdit} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {savedMsg && (
            <p className={`text-xs mt-2 ${savedMsg.startsWith('Erro') ? 'text-red-600' : 'text-emerald-600'} font-medium`}>{savedMsg}</p>
          )}
        </div>

        {/* Day filter tabs */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium mr-2">Visualizar:</span>
          {[
            { v: 'all', l: 'Todos os Dias', c: days.length },
            { v: 'overtime', l: 'Só Horas Extras', c: days.filter(d => d.overtimeMinutes > 0).length },
            { v: 'absence', l: 'Só Faltas/Atrasos', c: days.filter(d => d.absenceMinutes > 0 || d.lateMinutes > 0 || d.status === 'ABSENCE').length },
          ].map(tab => (
            <button
              key={tab.v}
              onClick={() => setDayFilter(tab.v as typeof dayFilter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                dayFilter === tab.v
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.l} ({tab.c})
            </button>
          ))}
        </div>

        {/* Filtered summary */}
        {dayFilter !== 'all' && (
          <div className="px-6 py-2 bg-indigo-50 border-b border-slate-200 text-xs text-indigo-700 flex gap-4">
            <span>Dias: <strong>{filteredDays.length}</strong></span>
            <span>Trabalhadas: <strong className="font-mono">{fmtHHMM(totalWorked)}</strong></span>
            {dayFilter === 'overtime' && <span>H. Extras: <strong className="font-mono text-emerald-700">{fmtHHMM(totalOT)}</strong></span>}
            {dayFilter === 'absence' && (
              <>
                <span>Faltas: <strong className="font-mono text-red-600">{fmtHHMM(totalAbs)}</strong></span>
                <span>Atrasos: <strong className="font-mono text-amber-600">{fmtHHMM(totalLate)}</strong></span>
              </>
            )}
          </div>
        )}

        {/* Days table */}
        <div className="max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2">Data</th>
                <th className="text-left px-4 py-2">Dia</th>
                <th className="text-center px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Batidas</th>
                <th className="text-right px-4 py-2">Trabalhadas</th>
                <th className="text-right px-4 py-2">Previstas</th>
                <th className="text-right px-4 py-2 text-emerald-600">H. Extra</th>
                <th className="text-right px-4 py-2 text-red-500">Falta</th>
                <th className="text-right px-4 py-2 text-amber-600">Atraso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDays.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
                    Nenhum dia encontrado com o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredDays.map(day => (
                  <tr key={day.date} className={`hover:bg-slate-50 ${day.status === 'ABSENCE' ? 'bg-red-50/30' : day.status === 'WEEKEND' || day.status === 'HOLIDAY' ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-2 font-mono text-slate-700">{day.date.split('-').reverse().join('/')}</td>
                    <td className="px-4 py-2 text-slate-600">{DOW_NAMES[day.dayOfWeek]}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${dayStatusColor(day.status)}`}>
                        {dayStatusLabel(day.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {day.punches.length === 0 ? (
                          <span className="text-[10px] text-slate-400">—</span>
                        ) : (
                          day.punches.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map((p, i) => (
                            <span key={i} className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${punchColor(p.type)}`}>
                              {fmtBrtTime(p.time)} {punchLabel(p.type)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">{fmtHHMM(day.workedMinutes)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-400">{fmtHHMM(day.expectedMinutes)}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {day.overtimeMinutes > 0 ? (
                        <span className="text-emerald-600 font-semibold">{fmtHHMM(day.overtimeMinutes)}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {day.absenceMinutes > 0 ? (
                        <span className="text-red-600 font-semibold">{fmtHHMM(day.absenceMinutes)}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {day.lateMinutes > 0 ? (
                        <span className="text-amber-600 font-semibold">{fmtHHMM(day.lateMinutes)}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-2xl">
          <p className="text-xs text-slate-400">
            {filteredDays.length} dias exibidos · Total trabalhado: {fmtHHMM(totalWorked)}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={generateEmployeePDF}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function OvertimePage() {
  const now = new Date();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<OvertimeEmployee[]>([]);
  const [employees, setEmployees] = useState<SimpleEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'with_overtime' | 'no_punch'>('all');
  const [minHours, setMinHours] = useState('0');
  const [searchEmployee, setSearchEmployee] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [toast, setToast] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [modalEmp, setModalEmp] = useState<OvertimeEmployee | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Load branches
  useEffect(() => {
    apiClient.get('/branches', { params: { take: 50 } })
      .then(r => {
        const list: Branch[] = r.data.data || r.data || [];
        setBranches(list);
        const atacado = list.find(b => b.name?.toLowerCase().includes('atacado'));
        if (atacado) setSelectedBranch(atacado.id);
        else if (list.length > 0) setSelectedBranch(list[0].id);
      })
      .catch(() => {});
  }, []);

  // Load employees when branch changes
  useEffect(() => {
    if (!selectedBranch) return;
    setEmployees([]);
    apiClient.get('/employees', { params: { take: 100, skip: 0 } })
      .then(r => {
        const allEmps = r.data.data || r.data || [];
        const branchEmps = allEmps
          .filter((e: any) => e.branchId === selectedBranch && e.isActive !== false)
          .map((e: any) => ({ id: e.id, name: e.name || '', position: e.position || '' }))
          .sort((a: SimpleEmployee, b: SimpleEmployee) => a.name.localeCompare(b.name));
        setEmployees(branchEmps);
      })
      .catch(() => setEmployees([]));
  }, [selectedBranch]);

  const fetchReport = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    setErrorDetail('');
    try {
      const r = await apiClient.get(`/reports/payroll/${selectedBranch}/${month}/${year}`);
      const payroll = r.data.payrollData || [];
      setData(payroll);
      setFetched(true);
      if (payroll.length === 0) {
        setToast('Nenhum funcionário encontrado nesta filial.');
        setTimeout(() => setToast(''), 4000);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      setErrorDetail(`Erro: ${detail} (Status: ${err?.response?.status || '?'})`);
      setToast('Erro ao carregar relatório.');
      setTimeout(() => setToast(''), 4000);
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
  const totalNetOT = filtered.reduce((s, e) => s + (e.netOvertimeMinutes || 0), 0);
  const totalWorked = data.reduce((s, e) => s + e.workedMinutes, 0);
  const totalAbsence = filtered.reduce((s, e) => s + e.absenceMinutes, 0);
  const withPunches = data.filter(e => e.hasPunches).length;
  const noPunch = data.filter(e => !e.hasPunches).length;

  const generatePDF = () => {
    const mLabel = MONTHS.find(m2 => m2.value === month)?.label || month;
    const bName = branches.find(b => b.id === selectedBranch)?.name || '';
    const totalWorkedF = filtered.reduce((s, e) => s + e.workedMinutes, 0);
    const totalExpectedF = filtered.reduce((s, e) => s + e.expectedMinutes, 0);
    const totalOTF = filtered.reduce((s, e) => s + e.overtimeMinutes, 0);
    const totalNetOTF = filtered.reduce((s, e) => s + (e.netOvertimeMinutes || 0), 0);
    const totalLateF = filtered.reduce((s, e) => s + e.lateMinutes, 0);
    const totalAbsenceF = filtered.reduce((s, e) => s + e.absenceMinutes, 0);
    const totalDaysF = filtered.reduce((s, e) => s + e.daysWorked, 0);

    const rowsHtml = filtered.map((item, i) => {
      const netOT = item.netOvertimeMinutes || 0;
      const hasAdj = item.adjustments && Object.keys(item.adjustments).length > 0;
      const otClass = netOT > 480 ? 'color:#dc2626;font-weight:700' :
        netOT > 240 ? 'color:#d97706;font-weight:700' :
        netOT > 0 ? 'color:#16a34a;font-weight:700' : 'color:#94a3b8';
      const noPunchStyle = !item.hasPunches ? 'opacity:0.6' : '';
      return `
        <tr style="${noPunchStyle}">
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#94a3b8;font-size:11px">${i + 1}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9">
            <div style="font-weight:600;color:#0f172a;font-size:12px">${item.employee.name}${hasAdj ? ' *' : ''}</div>
            <div style="color:#94a3b8;font-size:10px">${item.employee.cpf}</div>
          </td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:11px">${item.employee.position || '—'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px">${item.hasPunches ? fmtHHMM(item.workedMinutes) : 'Sem ponto'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;color:#64748b">${fmtHHMM(item.expectedMinutes)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;color:#94a3b8">${fmtHHMM(item.overtimeMinutes)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;color:${item.absenceMinutes > 0 ? '#ef4444' : '#94a3b8'}">${fmtHHMM(item.absenceMinutes)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;${otClass}">${fmtHHMM(netOT)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-size:12px;color:${item.lateMinutes > 0 ? '#ef4444' : '#94a3b8'}">${fmtHHMM(item.lateMinutes)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px;color:#475569">${item.daysWorked}</td>
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
        .summary { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .card { flex: 1; min-width: 140px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .card .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .card .value { font-size: 18px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #f8fafc; }
        th { padding: 8px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        th.right { text-align: right; }
        tfoot tr { background: #f1f5f9; }
        tfoot td { padding: 8px; font-weight: 700; font-size: 12px; border-top: 2px solid #cbd5e1; }
        .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>
    </head><body>
      <div class="header">
        <div class="header-left"><h1>Relatório de Horas Extras</h1><p>Gerado em ${new Date().toLocaleString('pt-BR')}</p></div>
        <div class="header-right"><div class="branch">${bName}</div><div class="period">${mLabel} / ${year}</div></div>
      </div>
      <div class="summary">
        <div class="card"><div class="label">Total Funcionários</div><div class="value" style="color:#1e293b">${data.length}</div></div>
        <div class="card" style="border-color:#86efac"><div class="label" style="color:#16a34a">H. Extras Brutas</div><div class="value" style="color:#16a34a;font-family:monospace">${fmtHHMM(totalOTF)}</div></div>
        <div class="card" style="border-color:#fecaca"><div class="label" style="color:#dc2626">Faltas/Atrasos</div><div class="value" style="color:#dc2626;font-family:monospace">-${fmtHHMM(totalAbsenceF)}</div></div>
        <div class="card" style="border-color:#fde68a"><div class="label" style="color:#d97706">H. Extras Líquidas</div><div class="value" style="color:#d97706;font-family:monospace">${fmtHHMM(totalNetOTF)}</div></div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Colaborador</th><th>Cargo</th>
          <th class="right">Trabalhadas</th><th class="right">Previstas</th>
          <th class="right">H.E. Brutas</th><th class="right" style="color:#dc2626">Faltas</th>
          <th class="right" style="color:#d97706">H.E. Líquidas</th>
          <th class="right">Atrasos</th><th class="right">Dias</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        ${filtered.length > 0 ? `<tfoot><tr>
          <td colspan="3" style="padding:8px;color:#475569;font-size:11px">TOTAL — ${filtered.length} colaboradores</td>
          <td style="padding:8px;text-align:right;font-family:monospace">${fmtHHMM(totalWorkedF)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:#64748b">${fmtHHMM(totalExpectedF)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:#16a34a">${fmtHHMM(totalOTF)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:#dc2626">-${fmtHHMM(totalAbsenceF)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:#d97706;font-weight:800">${fmtHHMM(totalNetOTF)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:#ef4444">${fmtHHMM(totalLateF)}</td>
          <td style="padding:8px;text-align:right;color:#475569">${totalDaysF}</td>
        </tr></tfoot>` : ''}
      </table>
      <div class="footer">Ponto Online v70 — ${bName} — ${mLabel}/${year} · * = possui ajuste RH</div>
      <script>function imprimirRelatorio(){document.getElementById('toolbar').style.display='none';window.print();document.getElementById('toolbar').style.display='flex';}</script>
      <div id="toolbar" style="position:fixed;top:0;left:0;right:0;background:#4f46e5;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="color:white;font-size:13px;font-weight:600">Pre-visualizacao do Relatorio</span>
          <span style="color:rgba(255,255,255,0.7);font-size:11px">Clique em qualquer valor para editar antes de imprimir</span>
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

  // ─── Batch PDF for selected employees ───
  const generateBatchPDF = (employees: OvertimeEmployee[]) => {
    if (employees.length === 0) return;
    const mLabel = MONTHS.find(m2 => m2.value === month)?.label || month;
    const bName = branches.find(b => b.id === selectedBranch)?.name || '';

    const employeeSections = employees.map((emp, empIdx) => {
      const allDays = emp.dayDetails || [];
      const tWorked = allDays.reduce((s, d) => s + d.workedMinutes, 0);
      const tExpected = allDays.reduce((s, d) => s + d.expectedMinutes, 0);
      const tOT = allDays.reduce((s, d) => s + d.overtimeMinutes, 0);
      const tAbs = allDays.reduce((s, d) => s + d.absenceMinutes, 0);
      const tLate = allDays.reduce((s, d) => s + d.lateMinutes, 0);
      const tNet = Math.max(0, tOT - tAbs);
      const daysWorked = allDays.filter(d => d.workedMinutes > 0).length;
      const daysAbsent = allDays.filter(d => d.status === 'ABSENCE').length;

      const rowsHtml = allDays.map(d => {
        const dateF = d.date.split('-').reverse().join('/');
        const dow = DOW_NAMES[d.dayOfWeek];
        const isWeekend = d.status === 'WEEKEND' || d.status === 'HOLIDAY';
        const isAbsence = d.status === 'ABSENCE';
        const rowStyle = isWeekend ? 'background:#f8fafc;color:#94a3b8;' : isAbsence ? 'background:#fef2f2;' : '';
        const punchesStr = d.punches.length === 0 ? '—' :
          d.punches.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
            .map(p => `${fmtBrtTime(p.time)} ${punchLabel(p.type)}`).join(' · ');
        const statusMap: Record<string, string> = { NORMAL:'Normal', WEEKEND:'Fim de Semana', HOLIDAY:'Feriado', ABSENCE:'Falta', INCOMPLETE:'Incompleto' };
        return `<tr style="${rowStyle}">
          <td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:10px;font-family:monospace">${dateF}</td>
          <td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:10px">${dow}</td>
          <td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:9px">${statusMap[d.status] || d.status}</td>
          <td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:9px;color:#475569">${punchesStr}</td>
          <td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:10px;text-align:right;font-family:monospace">${fmtHHMM(d.workedMinutes)}</td>
          <td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:10px;text-align:right;font-family:monospace;color:#94a3b8">${fmtHHMM(d.expectedMinutes)}</td>
          <td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:10px;text-align:right;font-family:monospace;color:${d.overtimeMinutes > 0 ? '#16a34a' : '#cbd5e1'}">${d.overtimeMinutes > 0 ? fmtHHMM(d.overtimeMinutes) : '—'}</td>
          <td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:10px;text-align:right;font-family:monospace;color:${d.absenceMinutes > 0 ? '#dc2626' : '#cbd5e1'}">${d.absenceMinutes > 0 ? fmtHHMM(d.absenceMinutes) : '—'}</td>
          <td style="padding:3px 5px;border-bottom:1px solid #e2e8f0;font-size:10px;text-align:right;font-family:monospace;color:${d.lateMinutes > 0 ? '#d97706' : '#cbd5e1'}">${d.lateMinutes > 0 ? fmtHHMM(d.lateMinutes) : '—'}</td>
        </tr>`;
      }).join('');

      return `
        <div style="${empIdx > 0 ? 'page-break-before:always;' : ''}padding-top:${empIdx > 0 ? '10px' : '0'}">
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid #4f46e5;margin-bottom:10px">
            <div>
              <h1 style="font-size:14px;font-weight:800;color:#1e293b;margin-bottom:2px">Relatório Individual de Ponto</h1>
              <p style="font-size:10px;color:#64748b">Conferência de batidas, horas extras e faltas — ${empIdx + 1} de ${employees.length}</p>
            </div>
            <div style="text-align:right">
              <p style="font-size:12px;font-weight:700;color:#4f46e5">${mLabel} / ${year}</p>
              <p style="font-size:8px;color:#94a3b8">${bName}</p>
            </div>
          </div>
          <!-- Employee info -->
          <div style="display:flex;gap:16px;margin-bottom:10px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">
            <div style="flex:1">
              <p style="font-size:8px;color:#94a3b8;text-transform:uppercase">Colaborador</p>
              <p style="font-size:13px;font-weight:700;color:#0f172a">${emp.employee.name}</p>
            </div>
            <div>
              <p style="font-size:8px;color:#94a3b8;text-transform:uppercase">Cargo</p>
              <p style="font-size:11px;font-weight:600;color:#334155">${emp.employee.position || '—'}</p>
            </div>
            <div>
              <p style="font-size:8px;color:#94a3b8;text-transform:uppercase">CPF</p>
              <p style="font-size:11px;font-weight:600;color:#334155;font-family:monospace">${emp.employee.cpf}</p>
            </div>
          </div>
          <!-- Summary -->
          <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:80px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;text-align:center">
              <p style="font-size:7px;color:#94a3b8;text-transform:uppercase">Trabalhadas</p>
              <p style="font-size:15px;font-weight:800;color:#0f172a;font-family:monospace">${fmtHHMM(tWorked)}</p>
            </div>
            <div style="flex:1;min-width:80px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;text-align:center">
              <p style="font-size:7px;color:#94a3b8;text-transform:uppercase">Previstas</p>
              <p style="font-size:15px;font-weight:800;color:#64748b;font-family:monospace">${fmtHHMM(tExpected)}</p>
            </div>
            <div style="flex:1;min-width:80px;padding:6px 8px;border:1px solid #86efac;border-radius:6px;text-align:center">
              <p style="font-size:7px;color:#16a34a;text-transform:uppercase;font-weight:600">H.E. Brutas</p>
              <p style="font-size:15px;font-weight:800;color:#16a34a;font-family:monospace">${fmtHHMM(tOT)}</p>
            </div>
            <div style="flex:1;min-width:80px;padding:6px 8px;border:1px solid #fecaca;border-radius:6px;text-align:center">
              <p style="font-size:7px;color:#dc2626;text-transform:uppercase;font-weight:600">Faltas</p>
              <p style="font-size:15px;font-weight:800;color:#dc2626;font-family:monospace">${fmtHHMM(tAbs)}</p>
            </div>
            <div style="flex:1;min-width:80px;padding:6px 8px;border:2px solid #fbbf24;border-radius:6px;text-align:center">
              <p style="font-size:7px;color:#d97706;text-transform:uppercase;font-weight:700">H.E. Líquidas</p>
              <p style="font-size:15px;font-weight:800;color:#d97706;font-family:monospace">${fmtHHMM(tNet)}</p>
            </div>
          </div>
          <!-- Calc -->
          <div style="padding:6px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;margin-bottom:10px;font-size:10px;color:#92400e">
            <strong>Cálculo:</strong>
            <span style="font-family:monospace;font-weight:700;color:#16a34a">${fmtHHMM(tOT)}</span> (brutas)
            − <span style="font-family:monospace;font-weight:700;color:#dc2626">${fmtHHMM(tAbs)}</span> (faltas)
            = <span style="font-family:monospace;font-weight:700;color:#d97706">${fmtHHMM(tNet)}</span> (líquidas)
            · Dias: <strong>${daysWorked}</strong> · Faltas: <strong>${daysAbsent}</strong> · Atrasos: <strong>${fmtHHMM(tLate)}</strong>
          </div>
          <!-- Table -->
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:#f1f5f9">
              <th style="padding:4px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;color:#475569;border-bottom:2px solid #cbd5e1">Data</th>
              <th style="padding:4px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;color:#475569;border-bottom:2px solid #cbd5e1">Dia</th>
              <th style="padding:4px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;color:#475569;border-bottom:2px solid #cbd5e1">Status</th>
              <th style="padding:4px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;color:#475569;border-bottom:2px solid #cbd5e1">Batidas</th>
              <th style="padding:4px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;color:#475569;border-bottom:2px solid #cbd5e1">Trab.</th>
              <th style="padding:4px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;color:#475569;border-bottom:2px solid #cbd5e1">Prev.</th>
              <th style="padding:4px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;color:#16a34a;border-bottom:2px solid #cbd5e1">H.E.</th>
              <th style="padding:4px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;color:#dc2626;border-bottom:2px solid #cbd5e1">Falta</th>
              <th style="padding:4px;text-align:right;font-size:8px;font-weight:700;text-transform:uppercase;color:#d97706;border-bottom:2px solid #cbd5e1">Atraso</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot><tr style="background:#f1f5f9">
              <td colspan="4" style="padding:4px;font-size:9px;color:#475569;text-transform:uppercase;font-weight:700;border-top:2px solid #94a3b8">Total</td>
              <td style="padding:4px;text-align:right;font-family:monospace;font-weight:700;font-size:10px;border-top:2px solid #94a3b8">${fmtHHMM(tWorked)}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;color:#64748b;font-size:10px;border-top:2px solid #94a3b8">${fmtHHMM(tExpected)}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;color:#16a34a;font-weight:700;font-size:10px;border-top:2px solid #94a3b8">${fmtHHMM(tOT)}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;color:#dc2626;font-weight:700;font-size:10px;border-top:2px solid #94a3b8">${fmtHHMM(tAbs)}</td>
              <td style="padding:4px;text-align:right;font-family:monospace;color:#d97706;font-weight:700;font-size:10px;border-top:2px solid #94a3b8">${fmtHHMM(tLate)}</td>
            </tr></tfoot>
          </table>
          <!-- Signature -->
          <div style="margin-top:30px;display:flex;gap:30px;justify-content:center">
            <div style="text-align:center;width:200px">
              <div style="border-top:1px solid #334155;padding-top:4px">
                <p style="font-size:9px;font-weight:600;color:#334155">${emp.employee.name}</p>
                <p style="font-size:8px;color:#94a3b8">Colaborador</p>
              </div>
            </div>
            <div style="text-align:center;width:200px">
              <div style="border-top:1px solid #334155;padding-top:4px">
                <p style="font-size:9px;font-weight:600;color:#334155">Responsável RH</p>
                <p style="font-size:8px;color:#94a3b8">Departamento Pessoal</p>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Conferência em Lote — ${employees.length} funcionários — ${mLabel}/${year}</title>
      <style>
        @media print { #toolbar { display: none !important; } body { margin: 0; } }
        @page { margin: 10mm; size: A4 portrait; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 11px; }
      </style>
    </head><body>
      ${employeeSections}
      <div style="margin-top:10px;font-size:7px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:4px">
        Ponto Online v70 — Relatório em lote · ${employees.length} funcionários · ${mLabel}/${year} · Gerado em ${new Date().toLocaleString('pt-BR')}
      </div>
      <script>function imprimirDoc(){document.getElementById('toolbar').style.display='none';window.print();document.getElementById('toolbar').style.display='flex';}</script>
      <div id="toolbar" style="position:fixed;top:0;left:0;right:0;background:#4f46e5;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="color:white;font-size:13px;font-weight:600">Relatório em Lote — ${employees.length} funcionários</span>
          <span style="color:rgba(255,255,255,0.7);font-size:11px">${mLabel}/${year} · ${bName}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="imprimirDoc()" style="background:white;color:#4f46e5;border:none;padding:8px 20px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer">Imprimir / Salvar PDF</button>
          <button onclick="window.close()" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.3);padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer">Fechar</button>
        </div>
      </div>
      <div style="height:50px"></div>
    </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e.employee.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ─── On-demand sync ───
  const syncPunches = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await apiClient.post('/auto-sync/sync-all');
      const result = r.data;
      const total = result?.totalNewPunches ?? result?.results?.reduce((s: number, d: any) => s + (d.newPunches || 0), 0) ?? 0;
      setSyncMsg(`Sincronização concluída! ${total} nova(s) batida(s) importada(s).`);
      // Auto-refresh report after sync
      if (fetched) {
        setTimeout(() => fetchReport(), 1000);
      }
    } catch (err: any) {
      setSyncMsg(`Erro na sincronização: ${err?.response?.data?.message || err?.message || 'Falha'}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 8000);
    }
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
      {/* Modal */}
      {modalEmp && (
        <PunchDetailModal
          emp={modalEmp}
          month={month}
          year={year}
          onClose={() => setModalEmp(null)}
          onAdjustmentSaved={() => fetchReport()}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Horas Extras</h1>
          <p className="text-slate-500 mt-1">Relatório transparente — horas extras com dedução de faltas e atrasos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Sync button - always visible */}
          <button
            onClick={syncPunches}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            title="Sincronizar batidas do relógio de ponto agora"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sincronizando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sincronizar Ponto
              </>
            )}
          </button>
          {fetched && (
            <>
              <button
                onClick={generatePDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Exportar PDF
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => generateBatchPDF(filtered.filter(e => selectedIds.has(e.employee.id)))}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimir {selectedIds.size} Selecionado{selectedIds.size > 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={() => generateBatchPDF(filtered)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                title="Imprimir relatório individual de TODOS os funcionários"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir Todos ({filtered.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 print:hidden">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Filtros</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Filial</label>
            <select
              value={selectedBranch}
              onChange={e => { setSelectedBranch(e.target.value); setFetched(false); setData([]); setSelectedEmployee(''); }}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Funcionário Individual</label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className={`w-full h-9 px-3 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${selectedEmployee ? 'border-violet-400 text-violet-900 font-medium' : 'border-slate-200'}`}
            >
              <option value="">Todos os funcionários ({employees.length})</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} — {e.position || 'Sem cargo'}</option>
              ))}
            </select>
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
                <button onClick={() => setSearchEmployee('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
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
            { value: 'all', label: 'Todos' },
            { value: 'with_overtime', label: 'Com Horas Extras' },
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

        {errorDetail && <p className="text-xs text-red-500 mt-2">{errorDetail}</p>}
      </div>

      {/* Sync message */}
      {syncMsg && (
        <div className={`rounded-xl border p-3 text-sm font-medium ${syncMsg.includes('Erro') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-teal-50 border-teal-200 text-teal-700'}`}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={syncMsg.includes('Erro') ? 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
            </svg>
            {syncMsg}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Results */}
      {fetched && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Funcionários</p>
              <p className="text-2xl font-bold text-slate-900">{data.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">{withPunches} com ponto · {noPunch} sem</p>
            </div>
            <div className="bg-white rounded-xl border border-emerald-200 p-4">
              <p className="text-xs text-emerald-600 mb-1">H. Extras Brutas</p>
              <p className="text-2xl font-bold text-emerald-700 font-mono">{fmtHHMM(totalOT)}</p>
              <p className="text-xs text-emerald-500 mt-0.5">antes das deduções</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <p className="text-xs text-red-500 mb-1">Faltas/Déficit</p>
              <p className="text-2xl font-bold text-red-600 font-mono">-{fmtHHMM(totalAbsence)}</p>
              <p className="text-xs text-red-400 mt-0.5">a descontar</p>
            </div>
            <div className="bg-white rounded-xl border-2 border-amber-300 p-4">
              <p className="text-xs text-amber-600 mb-1 font-semibold">H. Extras Líquidas</p>
              <p className="text-2xl font-bold text-amber-700 font-mono">{fmtHHMM(totalNetOT)}</p>
              <p className="text-xs text-amber-500 mt-0.5">a pagar</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Total Trabalhadas</p>
              <p className="text-2xl font-bold text-slate-900 font-mono">{fmtHHMM(totalWorked)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{monthLabel}/{year}</p>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
            <p className="font-semibold mb-1">Cálculo Transparente de Horas Extras</p>
            <p className="text-amber-700">
              <span className="font-mono font-bold text-emerald-700">{fmtHHMM(totalOT)}</span> (brutas)
              {' − '}
              <span className="font-mono font-bold text-red-600">{fmtHHMM(totalAbsence)}</span> (faltas/atrasos)
              {' = '}
              <span className="font-mono font-bold text-amber-700">{fmtHHMM(totalNetOT)}</span> (líquidas a pagar)
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Clique em &quot;Conferir Batidas&quot; para ver todas as batidas do funcionário e editar valores com observações.
            </p>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {branchName} — {monthLabel}/{year}
              </h2>
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                    {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-xs text-slate-400">{filtered.length} colaboradores</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Selecionar todos"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Colaborador</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cargo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trabalhadas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Previstas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide">H.E. Brutas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-red-500 uppercase tracking-wide">Faltas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wide">H.E. Líquidas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Atrasos</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-indigo-600 uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-slate-400">
                        {loading ? 'Carregando...' : 'Nenhum colaborador encontrado com os filtros selecionados.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, i) => {
                      const netOT = item.netOvertimeMinutes || 0;
                      const badge = getOTBadge(netOT);
                      const hasAdj = item.adjustments && Object.keys(item.adjustments).length > 0;
                      return (
                        <tr
                          key={item.employee.id}
                          className={`hover:bg-slate-50 transition-colors ${!item.hasPunches ? 'opacity-60' : ''} ${selectedIds.has(item.employee.id) ? 'bg-indigo-50/50' : ''}`}
                        >
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.employee.id)}
                              onChange={() => toggleSelect(item.employee.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900 truncate max-w-[180px]">{item.employee.name}</span>
                              {hasAdj && (
                                <span className="inline-flex items-center px-1 py-0.5 text-[9px] font-bold bg-indigo-100 text-indigo-700 rounded" title="Possui ajuste RH">
                                  RH
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{item.employee.cpf}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-700 truncate max-w-[140px]">{item.employee.position || '—'}</div>
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
                            <span className={`font-mono ${item.overtimeMinutes > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {fmtHHMM(item.overtimeMinutes)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {item.absenceMinutes > 0 ? (
                              <span className="text-red-500">-{fmtHHMM(item.absenceMinutes)}</span>
                            ) : (
                              <span className="text-slate-400">00:00</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-mono font-semibold ${getOTColor(netOT)}`}>
                              {fmtHHMM(netOT)}
                            </span>
                            {badge && (
                              <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
                                {badge.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">
                            {item.lateMinutes > 0 ? (
                              <span className="text-red-500">{fmtHHMM(item.lateMinutes)}</span>
                            ) : '00:00'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setModalEmp(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors"
                              title="Ver batidas e ajustar"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Conferir
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                        {fmtHHMM(filtered.reduce((s, e) => s + e.workedMinutes, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {fmtHHMM(filtered.reduce((s, e) => s + e.expectedMinutes, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">
                        {fmtHHMM(totalOT)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-red-500">
                        -{fmtHHMM(totalAbsence)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">
                        {fmtHHMM(totalNetOT)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-red-500">
                        {fmtHHMM(filtered.reduce((s, e) => s + e.lateMinutes, 0))}
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
          <p className="text-slate-400 text-sm mt-1">Depois clique em &quot;Gerar Relatório&quot; para ver as horas extras</p>
        </div>
      )}
    </div>
  );
}
