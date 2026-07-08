import React from 'react';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: Date | string;
  icon?: React.ReactNode;
  status?: 'success' | 'warning' | 'error' | 'info' | 'default';
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma atividade registrada.
      </div>
    );
  }

  const getStatusColor = (status?: TimelineItem['status']) => {
    switch (status) {
      case 'success': return 'bg-emerald-500 border-emerald-600';
      case 'warning': return 'bg-amber-500 border-amber-600';
      case 'error': return 'bg-red-500 border-red-600';
      case 'info': return 'bg-blue-500 border-blue-600';
      default: return 'bg-bg-surface-2/50 border-border-strong';
    }
  };

  const formatTimestamp = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className={cn('relative space-y-6', className)}>
      {/* Linha vertical */}
      <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-bg-surface-2/50" />

      {items.map((item, index) => (
        <div key={item.id} className="relative flex gap-4">
          {/* Ícone/Marcador */}
          <div className={cn(
            'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm',
            getStatusColor(item.status)
          )}>
            {item.icon || (
              <div className="h-2 w-2 rounded-full bg-bg-surface-1" />
            )}
          </div>

          {/* Conteúdo do Item */}
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <h4 className="font-medium leading-none">{item.title}</h4>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTimestamp(item.timestamp)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
