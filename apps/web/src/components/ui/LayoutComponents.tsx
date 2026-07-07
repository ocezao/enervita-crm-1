import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SearchInput = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className={cn('relative flex items-center', className)}>
    <Search className="absolute left-3 text-text-secondary" size={18} />
    <input
      {...props}
      className="w-full bg-bg-surface-1 border border-border-strong rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all"
    />
  </div>
);

export const PageHeader = ({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
    <div>
      <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
      {description && <p className="text-text-secondary text-sm mt-1">{description}</p>}
    </div>
    <div className="flex items-center gap-3">
      {actions}
    </div>
  </div>
);
