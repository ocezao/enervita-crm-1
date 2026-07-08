import React from 'react';
import { cn } from '../../utilities/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full px-4 py-2.5 bg-helion-bg-surface-2 border rounded-md text-text-primary',
          'placeholder:text-text-muted',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-helion-orange-500/50 focus:border-helion-orange-500',
          'hover:border-helion-border-strong',
          error 
            ? 'border-helion-red-500 focus:ring-helion-red-500/50 focus:border-helion-red-500' 
            : 'border-helion-border-soft',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
      {(error || helperText) && (
        <p className={`mt-1.5 text-sm ${error ? 'text-helion-red-500' : 'text-text-muted'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
}
