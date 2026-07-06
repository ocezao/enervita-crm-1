'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FabAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

interface FloatingActionButtonProps {
  actions: FabAction[];
  mainIcon?: React.ReactNode;
  className?: string;
  position?: 'bottom-right' | 'bottom-left';
}

export function FloatingActionButton({
  actions,
  mainIcon = <Plus className="h-6 w-6" />,
  className,
  position = 'bottom-right'
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  const closeAll = () => setIsOpen(false);

  return (
    <div className={cn(
      'fixed z-50 flex flex-col gap-2 p-4',
      position === 'bottom-right' ? 'bottom-20 right-4' : 'bottom-20 left-4',
      className
    )}>
      {/* Ações Secundárias */}
      <div className={cn(
        'flex flex-col gap-2 transition-all duration-300 ease-in-out',
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
      )}>
        {actions.map((action, index) => (
          <button
            key={action.id}
            onClick={() => {
              action.onClick();
              closeAll();
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg font-medium transition-colors',
              'bg-background hover:bg-muted text-foreground border border-border',
              'animate-in fade-in slide-in-from-bottom-2 duration-200'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="h-5 w-5">{action.icon}</span>
            <span className="text-sm">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Botão Principal */}
      <button
        onClick={toggleOpen}
        className={cn(
          'h-14 w-14 rounded-full shadow-xl flex items-center justify-center',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'transition-all duration-300 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
        )}
        aria-label={isOpen ? 'Fechar menu' : 'Abrir menu de ações'}
      >
        {isOpen ? (
          <X className="h-6 w-6 animate-in rotate-in-90 duration-300" />
        ) : (
          <span className="animate-out rotate-out-90 duration-300 absolute">
            {mainIcon}
          </span>
        )}
      </button>
    </div>
  );
}
