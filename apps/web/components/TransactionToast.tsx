'use client';

import { Component } from 'react';
import { CheckCircle2, XCircle, Clock, X, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKaidoStore, type Toast } from '../store';

interface ToastItemProps { toast: Toast; onRemove: (id: string) => void }

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const Icon = toast.type === 'success' ? CheckCircle2
             : toast.type === 'error'   ? XCircle
             :                            Clock;

  const iconCls = toast.type === 'success' ? 'text-success'
                : toast.type === 'error'   ? 'text-error'
                : toast.type === 'pending' ? 'text-warning'
                :                            'text-accent';

  return (
    <div className={cn(
      'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-w-[280px] max-w-[340px] transition-all',
      'bg-[#0E0F00]/95 border-primary/[0.15]',
      toast.type === 'success' && 'border-success/20',
      toast.type === 'error'   && 'border-error/20',
    )}>
      <div className="shrink-0 mt-0.5">
        {toast.type === 'pending'
          ? <div className="w-4 h-4 border-2 border-warning border-t-transparent rounded-full animate-spin" />
          : <Icon className={cn('w-4 h-4', iconCls)} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{toast.title}</p>
        {toast.message && <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{toast.message}</p>}
        {toast.signature && (
          <a
            href={`https://solscan.io/tx/${toast.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-primary hover:text-primary/80 transition-colors font-mono"
          >
            {toast.signature.slice(0, 8)}... <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 p-0.5 text-gray-600 hover:text-white transition-colors rounded"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

class TransactionToastInner extends Component<{ toasts: Toast[]; remove: (id: string) => void }> {
  override render() {
    const { toasts, remove } = this.props;
    if (!toasts.length) return null;
    return (
      <div className="fixed bottom-10 right-4 z-[200] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    );
  }
}

export function TransactionToast() {
  const toasts = useKaidoStore((s) => s.toasts);
  const remove = useKaidoStore((s) => s.removeToast);
  return <TransactionToastInner toasts={toasts} remove={remove} />;
}
