'use client';
import ComingSoon from '@/components/ComingSoon';

export default function PunchesPage() {
  return (
    <ComingSoon
      title="Registros de Ponto"
      description="Visualize todas as batidas dos colaboradores em tempo real, com filtros por data, colaborador e tipo de registro."
      icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
    />
  );
}
