'use client';

import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string | number;
  onSave: (newValue: string | number) => Promise<void> | void;
  type?: 'text' | 'number' | 'currency';
  className?: string;
  placeholder?: string;
}

export function InlineEdit({
  value,
  onSave,
  type = 'text',
  className,
  placeholder = 'Clique para editar'
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = async () => {
    if (localValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(localValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  const formatDisplayValue = () => {
    if (type === 'currency') {
      return typeof localValue === 'number'
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(localValue)
        : localValue;
    }
    return localValue;
  };

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          type={type === 'number' ? 'number' : 'text'}
          value={localValue}
          onChange={(e) => setLocalValue(type === 'number' ? Number(e.target.value) : e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          autoFocus
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder={placeholder}
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-emerald-100 text-emerald-600 transition-colors"
            title="Salvar"
          >
            {isSaving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => {
              setLocalValue(value);
              setIsEditing(false);
            }}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-red-100 text-red-600 transition-colors"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        'group cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors',
        className
      )}
      title="Clique para editar"
    >
      <span className="group-hover:text-primary transition-colors">
        {formatDisplayValue() || (
          <span className="text-muted-foreground italic">{placeholder}</span>
        )}
      </span>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
