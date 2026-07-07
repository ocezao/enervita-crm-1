/**
 * ============================================================================
 * COMPONENT — Badge
 * ============================================================================
 * Indicador de status compacto (ex: "Quente", "Fechado", "Em risco" no
 * pipeline de leads). Mapeamento direto para tokens/colors.css → status.*,
 * então adicionar um novo tom de status é uma mudança em UM lugar (o
 * token), não em cada componente que usa Badge.
 * ============================================================================
 */

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utilities/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold tracking-wide",
  {
    variants: {
      tone: {
        hot: "bg-[rgb(255_122_26_/_12%)] text-brand-primary-hover",
        success: "bg-[rgb(46_217_163_/_12%)] text-brand-secondary-hover",
        neutral: "bg-[rgb(163_172_179_/_10%)] text-text-secondary",
        danger: "bg-[rgb(241_88_78_/_12%)] text-status-danger-subtle",
        warning: "bg-[rgb(240_180_41_/_12%)] text-status-warning",
        info: "bg-[rgb(91_158_232_/_12%)] text-status-info-subtle",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

const dotToneMap: Record<
  NonNullable<VariantProps<typeof badgeVariants>["tone"]>,
  string
> = {
  hot: "bg-brand-primary shadow-glow-primary-sm",
  success: "bg-brand-secondary shadow-glow-secondary-sm",
  neutral: "bg-text-muted",
  danger: "bg-status-danger",
  warning: "bg-status-warning",
  info: "bg-status-info",
};

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
  /** Mostra o dot colorido antes do texto. Default true — a maior parte
   *  do uso no produto (status de lead) usa o dot; desligue só para
   *  contextos muito densos (ex: dentro de uma tabela já carregada). */
  showDot?: boolean;
}

export function Badge({
  tone = "neutral",
  children,
  className,
  showDot = true,
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {showDot && (
        <span
          className={cn("size-1.5 rounded-full", dotToneMap[tone ?? "neutral"])}
        />
      )}
      {children}
    </span>
  );
}
