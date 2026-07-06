import { useState, useEffect, useCallback } from 'react';

interface UseUndoOptions {
  duration?: number; // ms antes de confirmar permanentemente
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface UndoState<T> {
  previousValue: T | null;
  currentValue: T | null;
  isPendingDeletion: boolean;
  timerId: NodeJS.Timeout | null;
}

/**
 * useUndo: Hook para implementar funcionalidade de "Desfazer" (Undo) em ações destrutivas.
 * Ideal para deletar itens, arquivar leads, etc.
 * 
 * @param initialValue - Valor inicial do estado
 * @param options - Configurações de duração e callbacks
 */
export function useUndo<T>(initialValue: T | null, options: UseUndoOptions = {}) {
  const { duration = 5000, onConfirm, onCancel } = options;
  
  const [state, setState] = useState<UndoState<T>>({
    previousValue: null,
    currentValue: initialValue,
    isPendingDeletion: false,
    timerId: null,
  });

  const clearTimer = useCallback(() => {
    if (state.timerId) {
      clearTimeout(state.timerId);
    }
  }, [state.timerId]);

  /**
   * Executa uma ação "destrutiva" (ex: remover da lista), mas mantém em pending.
   */
  const remove = useCallback((newValue: T) => {
    clearTimer();

    setState(prev => ({
      previousValue: prev.currentValue,
      currentValue: null, // Remove visualmente
      isPendingDeletion: true,
      timerId: null,
    }));

    // Inicia timer para confirmação automática
    const timerId = setTimeout(() => {
      setState(prev => ({ ...prev, isPendingDeletion: false }));
      onConfirm?.();
    }, duration);

    setState(prev => ({ ...prev, timerId }));
  }, [duration, onConfirm, clearTimer]);

  /**
   * Desfaz a última ação, restaurando o valor anterior.
   */
  const undo = useCallback(() => {
    clearTimer();
    
    setState(prev => ({
      previousValue: null,
      currentValue: prev.previousValue, // Restaura
      isPendingDeletion: false,
      timerId: null,
    }));
    
    onCancel?.();
  }, [onCancel, clearTimer]);

  // Cleanup ao desmontar
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return {
    data: state.currentValue,
    isPending: state.isPendingDeletion,
    remove,
    undo,
    canUndo: state.isPendingDeletion,
  };
}
