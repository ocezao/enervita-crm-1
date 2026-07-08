import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function PremiumSurface({ children, className, dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      className={cn(
        'relative overflow-hidden rounded-[2rem] border shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl',
        dark ? 'border-border-strong/80 bg-bg-surface-2 text-white' : 'border-white/70 bg-bg-surface-1/75',
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </motion.section>
  );
}

const accentClasses: Record<string, string> = {
  orange: 'border-border-soft/80 bg-transparent text-text-secondary shadow-md',
  green: 'border-border-soft/80 bg-transparent text-text-secondary shadow-md',
  red: 'border-border-soft/80 bg-transparent text-text-secondary shadow-md',
  slate: 'border-border-soft/80 bg-transparent text-text-secondary shadow-md',
};

export function PremiumMetricCard({
  title,
  value,
  description,
  icon,
  accent = 'orange',
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  accent?: keyof typeof accentClasses | string;
}) {
  const accentClass = accentClasses[accent] ?? accentClasses.orange;

  return (
    <PremiumSurface className="min-h-[156px] p-4">
      <div className="relative min-h-[116px] pr-12">
        <div>
          <p className="min-h-[1.8rem] text-[11px] font-black uppercase tracking-[0.18em] text-text-secondary">{title}</p>
          <strong className="mt-2 block text-2xl font-black leading-none tracking-tight text-text-primary">{value}</strong>
          <p className="mt-2 text-[13px] font-semibold leading-5 text-text-secondary">{description}</p>
        </div>
        <div className={cn('absolute right-0 top-0 grid h-9 w-9 shrink-0 place-items-center rounded-xl border shadow-sm', accentClass)}>
          <span className="grid h-4 w-4 place-items-center [&>svg]:h-4 [&>svg]:w-4 [&>svg]:stroke-[2.25]">{icon}</span>
        </div>
      </div>
    </PremiumSurface>
  );
}

export function PremiumSectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-text-primary">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function ContextHint({ text, title = 'Contexto' }: { text: string; title?: string }) {
  return (
    <div className="group relative inline-flex">
      <button type="button" aria-label={title} className="grid h-7 w-7 place-items-center rounded-full border border-white/40 bg-bg-surface-1/70 text-text-secondary shadow-sm backdrop-blur transition hover:text-text-primary focus:outline-none focus:ring-4 focus:ring-orange-200">
        <HelpCircle size={15} />
      </button>
      <div className="pointer-events-none absolute right-0 top-9 z-50 w-72 translate-y-1 rounded-2xl border border-white/15 bg-bg-surface-2/95 p-4 text-left text-xs font-semibold leading-5 text-text-primary opacity-0 shadow-2xl shadow-md/30 backdrop-blur-xl transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <p className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">{title}</p>
        <p>{text}</p>
      </div>
    </div>
  );
}
