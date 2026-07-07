import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader } from './card';

interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: number; // Porcentagem (ex: 12.5 para +12.5%)
  trendLabel?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

export function KpiCard({ 
  title, 
  value, 
  trend, 
  trendLabel = 'vs período anterior',
  icon,
  loading = false 
}: KpiCardProps) {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 bg-warm-sand/50 rounded w-24" />
          <div className="h-8 w-8 bg-warm-sand/50 rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-warm-sand/50 rounded w-32 mb-2" />
          <div className="h-3 bg-warm-sand/50 rounded w-40" />
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (!trend && trend !== 0) return <Minus className="h-4 w-4 text-text-secondary" />;
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-mint-400" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-alert-red" />;
    return <Minus className="h-4 w-4 text-text-secondary" />;
  };

  const getTrendColor = () => {
    if (!trend && trend !== 0) return 'text-text-secondary';
    return trend > 0 ? 'text-mint-400' : 'text-alert-red';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        {icon && <div className="text-text-secondary">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-text-primary">{value}</div>
        {trend !== undefined && (
          <div className="flex items-center text-xs mt-1">
            {getTrendIcon()}
            <span className={`ml-1 font-medium ${getTrendColor()}`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
            <span className="text-text-secondary ml-1">{trendLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
