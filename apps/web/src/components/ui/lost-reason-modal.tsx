import React, { useState } from 'react';

interface LostReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const LOST_REASONS = [
  { value: 'Preço alto', label: 'Preço alto', description: 'Cliente achou o valor acima do orçamento' },
  { value: 'Concorrência', label: 'Concorrência', description: 'Escolheu outro fornecedor' },
  { value: 'Sem interesse', label: 'Sem interesse', description: 'Não demonstrou interesse real' },
  { value: 'Sem resposta', label: 'Sem resposta', description: 'Não retornou após múltiplas tentativas' },
  { value: 'Fora do perfil', label: 'Fora do perfil', description: 'Lead não se encaixa no perfil de cliente' },
  { value: 'Prazo', label: 'Prazo', description: 'Cliente precisava de prazo que não podemos atender' },
  { value: 'Financiamento negado', label: 'Financiamento negado', description: 'Não conseguiu aprovação financeira' },
  { value: 'Outro', label: 'Outro', description: 'Campo de texto livre obrigatório quando selecionado' },
];

export function LostReasonModal({ isOpen, onClose, onConfirm }: LostReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedReason) {
      setError('Selecione um motivo para a perda.');
      return;
    }

    let finalReason = selectedReason;
    if (selectedReason === 'Outro') {
      if (otherReason.trim().length < 10) {
        setError('O campo "Outro" deve ter pelo menos 10 caracteres.');
        return;
      }
      finalReason = otherReason.trim();
    }

    onConfirm(finalReason);
    setSelectedReason('');
    setOtherReason('');
    setError('');
  };

  const handleCancel = () => {
    setSelectedReason('');
    setOtherReason('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-bg-surface-1 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Motivo da Perda</h2>
        <p className="text-sm text-text-primary mb-4">
          Selecione o motivo pelo qual este lead foi perdido:
        </p>

        <div className="space-y-3 mb-4">
          {LOST_REASONS.map((reason) => (
            <label
              key={reason.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedReason === reason.value
                  ? 'border-red-500 bg-red-50'
                  : 'border-border-strong hover:border-border-strong'
              }`}
            >
              <input
                type="radio"
                name="lostReason"
                value={reason.value}
                checked={selectedReason === reason.value}
                onChange={(e) => {
                  setSelectedReason(e.target.value);
                  setError('');
                }}
                className="mt-1 text-red-600 focus:ring-red-500"
              />
              <div className="flex-1">
                <span className="font-medium text-text-primary">{reason.label}</span>
                <p className="text-xs text-text-secondary mt-1">{reason.description}</p>
              </div>
            </label>
          ))}
        </div>

        {selectedReason === 'Outro' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-primary mb-1">
              Especifique o motivo *
            </label>
            <textarea
              value={otherReason}
              onChange={(e) => {
                setOtherReason(e.target.value);
                setError('');
              }}
              placeholder="Descreva o motivo da perda..."
              className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={3}
            />
            <p className="text-xs text-text-secondary mt-1">
              Mínimo de 10 caracteres
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-text-primary bg-bg-surface-1 border border-border-strong rounded-md hover:bg-warm-sand/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Confirmar Perda
          </button>
        </div>
      </div>
    </div>
  );
}
