/**
 * ============================================================================
 * UTILITY — cn (className merge)
 * ============================================================================
 * Combina clsx (composição condicional de classes) com tailwind-merge
 * (resolve conflitos entre classes Tailwind — ex: se um componente recebe
 * className="bg-red-500" via prop mas já tem "bg-brand-primary" internamente,
 * tailwind-merge garante que só a última prevalece, em vez de as duas
 * colidirem na cascata CSS de forma imprevisível).
 *
 * Usado por TODO componente do design system que aceita `className` como
 * prop — é o mecanismo padrão de permitir customização pontual sem quebrar
 * o contrato interno de estilo do componente.
 * ============================================================================
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
