/**
 * ============================================================================
 * COMPONENT — Card
 * ============================================================================
 * Nos protótipos HTML anteriores existiam "7 tipos de card" (contato,
 * proposta, tarefa, notificação, empty-state, integração, comparativo)
 * cada um com sua própria classe CSS solta. Isso é o oposto de um design
 * system — são todos o MESMO primitivo (superfície + borda + radius +
 * hover) com conteúdo interno diferente.
 *
 * Aqui o Card é composicional: um invólucro (Card) + subcomponentes de
 * layout (Card.Header, Card.Body, Card.Footer). Os "7 tipos" viram
 * composições diferentes do mesmo primitivo, montadas onde são usadas
 * (ex: components/LeadCard, components/ProposalCard consomem <Card>
 * internamente), não variantes hardcoded aqui.
 * ============================================================================
 */

import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utilities/cn";

const cardVariants = cva(
  [
    "bg-background-surface-1 border border-border-hairline rounded-lg",
    "transition-[border-color,transform] duration-base ease-out-expo",
  ],
  {
    variants: {
      interactive: {
        true: "hover:border-border-soft hover:-translate-y-0.5 cursor-pointer",
        false: "",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-5",
        lg: "p-6",
      },
    },
    defaultVariants: {
      interactive: false,
      padding: "md",
    },
  },
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const CardRoot = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ interactive, padding }), className)}
      {...props}
    />
  ),
);
CardRoot.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-start justify-between mb-3.5", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "Card.Header";

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "font-display text-lg font-semibold text-text-primary tracking-tight",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "Card.Title";

const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-text-muted leading-normal", className)}
    {...props}
  />
));
CardDescription.displayName = "Card.Description";

const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(className)} {...props} />
  ),
);
CardBody.displayName = "Card.Body";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between mt-3.5 pt-3.5 border-t border-border-hairline",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "Card.Footer";

/**
 * Export composicional: <Card><Card.Header>...</Card.Header></Card>
 * Este é o padrão que o resto do design system segue para qualquer
 * componente com regiões internas nomeadas (ver Modal, Table).
 */
export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Body: CardBody,
  Footer: CardFooter,
});
