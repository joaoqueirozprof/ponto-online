'use client';
import ComingSoon from '@/components/ComingSoon';

export default function DevicesPage() {
  return (
    <ComingSoon
      title="Dispositivos"
      description="Gerencie relógios de ponto Control iD conectados ao sistema. Configure sincronização automática e monitore o status em tempo real."
      icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>}
    />
  );
}
