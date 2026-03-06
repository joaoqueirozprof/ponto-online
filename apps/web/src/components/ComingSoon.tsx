'use client';

import { useAuth } from './AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ComingSoonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function ComingSoon({ title, description, icon }: ComingSoonProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-8">{title}</h1>
      <div className="bg-white rounded-2xl border border-slate-100 p-12">
        <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-400">
            {icon}
          </div>
          <h2 className="text-xl font-bold text-slate-700 mb-3">Em desenvolvimento</h2>
          <p className="text-slate-500 leading-relaxed">{description}</p>
          <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-xl">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Módulo será ativado em breve
          </div>
        </div>
      </div>
    </div>
  );
}
