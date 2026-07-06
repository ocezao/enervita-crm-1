import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SearchInput = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className={cn('relative flex items-center', className)}>
    <Search className="absolute left-3 text-graphite-soft" size={18} />
    <input
      {...props}
      className="w-full bg-white border border-warm-sand/70 rounded-lg py-2.5 pl-10 pr-4 text-sm text-graphite placeholder:text-graphite-soft focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all duration-200"
    />
  </div>
);

export const PageHeader = ({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl font-black text-graphite tracking-tight">{title}</h1>
      {description && <p className="text-graphite-soft text-sm mt-1.5 leading-relaxed">{description}</p>}
    </div>
    <div className="flex items-center gap-3">
      {actions}
    </div>
  </div>
);
