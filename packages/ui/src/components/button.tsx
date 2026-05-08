import { Component, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:brightness-110 active:scale-95 shadow-[0_0_15px_rgba(225,29,72,0.3)]',
        secondary: 'bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95',
        ghost: 'text-gray-400 hover:text-white hover:bg-white/5 active:scale-95',
        danger: 'bg-error text-white hover:brightness-110 active:scale-95',
        outline: 'border border-primary text-primary hover:bg-primary/10 active:scale-95',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export class Button extends Component<ButtonProps> {
  override render() {
    const { variant, size, loading = false, className, children, disabled, ...rest } = this.props;
    return (
      <button
        {...rest}
        disabled={disabled ?? loading}
        className={cn(buttonVariants({ variant, size }), className)}
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {children}
          </>
        ) : children}
      </button>
    );
  }
}

export { buttonVariants };
