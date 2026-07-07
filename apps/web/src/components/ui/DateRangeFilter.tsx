/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react';

type PeriodValue = '7' | '30' | '90' | '180' | '365' | 'month' | 'previous_month' | 'custom';

export type DateRangeState = {
  period: PeriodValue;
  startDate: string;
  endDate: string;
};

type DateRangeFilterProps = {
  value: DateRangeState;
  onChange: (value: DateRangeState) => void;
  className?: string;
};

function iso(date: Date): string { return date.toISOString().slice(0, 10); }
function startOfMonth(date: Date): Date { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); }
function endOfMonth(date: Date): Date { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)); }

export function rangeForPeriod(period: PeriodValue): DateRangeState {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (period === 'month') return { period, startDate: iso(startOfMonth(today)), endDate: iso(today) };
  if (period === 'previous_month') {
    const previous = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    return { period, startDate: iso(startOfMonth(previous)), endDate: iso(endOfMonth(previous)) };
  }
  if (period === 'custom') return { period, startDate: iso(today), endDate: iso(today) };
  const days = Number(period);
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - (days - 1));
  return { period, startDate: iso(start), endDate: iso(today) };
}

export function isWithinDateRange(value: string | null | undefined, range: DateRangeState): boolean {
  if (!value) return false;
  const date = value.slice(0, 10);
  return date >= range.startDate && date <= range.endDate;
}

export function DateRangeFilter({ value, onChange, className = '' }: DateRangeFilterProps) {
  const label = useMemo(() => `${value.startDate.split('-').reverse().join('/')} até ${value.endDate.split('-').reverse().join('/')}`, [value.startDate, value.endDate]);
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${className}`}>
      <label className="min-w-0 space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Período</span>
        <select className="w-full min-w-0 rounded-xl border border-border-strong px-3 py-2 text-sm bg-bg-surface-1" value={value.period} onChange={(event) => onChange(rangeForPeriod(event.target.value as PeriodValue))}>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="180">Últimos 180 dias</option>
          <option value="365">Últimos 365 dias</option>
          <option value="month">Mês atual inteiro</option>
          <option value="previous_month">Mês anterior inteiro</option>
          <option value="custom">Datas específicas</option>
        </select>
      </label>
      <label className="min-w-0 space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Início</span>
        <input type="date" className="w-full min-w-0 rounded-xl border border-border-strong px-3 py-2 text-sm bg-bg-surface-1" value={value.startDate} onChange={(event) => onChange({ ...value, period: 'custom', startDate: event.target.value })} />
      </label>
      <label className="min-w-0 space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Fim</span>
        <input type="date" className="w-full min-w-0 rounded-xl border border-border-strong px-3 py-2 text-sm bg-bg-surface-1" value={value.endDate} onChange={(event) => onChange({ ...value, period: 'custom', endDate: event.target.value })} />
        <span className="block text-[10px] text-text-secondary">{label}</span>
      </label>
    </div>
  );
}
