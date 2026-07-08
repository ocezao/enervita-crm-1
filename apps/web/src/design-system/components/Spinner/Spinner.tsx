import React from 'react';
import { cn } from '../../utilities/cn';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  color?: 'orange' | 'mint' | 'white';
}

export function Spinner({
  size = 'md',
  color = 'orange',
  className,
  ...props
}: SpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const colors = {
    orange: 'border-helion-orange-500/30 border-t-helion-orange-500',
    mint: 'border-helion-mint-500/30 border-t-helion-mint-500',
    white: 'border-white/30 border-t-white',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2',
        sizes[size],
        colors[color],
        className
      )}
      {...props}
    />
  );
}
