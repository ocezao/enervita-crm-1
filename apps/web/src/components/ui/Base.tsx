import React from 'react';
import { cn } from '../../lib/utils';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'solar';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-solar-orange text-white hover:bg-solar-orange/90 shadow-sm',
      secondary: 'bg-energy-green text-white hover:bg-energy-green/90 shadow-sm',
      outline: 'border border-gray-200 bg-transparent hover:bg-gray-50 text-graphite',
      ghost: 'hover:bg-gray-100 text-graphite',
      danger: 'bg-alert-red text-white hover:bg-alert-red/90',
      success: 'bg-energy-success text-white hover:bg-energy-success/90',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      icon: 'p-2',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-solar-orange/50 disabled:opacity-50 disabled:pointer-events-none active:scale-95',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn('bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

export const Badge = ({ className, children, variant = 'default' }: { className?: string; children: React.ReactNode; variant?: BadgeVariant }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-mint-light text-energy-success',
    warning: 'bg-alert-amber/10 text-alert-amber',
    error: 'bg-alert-red/10 text-alert-red',
    info: 'bg-blue-50 text-blue-600',
    solar: 'bg-solar-orange/10 text-solar-orange',
  };

  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', variants[variant], className)}>
      {children}
    </span>
  );
};

export const MetricCard = ({ title, value, icon: Icon, trend, color = 'solar' }: { title: string; value: string | number; icon: IconComponent; trend?: string; color?: 'solar' | 'energy' | 'graphite' }) => {
  const colors = {
    solar: 'text-solar-orange bg-solar-orange/10',
    energy: 'text-energy-green bg-energy-green/10',
    graphite: 'text-graphite bg-gray-100',
  };

  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <div className={cn('p-2.5 rounded-xl', colors[color])}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={cn('text-xs font-medium', trend.startsWith('+') ? 'text-energy-success' : 'text-alert-red')}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <h3 className="text-2xl font-bold mt-1 text-graphite">{value}</h3>
      </div>
    </Card>
  );
};
