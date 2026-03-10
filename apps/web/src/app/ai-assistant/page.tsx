'use client';

import { useAuth } from '@/components/AuthProvider';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: boolean;
}

const SUGGESTIONS = [
  'Quem tem mais horas extras esse mês?',
  'Gerar relatório de faltas de março/2026',
  'Quantos funcionários estão ativos?',
  'Mostrar batidas de hoje',
  'Qual a escala do João?',
  'Relatório resumo do mês atual',
];

export default function AiAssistantPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login');
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    // Convert markdown to HTML-safe rendering
    let html = content
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Headers
      .replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold mt-3 mb-1">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold mt-3 mb-2">$1</h2>')
      // Tables
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.every(c => /^[\s-:]+$/.test(c))) return '<tr class="border-b border-slate-200"></tr>';
        const tag = cells.some(c => /^[\s-:]+$/.test(c)) ? 'td' : 'td';
        return `<tr>${cells.map(c => `<${tag} class="px-2 py-1 text-xs border-r border-slate-100 last:border-r-0">${c.trim()}</${tag}>`).join('')}</tr>`;
      })
      // Line breaks
      .replace(/\n/g, '<br/>');

    // Wrap table rows
    if (html.includes('<tr>')) {
      html = html.replace(/(<tr>.*?<\/tr>(<br\/>)?)+/g, (match) => {
        const cleaned = match.replace(/<br\/>/g, '');
        return `<table class="w-full border border-slate-200 rounded text-xs my-2">${cleaned}</table>`;
      });
    }

    return html;
  };

  if (loading || !isAuthenticated) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Assistente IA - RH</h1>
          <p className="text-xs text-slate-500">Consulte dados, gere relatórios e gerencie o ponto com inteligência artificial</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Como posso ajudar?</h2>
              <p className="text-sm text-slate-500 mb-6 max-w-md">
                Pergunte qualquer coisa sobre funcionários, batidas, escalas, horas extras, faltas ou peça relatórios.
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-lg">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-left px-3 py-2.5 text-xs text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`px-4 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div
                      className="text-sm leading-relaxed prose-sm"
                      dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                    />
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 mt-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] text-slate-400">
                    {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.toolsUsed && (
                    <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-slate-500">Consultando dados...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre funcionários, batidas, escalas, relatórios..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 placeholder-slate-400"
              style={{ maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span className="text-sm font-medium">Enviar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
