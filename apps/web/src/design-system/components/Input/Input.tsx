/**
 * ============================================================================
 * COMPONENT — Input
 * ============================================================================
 * Estados cobertos, todos como CONTRATO explícito via prop `validationState`
 * (não implícitos via classe CSS solta como nos protótipos HTML anteriores):
 *
 *   default   → border-soft, sem mensagem
 *   hover     → border-strong (pseudo-classe, não precisa de prop)
 *   focus     → border-brand-primary + shadow-focus-ring (pseudo-classe)
 *   success   → border-brand-secondary + FieldMessage tone="success"
 *   error     → border-status-danger + FieldMessage tone="danger"
 *   disabled  → opacity reduzida + cursor not-allowed (atributo HTML nativo)
 *
 * O componente NÃO decide sozinho quando mostrar sucesso/erro — isso é
 * responsabilidade de quem usa (validação de formulário), passado via
 * `validationState` + `message`. Ver forms.md para a lógica de QUANDO
 * validar (on blur vs. on change vs. on submit).
 * ============================================================================
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../utilities/cn";

const inputVariants = cva(
  [
    "w-full rounded-md bg-background-surface-2 px-3.5 py-2.5",
    "text-sm text-text-primary placeholder:text-text-disabled",
    "border transition-[border-color,box-shadow] duration-base ease-out-expo",
    "outline-none",
    "disabled:opacity-40 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      validationState: {
        default: [
          "border-border-soft",
          "hover:border-border-strong",
          "focus:border-brand-primary focus:shadow-focus-ring",
        ],
        success: "border-brand-secondary shadow-[0_0_0_3px_var(--color-glow-secondary-soft)]",
        error: "border-status-danger shadow-[0_0_0_3px_var(--color-glow-danger-soft)]",
      },
    },
    defaultVariants: {
      validationState: "default",
    },
  },
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  validationState?: "default" | "success" | "error";
  /** Mensagem exibida abaixo do campo. Cor derivada automaticamente de
   *  validationState — não precisa (e não deve) ser estilizada pelo
   *  consumidor do componente. */
  message?: string;
  /** Ícone à esquerda, dentro do campo (ex: telefone, e-mail, cifrão). */
  iconLeft?: ReactNode;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      validationState = "default",
      message,
      iconLeft,
      label,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? props.name;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-text-secondary"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {iconLeft && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted [&_svg]:size-4">
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              inputVariants({ validationState }),
              iconLeft && "pl-9",
              className,
            )}
            aria-invalid={validationState === "error"}
            aria-describedby={message ? `${inputId}-message` : undefined}
            {...props}
          />
        </div>

        {message && (
          <FieldMessage id={`${inputId}-message`} tone={validationState}>
            {message}
          </FieldMessage>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

/**
 * Subcomponente exportado separadamente porque Textarea e Select
 * (ver arquivos irmãos) reutilizam a mesma mensagem de validação —
 * não faz sentido duplicar este JSX em cada campo.
 */
function FieldMessage({
  tone,
  children,
  id,
}: {
  tone: "default" | "success" | "error";
  children: ReactNode;
  id?: string;
}) {
  if (tone === "default") return null;

  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-center gap-1.5 text-2xs",
        tone === "success" && "text-brand-secondary-hover",
        tone === "error" && "text-status-danger-subtle",
      )}
    >
      {children}
    </p>
  );
}
