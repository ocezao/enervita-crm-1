import React from 'react';
import { cn } from '../../utilities/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Badge({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full';
  
  const variants = {
    default: 'bg-bg-surface-2 text-text-primary border border-border-soft',
    success: 'bg-helion-mint-500/10 text-helion-mint-400 border border-helion-mint-500/20',
    error: 'bg-helion-red-500/10 text-helion-red-500 border border-helion-red-500/20',
    warning: 'bg-helion-amber-500/10 text-helion-amber-500 border border-helion-amber-500/20',
    info: 'bg-helion-orange-500/10 text-helion-orange-400 border border-helion-orange-500/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </span>
  );
}
