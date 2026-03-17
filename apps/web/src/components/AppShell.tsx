'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import Sidebar from './Sidebar';
import FloatingAiChat from './FloatingAiChat';

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isPublicPage = pathname === '/login' || pathname === '/';

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-500 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  // Not authenticated: show only page content (login page)
  if (!isAuthenticated || isPublicPage) {
    return <>{children}</>;
  }

// Authenticated: show sidebar + content
  return (
    <div className="flex min-h-screen relative bg-slate-50 overflow-hidden">
      {/* Background Decorators */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-blue-400/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] rounded-full bg-purple-400/10 blur-[120px] pointer-events-none" />
      
      {/* Backdrop overlay para mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 md:ml-64 ml-0 relative z-10 flex flex-col min-h-screen">
        {/* Header Superior para Mobile */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-10 w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 text-sm">Ponto Online</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600 border border-slate-200/80 bg-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>
      </main>
      <FloatingAiChat />
    </div>
  );
}
