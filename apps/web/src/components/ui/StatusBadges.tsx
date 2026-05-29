import { LeadStage, Priority } from '../../lib/api/types';
import { Badge, BadgeVariant } from './Base';

const stageLabels: Record<LeadStage, string> = {
  novo_lead: 'Novo Lead',
  qualificacao: 'Qualificação',
  atendimento_iniciado: 'Atendimento',
  conta_recebida: 'Conta Recebida',
  diagnostico: 'Diagnóstico',
  proposta_enviada: 'Proposta Enviada',
  contrato_enervita: 'Contrato',
  perdido: 'Perdido',
};

const stageColors: Record<LeadStage, BadgeVariant> = {
  novo_lead: 'solar',
  qualificacao: 'info',
  atendimento_iniciado: 'info',
  conta_recebida: 'info',
  diagnostico: 'warning',
  proposta_enviada: 'warning',
  contrato_enervita: 'success',
  perdido: 'error',
};

export const StageBadge = ({ stage }: { stage: LeadStage }) => (
  <Badge variant={stageColors[stage]}>{stageLabels[stage]}</Badge>
);

const priorityLabels: Record<Priority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

const priorityColors: Record<Priority, BadgeVariant> = {
  baixa: 'default',
  media: 'info',
  alta: 'warning',
  urgente: 'error',
};

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <Badge variant={priorityColors[priority]}>{priorityLabels[priority]}</Badge>
);
