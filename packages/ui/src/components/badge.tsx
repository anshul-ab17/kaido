import { Component, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'bg-white/10 text-gray-300',
        success: 'bg-success/15 text-success',
        error: 'bg-error/15 text-error',
        warning: 'bg-warning/15 text-warning',
        accent: 'bg-accent/15 text-accent',
        primary: 'bg-primary/15 text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  pulse?: boolean;
}

export class Badge extends Component<BadgeProps> {
  override render() {
    const { variant, pulse, className, children, ...rest } = this.props;
    return (
      <span {...rest} className={cn(badgeVariants({ variant }), className)}>
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
          </span>
        )}
        {children}
      </span>
    );
  }
}
