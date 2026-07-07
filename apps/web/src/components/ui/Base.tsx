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
      primary: 'crm-button-primary bg-orange-500 text-white shadow-md shadow-solar-orange/20 hover:bg-orange-500/90 hover:shadow-lg hover:shadow-solar-orange/25',
      secondary: 'crm-button-secondary bg-bg-surface-1 border border-border-strong text-text-primary hover:bg-warm-sand/30',
      outline: 'crm-button-outline border border-border-strong bg-transparent text-text-primary hover:border-solar-orange/70 hover:bg-orange-500/5 hover:text-orange-400 hover:shadow-sm',
      ghost: 'crm-button-ghost text-text-primary hover:bg-warm-sand/30 hover:text-orange-400',
      danger: 'crm-button-danger bg-red-500 text-white shadow-md shadow-alert-red/20 hover:bg-red-500/90 hover:shadow-lg hover:shadow-alert-red/25',
      success: 'crm-button-success bg-mint-500 text-white shadow-md shadow-energy-green/20 hover:bg-mint-500/90 hover:shadow-lg hover:shadow-energy-green/25',
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
          'crm-button group relative isolate overflow-hidden inline-flex items-center justify-center rounded-lg font-medium transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-solar-orange/20 focus:ring-offset-2 focus:ring-offset-warm-white disabled:opacity-50 disabled:pointer-events-none active:translate-y-[1px] active:scale-[0.98] hover:-translate-y-0.5 [&>svg]:shrink-0 [&>svg]:transition-transform [&>svg]:duration-200 [&>svg]:ease-out hover:[&>svg]:scale-110',
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
  <div className={cn('bg-bg-surface-1 rounded-xl border border-border-soft shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

export const Badge = ({ className, children, variant = 'default' }: { className?: string; children: React.ReactNode; variant?: BadgeVariant }) => {
  const variants = {
    default: 'bg-warm-sand/50 text-text-secondary',
    success: 'bg-mint-500/10 text-mint-400',
    warning: 'bg-amber-500/10 text-alert-amber',
    error: 'bg-red-500/10 text-alert-red',
    info: 'bg-blue-50 text-blue-600',
    solar: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', variants[variant], className)}>
      {children}
    </span>
  );
};

export const MetricCard = ({ title, value, icon: Icon, trend, color = 'solar' }: { title: string; value: string | number; icon: IconComponent; trend?: string; color?: 'solar' | 'energy' | 'graphite' }) => {
  const colors = {
    solar: 'text-orange-400 bg-orange-500/10',
    energy: 'text-mint-400 bg-mint-500/10',
    graphite: 'text-text-primary bg-warm-sand/50',
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
        <p className="text-sm text-text-secondary font-medium">{title}</p>
        <h3 className="text-2xl font-bold mt-1 text-text-primary">{value}</h3>
      </div>
    </Card>
  );
};
