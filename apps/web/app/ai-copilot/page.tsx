'use client';

import { Component, createRef } from 'react';
import { Navbar } from '../../components/Navbar';
import { Send, BrainCircuit, User, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AICopilotState {
  messages: Message[];
  input: string;
  loading: boolean;
}

const SUGGESTED = [
  'What is the current SOL funding rate?',
  'Where is the best liquidity for SOL/USDC?',
  'How should I manage my long position risk?',
  'Explain how prediction markets work on Kaido',
];

class AICopilotPage extends Component<Record<string, never>, AICopilotState> {
  override state: AICopilotState = {
    messages: [
      {
        role: 'assistant',
        content: "Hi! I'm Kaido AI, your on-chain trading copilot. I can help with market analysis, risk management, DeFi strategies, and Solana ecosystem insights. What would you like to know?",
      },
    ],
    input: '',
    loading: false,
  };

  private bottomRef = createRef<HTMLDivElement>();

  private scrollToBottom() {
    this.bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  override componentDidUpdate() {
    this.scrollToBottom();
  }

  private handleSend = async (text?: string) => {
    const content = (text ?? this.state.input).trim();
    if (!content || this.state.loading) return;

    const userMsg: Message = { role: 'user', content };
    this.setState((s) => ({
      messages: [...s.messages, userMsg],
      input: '',
      loading: true,
    }));

    try {
      const apiMessages = [...this.state.messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = (await res.json()) as { message: string };
      this.setState((s) => ({
        messages: [...s.messages, { role: 'assistant', content: data.message }],
        loading: false,
      }));
    } catch {
      this.setState((s) => ({
        messages: [
          ...s.messages,
          { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
        ],
        loading: false,
      }));
    }
  };

  override render() {
    const { messages, input, loading } = this.state;
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 flex flex-col gap-4" style={{ height: 'calc(100vh - 48px)' }}>
          {/* Header */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-heading">AI Copilot</h1>
              <p className="text-[11px] text-gray-500">Powered by Claude · Solana DeFi expertise</p>
            </div>
          </div>

          {/* Suggestions (only shown when no user message yet) */}
          {messages.length === 1 && (
            <div className="grid grid-cols-2 gap-2 shrink-0">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => this.handleSend(s)}
                  className="text-left px-3 py-2.5 rounded-xl border border-white/[0.08] hover:border-primary/[0.20] hover:bg-primary/[0.05] text-xs text-gray-400 hover:text-white transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex gap-3', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                  m.role === 'assistant' ? 'bg-primary/20 border border-primary/30' : 'bg-white/10 border border-white/15'
                )}>
                  {m.role === 'assistant'
                    ? <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                    : <User className="w-3.5 h-3.5 text-gray-300" />
                  }
                </div>
                <div className={cn(
                  'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                  m.role === 'assistant'
                    ? 'bg-white/[0.04] border border-white/[0.08] text-gray-200 rounded-tl-sm'
                    : 'bg-primary/[0.15] border border-primary/[0.20] text-white rounded-tr-sm'
                )}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.08]">
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                </div>
              </div>
            )}
            <div ref={this.bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 flex gap-2">
            <input
              value={input}
              onChange={(e) => this.setState({ input: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void this.handleSend()}
              placeholder="Ask about markets, strategies, or Solana DeFi…"
              className="flex-1 bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/[0.30] transition-colors"
            />
            <button
              onClick={() => void this.handleSend()}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default function AICopilotWrapper() {
  return <AICopilotPage />;
}
