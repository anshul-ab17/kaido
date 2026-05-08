import { Component } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

const spinnerVariants = cva('inline-block animate-spin rounded-full border-primary border-t-transparent', {
  variants: {
    size: {
      sm: 'h-4 w-4 border-2',
      md: 'h-6 w-6 border-2',
      lg: 'h-10 w-10 border-[3px]',
    },
  },
  defaultVariants: { size: 'md' },
});

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string;
}

export class Spinner extends Component<SpinnerProps> {
  override render() {
    const { size, className } = this.props;
    return <span role="status" aria-label="Loading" className={cn(spinnerVariants({ size }), className)} />;
  }
}
