'use client';

import { useAuth } from './AuthProvider';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://72.61.129.78:4010/api/v1';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: boolean;
}

const SUGGESTIONS = [
  'Quem tem mais horas extras esse mês?',
  'Quantos funcionários estão ativos?',
  'Mostrar batidas de hoje',
  'Relatório resumo do mês atual',
];

export default function FloatingAiChat() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [messages, isOpen]);

  const handleNavigation = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const navButton = target.closest('[data-nav-href]') as HTMLElement;
    if (navButton) {
      e.preventDefault();
      const href = navButton.getAttribute('data-nav-href');
      if (href) {
        router.push(href);
        setIsOpen(false);
      }
    }
  }, [router]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;

    const userMessage: Message = { role: 'user', content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await apiClient.post('/ai-assistant/chat', {
        message: msg,
        conversationHistory,
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.reply,
        timestamp: new Date(),
        toolsUsed: response.data.toolsUsed,
      };
      setMessages(prev => [...prev, assistantMessage]);
      if (!isOpen) setHasUnread(true);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Erro ao processar: ${error.response?.data?.message || error.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatContent = (content: string) => {
    const API_ROOT = API_BASE.replace(/\/api\/v1$/, '');

    // Normalize PDF links
    let processed = content
      .replace(/\(\/api\/v1\//g, `(${API_ROOT}/api/v1/`)
      .replace(/\]\(http:\/\/[^)]*\/api\/v1\/ai-assistant\/pdf\/([^)]+)\)/g, `](${API_ROOT}/api/v1/ai-assistant/pdf/$1)`);

    let html = processed
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-900">$1</strong>')
      .replace(/^### (.+)$/gm, '<h4 class="text-xs font-bold mt-2 mb-1 text-indigo-700">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 class="text-sm font-bold mt-2 mb-1 text-indigo-800">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 class="text-base font-bold mt-2 mb-1 text-indigo-900">$1</h2>')
      // PDF download links - absolute URLs
      .replace(/\[📥\s*(.+?)\]\((https?:\/\/[^)]+\.pdf)\)/g,
        '<a href="$2" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-2 my-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-xl shadow-md hover:shadow-lg transition-all no-underline transform hover:scale-105"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>$1</a>')
      // PDF download links - relative URLs
      .replace(/\[📥\s*(.+?)\]\((\/.+?\.pdf)\)/g,
        `<a href="${API_ROOT}$2" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-2 my-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-xl shadow-md hover:shadow-lg transition-all no-underline transform hover:scale-105"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>$1</a>`)
      // Generic "Baixar" links with PDF URL (fallback)
      .replace(/\[([^\]]*[Bb]aixar[^\]]*)\]\((https?:\/\/[^)]+\.pdf)\)/g,
        '<a href="$2" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-2 my-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-xl shadow-md hover:shadow-lg transition-all no-underline transform hover:scale-105"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>$1</a>')
      // Navigation buttons
      .replace(/\[🔗\s*(.+?)\]\((\/.+?)\)/g,
        '<button data-nav-href="$2" class="inline-flex items-center gap-1 px-2 py-1 my-0.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 cursor-pointer transition-colors"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>$1</button>')
      // Tables with color
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter((c: string) => c.trim());
        if (cells.every((c: string) => /^[\s-:]+$/.test(c))) return '<!--sep-->';
        const isHeader = content.indexOf(match) < content.indexOf('|---') && !content.substring(0, content.indexOf(match)).includes('|---');
        if (isHeader) {
          return `<tr class="bg-indigo-600">${cells.map((c: string) => `<th class="px-1.5 py-1 text-[10px] font-semibold text-white text-left">${c.trim()}</th>`).join('')}</tr>`;
        }
        return `<tr class="hover:bg-indigo-50/50">${cells.map((c: string) => `<td class="px-1.5 py-0.5 text-[11px] border-t border-slate-100">${c.trim()}</td>`).join('')}</tr>`;
      })
      .replace(/<!--sep-->/g, '')
      .replace(/\n/g, '<br/>');

    if (html.includes('<tr>') || html.includes('<tr ')) {
      html = html.replace(/((<tr[ >].*?<\/tr>)(<br\/>)?)+/g, (match) => {
        const cleaned = match.replace(/<br\/>/g, '');
        return `<div class="overflow-x-auto my-1.5 rounded-md border border-slate-200"><table class="w-full">${cleaned}</table></div>`;
      });
    }

    return html;
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-800 rotate-0'
            : 'bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 shadow-indigo-500/40'
        }`}
        title={isOpen ? 'Fechar assistente' : 'Abrir assistente IA'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Assistente IA</h3>
              <p className="text-[10px] text-white/70">Consultas, relatórios e gestão de ponto</p>
            </div>
            <button
              onClick={() => router.push('/ai-assistant')}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Abrir em tela cheia"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" onClick={handleNavigation}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">Como posso ajudar?</h4>
                <p className="text-[11px] text-slate-500 mb-4">
                  Pergunte sobre funcionários, batidas, escalas, relatórios ou peça para navegar no sistema.
                </p>
                <div className="grid grid-cols-1 gap-1.5 w-full">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left px-3 py-2 text-[11px] text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%]`}>
                  <div className={`px-3 py-2 rounded-xl text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div
                        className="prose-xs"
                        dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                      />
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 mt-0.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[9px] text-slate-400">
                      {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.toolsUsed && (
                      <span className="text-[9px] text-indigo-400 flex items-center gap-0.5">
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        Dados consultados
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-xl rounded-bl-sm px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[10px] text-slate-500">Consultando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte ou peça ajuda..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 placeholder-slate-400"
                style={{ maxHeight: '80px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 80) + 'px';
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
