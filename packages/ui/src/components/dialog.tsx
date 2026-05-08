import { Component, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils.js';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export class Dialog extends Component<DialogProps> {
  private handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) this.props.onClose();
  };

  override render() {
    const { open, title, children, className, onClose } = this.props;
    if (!open || typeof document === 'undefined') return null;

    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={this.handleBackdrop}
      >
        <div className={cn('w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#111926] shadow-2xl', className)}>
          {title && (
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-wider">{title}</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">&times;</button>
            </div>
          )}
          <div className="p-6">{children}</div>
        </div>
      </div>,
      document.body
    );
  }
}
