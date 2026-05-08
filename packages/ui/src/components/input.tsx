import { Component, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export class Input extends Component<InputProps> {
  override render() {
    const { label, error, hint, className, id, ...rest } = this.props;
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          {...rest}
          id={inputId}
          className={cn(
            'w-full rounded-xl border border-white/5 bg-black/60 px-4 py-3 text-sm text-white',
            'placeholder:text-gray-600 outline-none transition-all',
            'hover:border-white/15 focus:border-primary focus:shadow-[0_0_0_1px_rgba(225,29,72,0.2)]',
            error && 'border-error focus:border-error focus:shadow-[0_0_0_1px_rgba(239,68,68,0.2)]',
            className
          )}
        />
        {error && <span className="text-xs text-error">{error}</span>}
        {!error && hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
    );
  }
}
