import { Component, type HTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export class Card extends Component<CardProps> {
  override render() {
    const { glow, className, children, ...rest } = this.props;
    return (
      <div
        {...rest}
        className={cn(
          'rounded-xl border border-white/8 bg-[rgba(17,25,38,0.6)] backdrop-blur-xl',
          'transition-all duration-300 hover:border-white/15',
          glow && 'shadow-[0_0_20px_rgba(225,29,72,0.15)]',
          className
        )}
      >
        {children}
      </div>
    );
  }
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}
export class CardHeader extends Component<CardHeaderProps> {
  override render() {
    const { className, children, ...rest } = this.props;
    return <div {...rest} className={cn('flex flex-col gap-1.5 p-6', className)}>{children}</div>;
  }
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}
export class CardTitle extends Component<CardTitleProps> {
  override render() {
    const { className, children, ...rest } = this.props;
    return <h3 {...rest} className={cn('text-sm font-bold uppercase tracking-wider text-gray-400', className)}>{children}</h3>;
  }
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}
export class CardContent extends Component<CardContentProps> {
  override render() {
    const { className, children, ...rest } = this.props;
    return <div {...rest} className={cn('p-6 pt-0', className)}>{children}</div>;
  }
}
