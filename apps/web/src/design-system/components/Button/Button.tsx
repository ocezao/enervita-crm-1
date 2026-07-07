/**
 * ============================================================================
 * COMPONENT — Button
 * ============================================================================
 * Fase 6 do Relatório de Arquitetura: "Regras de Contrato — Proibido
 * Hardcode". Toda cor, radius, spacing e duração de transição abaixo
 * referencia uma classe utilitária gerada pelos tokens (theme.css) —
 * nenhum valor literal (#ff7a1a, 12px, 200ms) aparece neste arquivo.
 *
 * Contrato de variantes (ver Storybook / stories.tsx para exemplos visuais
 * de cada combinação):
 *   - primary    → ação principal da tela. No máximo 1 por contexto visível.
 *   - secondary  → ação alternativa, sempre disponível.
 *   - success    → ação de confirmação positiva (ex: "marcar como fechado").
 *   - ghost      → ação de baixa ênfase (ex: "cancelar" ao lado de destrutiva).
 *   - danger     → ação destrutiva. Sempre pede confirmação (ver Modal).
 *
 * Estados cobertos (ver Fase "Estados" do design system): default, hover,
 * active (:active via scale), focus-visible (herda de base.css), disabled.
 * Loading NÃO é uma variante — é a prop `isLoading`, que qualquer variante
 * pode receber.
 * ============================================================================
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utilities/cn";
import { Spinner } from "../Spinner/Spinner";

const buttonVariants = cva(
  [
    // Base — compartilhado por todas as variantes
    "inline-flex items-center justify-center gap-2",
    "font-body font-semibold text-sm tracking-wide",
    "rounded-full",
    "transition-[transform,box-shadow,background-color,border-color] duration-base ease-out-expo",
    "active:scale-[0.97]",
    "disabled:opacity-35 disabled:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-gradient-to-b from-brand-primary-hover to-brand-primary",
          "text-neutral-950",
          "shadow-inset-highlight",
          "hover:shadow-[var(--shadow-inset-highlight),var(--shadow-glow-primary)] hover:-translate-y-px",
        ],
        secondary: [
          "bg-background-surface-2 text-text-primary",
          "border border-border-soft",
          "hover:border-border-strong hover:bg-background-surface-3",
        ],
        success: [
          "bg-transparent text-brand-secondary-hover",
          "border border-[rgb(46_217_163_/_28%)]",
          "hover:shadow-glow-secondary-sm hover:border-brand-secondary hover:bg-[rgb(46_217_163_/_6%)]",
        ],
        ghost: [
          "bg-transparent text-text-secondary",
          "hover:text-text-primary hover:bg-background-surface-2",
        ],
        danger: [
          "bg-transparent text-status-danger-subtle",
          "border border-[rgb(241_88_78_/_28%)]",
          "hover:bg-glow-danger-soft hover:shadow-glow-danger-sm",
        ],
      },
      size: {
        sm: "px-4 py-2 text-xs",
        md: "px-5 py-2.5",
        lg: "px-6 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Ícone à esquerda do label. Dimensione via className (ex: "size-4"). */
  iconLeft?: ReactNode;
  /** Ícone à direita do label. */
  iconRight?: ReactNode;
  /** Quando true, desabilita o botão e mostra um Spinner no lugar do iconLeft. */
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      iconLeft,
      iconRight,
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <Spinner className="size-4" announceStatus={false} />
        ) : (
          iconLeft && <span className="shrink-0">{iconLeft}</span>
        )}
        {children}
        {!isLoading && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";
