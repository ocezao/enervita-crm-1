import * as React from "react";
import { cn, formatCurrency } from "@/lib/utils";

// ============================================================
// 02 — CARDS DE TRABALHO
// ============================================================

export interface ContactCardProps {
  name: string;
  role?: string;
  avatar?: React.ReactNode;
  initials?: string;
  tags?: string[];
  fields?: Array<{ icon: React.ReactNode; text: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export function ContactCard({
  name,
  role,
  avatar,
  initials,
  tags = [],
  fields = [],
  actions,
  className,
}: ContactCardProps) {
  return (
    <div className={cn(
      "bg-bg-surface-1 border border-border-hair rounded-lg p-5 transition-colors duration-240 hover:border-border-soft hover:-translate-y-0.5",
      className
    )}>
      <div className="flex items-start justify-between mb-3.5">
        <div className="w-11 h-11 rounded-md bg-gradient-to-br from-bg-surface-4 to-bg-surface-2 border border-border-soft flex items-center justify-center font-display text-[15px] font-semibold">
          {avatar || initials}
        </div>
        {actions && <div>{actions}</div>}
      </div>
      <div>
        <h3 className="text-[14.5px] font-semibold mb-0.5">{name}</h3>
        {role && <p className="text-[12px] text-text-muted">{role}</p>}
      </div>
      {tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap my-3">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-bg-surface-3 text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {fields.length > 0 && (
        <div className="flex flex-col gap-2 pt-3 border-t border-border-hair">
          {fields.map((field, index) => (
            <div key={index} className="flex items-center gap-2 text-[12px] text-text-secondary">
              <span className="w-3.5 h-3.5 text-text-muted flex-shrink-0">{field.icon}</span>
              <span>{field.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================

export type ProposalStatus = "pending" | "accepted" | "rejected" | "expired";

export interface ProposalCardProps {
  id: string;
  title: string;
  value: number;
  status: ProposalStatus;
  validity?: string;
  isUrgent?: boolean;
  className?: string;
}

export function ProposalCard({
  id,
  title,
  value,
  status,
  validity,
  isUrgent,
  className,
}: ProposalCardProps) {
  const statusColors: Record<ProposalStatus, string> = {
    pending: "bg-orange-500",
    accepted: "bg-mint-500",
    rejected: "bg-red-500",
    expired: "bg-text-disabled",
  };

  return (
    <div className={cn(
      "bg-bg-surface-1 border border-border-hair rounded-lg p-5 relative overflow-hidden transition-colors duration-240 hover:border-border-soft hover:-translate-y-0.5",
      className
    )}>
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: statusColors[status] }}
      />
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[11px] text-text-muted">{id}</span>
      </div>
      <h3 className="text-[14.5px] font-semibold mb-3.5">{title}</h3>
      <div className="font-display text-[24px] font-semibold mb-1">
        {formatCurrency(value)}
      </div>
      {validity && (
        <div className={cn(
          "flex items-center gap-1.5 text-[11.5px] text-text-muted pt-3.5 mt-2 border-t border-border-hair",
          isUrgent && "text-amber-500"
        )}>
          <svg className="w-[13px] h-[13px]" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>Vence em {validity}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================

export type TaskPriority = "high" | "medium" | "low";

export interface TaskCardProps {
  title: string;
  checked?: boolean;
  onCheck?: (checked: boolean) => void;
  priority?: TaskPriority;
  dueDate?: string;
  meta?: string;
  className?: string;
}

export function TaskCard({
  title,
  checked = false,
  onCheck,
  priority = "medium",
  dueDate,
  meta,
  className,
}: TaskCardProps) {
  const priorityClasses: Record<TaskPriority, string> = {
    high: "bg-red-500/14 text-red-400",
    medium: "bg-amber-500/14 text-amber-500",
    low: "bg-text-secondary/12 text-text-secondary",
  };

  const priorityLabels: Record<TaskPriority, string> = {
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };

  return (
    <div className={cn(
      "bg-bg-surface-1 border border-border-hair rounded-lg p-5 flex items-start gap-3.5 transition-colors duration-240 hover:border-border-soft",
      className
    )}>
      <button
        onClick={() => onCheck?.(!checked)}
        className={cn(
          "w-[19px] h-[19px] rounded-[6px] border-[1.5px] flex-shrink-0 mt-0.5 cursor-pointer flex items-center justify-center transition-colors duration-140",
          checked
            ? "bg-mint-500 border-mint-500"
            : "border-border-strong hover:border-orange-500"
        )}
      >
        <svg
          className="w-3 h-3 text-[#08211a] transition-opacity duration-140"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          style={{ opacity: checked ? 1 : 0 }}
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </button>
      <div className="flex-1">
        <h4 className={cn("text-[13px] font-semibold mb-1", checked && "line-through text-text-muted")}>
          {title}
        </h4>
        <div className="flex items-center gap-2.5 text-[11.5px] text-text-muted">
          {priority && (
            <span className={cn("text-[10px] font-bold px-2 rounded-full uppercase tracking-wider", priorityClasses[priority])}>
              {priorityLabels[priority]}
            </span>
          )}
          {dueDate && <span>{dueDate}</span>}
          {meta && <span>{meta}</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================

export type NotificationType = "success" | "warning" | "info";

export interface NotificationCardProps {
  type: NotificationType;
  title: string;
  description?: string;
  timestamp?: string;
  isNew?: boolean;
  className?: string;
}

export function NotificationCard({
  type,
  title,
  description,
  timestamp,
  isNew,
  className,
}: NotificationCardProps) {
  const iconColors: Record<NotificationType, string> = {
    success: "bg-mint-400/12 text-mint-400",
    warning: "bg-amber-500/12 text-amber-500",
    info: "bg-blue-400/12 text-blue-400",
  };

  const icons: Record<NotificationType, React.ReactNode> = {
    success: (
      <path d="M20 6L9 17l-5-5" />
    ),
    warning: (
      <>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </>
    ),
  };

  return (
    <div className={cn("flex gap-3 items-start", className)}>
      <div className={cn("w-[34px] h-[34px] rounded-md flex items-center justify-center flex-shrink-0", iconColors[type])}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
          {icons[type]}
        </svg>
      </div>
      <div className="flex-1">
        <h4 className="text-[13px] font-semibold mb-0.5">{title}</h4>
        {description && <p className="text-[12px] text-text-secondary leading-relaxed">{description}</p>}
        {timestamp && <span className="font-mono text-[10.5px] text-text-muted mt-1.5 block">{timestamp}</span>}
      </div>
      {isNew && (
        <div className="w-[7px] h-[7px] rounded-full bg-orange-500 shadow-[0_0_6px_1px_rgba(255,122,26,0.16)] flex-shrink-0 mt-[5px]" />
      )}
    </div>
  );
}

// ============================================================

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const defaultIcon = (
    <svg className="w-7 h-7" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );

  return (
    <div className={cn(
      "flex flex-col items-center text-center p-12",
      className
    )}>
      <div className="w-16 h-16 rounded-lg bg-bg-surface-2 border border-border-soft flex items-center justify-center mb-5">
        {icon || defaultIcon}
      </div>
      <h4 className="font-display text-[15px] font-semibold mb-2">{title}</h4>
      <p className="text-[12.5px] text-text-secondary max-w-[280px] leading-relaxed mb-5">
        {description}
      </p>
      {action}
    </div>
  );
}

// ============================================================

export interface IntegrationCardProps {
  name: string;
  logo?: React.ReactNode;
  connected: boolean;
  statusText?: string;
  onConnect?: () => void;
  className?: string;
}

export function IntegrationCard({
  name,
  logo,
  connected,
  statusText,
  onConnect,
  className,
}: IntegrationCardProps) {
  return (
    <div className={cn(
      "flex items-center gap-3.5 bg-bg-surface-1 border border-border-hair rounded-lg p-5 transition-colors duration-240 hover:border-border-soft",
      className
    )}>
      <div className="w-10 h-10 rounded-md bg-bg-surface-3 border border-border-soft flex items-center justify-center flex-shrink-0">
        {logo || (
          <svg className="w-[19px] h-[19px]" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold mb-0.5">{name}</div>
        <div className={cn("text-[11.5px] flex items-center gap-1.5", connected ? "text-mint-400" : "text-text-muted")}>
          <span className={cn("w-[6px] h-[6px] rounded-full", connected ? "bg-mint-500 shadow-[0_0_5px_1px_rgba(46,217,163,0.14)]" : "bg-text-disabled")} />
          {statusText || (connected ? "Conectado" : "Desconectado")}
        </div>
      </div>
      {!connected && onConnect && (
        <button className="btn btn-secondary px-3 py-1.5 text-[11px]">
          Conectar
        </button>
      )}
    </div>
  );
}

// ============================================================

export interface ComparisonCardProps {
  beforeLabel: string;
  beforeValue: string | number;
  afterLabel: string;
  afterValue: string | number;
  arrowIcon?: React.ReactNode;
  className?: string;
}

export function ComparisonCard({
  beforeLabel,
  beforeValue,
  afterLabel,
  afterValue,
  arrowIcon,
  className,
}: ComparisonCardProps) {
  return (
    <div className={cn(
      "grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-bg-surface-1 border border-border-hair rounded-lg p-5",
      className
    )}>
      <div className="text-center">
        <div className="text-[11px] text-text-muted mb-1.5 uppercase tracking-wider font-mono">{beforeLabel}</div>
        <div className="font-display text-[22px] font-semibold text-text-secondary before">{beforeValue}</div>
      </div>
      <div className="w-8 h-8 rounded-full bg-bg-surface-3 flex items-center justify-center text-orange-400">
        {arrowIcon || (
          <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </div>
      <div className="text-center">
        <div className="text-[11px] text-text-muted mb-1.5 uppercase tracking-wider font-mono">{afterLabel}</div>
        <div className="font-display text-[22px] font-semibold text-mint-400 after">{afterValue}</div>
      </div>
    </div>
  );
}
