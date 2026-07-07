/**
 * ============================================================================
 * COMPONENT — Spinner
 * ============================================================================
 * Indicador de loading circular. Usado dentro de Button (via isLoading),
 * em áreas de conteúdo aguardando dados, e em botões de ícone standalone.
 *
 * Deliberadamente SVG com stroke-dasharray animado, não um ícone de
 * biblioteca — mantém a mesma linguagem de "traço fino, cor de marca"
 * do resto do sistema (ver ConversionNode para a mesma técnica aplicada
 * ao elemento de assinatura do produto).
 * ============================================================================
 */

import { cn } from "../../utilities/cn";

export interface SpinnerProps {
  className?: string;
  /** Cor do traço. "current" herda text-color do elemento pai (padrão,
   *  é o que faz o Spinner combinar automaticamente com qualquer variante
   *  de Button). "brand" força a cor de marca independente do contexto. */
  tone?: "current" | "brand";
  /** Quando o Spinner é usado standalone (área de conteúdo carregando),
   *  precisa de role="status" + aria-label próprios para leitores de tela.
   *  Quando aninhado dentro de outro elemento que JÁ anuncia o estado de
   *  loading (ex: Button com aria-busy), isso deve ser false — dois
   *  role="status" aninhados confundem a árvore de acessibilidade em vez
   *  de ajudar. Default true (standalone é o caso mais comum). */
  announceStatus?: boolean;
}

export function Spinner({
  className,
  tone = "current",
  announceStatus = true,
}: SpinnerProps) {
  return (
    <svg
      className={cn(
        "size-4 animate-spin",
        tone === "brand" ? "text-brand-primary" : "text-current",
        className,
      )}
      viewBox="0 0 24 24"
      fill="none"
      role={announceStatus ? "status" : undefined}
      aria-label={announceStatus ? "Carregando" : undefined}
      aria-hidden={announceStatus ? undefined : true}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeOpacity="0.2"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
