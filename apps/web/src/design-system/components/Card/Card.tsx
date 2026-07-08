import React from 'react';
import { cn } from '../../utilities/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass';
  children: React.ReactNode;
}

export function Card({
  variant = 'default',
  className,
  children,
  ...props
}: CardProps) {
  const baseStyles = 'rounded-lg p-6 transition-all duration-200';
  
  const variants = {
    default: 'bg-helion-bg-surface-1 border border-helion-border-soft shadow-md',
    glass: 'bg-helion-bg-surface-1/80 backdrop-blur-md border border-helion-border-soft shadow-sm glass-card',
  };

  return (
    <div
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
