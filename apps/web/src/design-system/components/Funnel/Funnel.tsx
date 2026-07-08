import React from 'react';
import { cn } from '../../utilities/cn';

export interface FunnelProps extends React.HTMLAttributes<HTMLDivElement> {
  stages: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  size?: 'sm' | 'md' | 'lg';
}

export function Funnel({
  stages,
  size = 'md',
  className,
  ...props
}: FunnelProps) {
  const baseStyles = 'w-full space-y-2';
  
  const sizes = {
    sm: 'h-6 text-xs',
    md: 'h-8 text-sm',
    lg: 'h-10 text-base',
  };

  const total = stages.reduce((sum, stage) => sum + stage.value, 0);

  return (
    <div className={cn(baseStyles, className)} {...props}>
      {stages.map((stage, index) => {
        const percentage = total > 0 ? (stage.value / total) * 100 : 0;
        const bgColor = stage.color || `var(--helion-orange-${500 - index * 50})`;
        
        return (
          <div key={index} className="flex items-center gap-3">
            <span className="w-24 text-text-secondary truncate">{stage.label}</span>
            <div className="flex-1 bg-helion-bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`${sizes[size]} rounded-full transition-all duration-500 ease-out`}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: bgColor,
                }}
              />
            </div>
            <span className="w-12 text-right text-text-primary">{stage.value}</span>
          </div>
        );
      })}
    </div>
  );
}
