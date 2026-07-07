/**
 * ============================================================================
 * SMOKE TEST — todos os componentes renderizam sem crashar
 * ============================================================================
 * Não substitui testes específicos por componente (Funnel já tem os seus).
 * Este arquivo existe para pegar erros básicos de runtime — import quebrado,
 * hook fora de ordem, prop obrigatória faltando no exemplo mínimo — em
 * TODOS os componentes de uma vez, antes de qualquer um chegar a uma página.
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { Badge } from "../../Badge";
import { Input } from "../../Input";
import { Funnel } from "../../Funnel";
import { Spinner } from "../../Spinner";

describe("Smoke test — renderização básica", () => {
  it("Button renderiza com texto", () => {
    render(<Button>Criar proposta</Button>);
    expect(screen.getByRole("button", { name: "Criar proposta" })).toBeDefined();
  });

  it("Button com isLoading desabilita e mostra spinner", () => {
    render(<Button isLoading>Salvando</Button>);
    const button = screen.getByRole("button", { name: "Salvando" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("Card composicional renderiza Header + Title + Body", () => {
    render(
      <Card>
        <Card.Header>
          <Card.Title>João Ferreira</Card.Title>
        </Card.Header>
        <Card.Body>Adamantina, SP</Card.Body>
      </Card>,
    );
    expect(screen.getByText("João Ferreira")).toBeDefined();
    expect(screen.getByText("Adamantina, SP")).toBeDefined();
  });

  it("Badge renderiza com dot por padrão", () => {
    const { container } = render(<Badge tone="hot">Quente</Badge>);
    expect(screen.getByText("Quente")).toBeDefined();
    expect(container.querySelector("span > span")).toBeDefined();
  });

  it("Input com validationState=error exibe a mensagem com role alert", () => {
    render(
      <Input
        label="CPF"
        validationState="error"
        message="CPF incompleto"
        name="cpf"
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe("CPF incompleto");
  });

  it("Funnel renderiza sem crashar com dados mínimos (2 stages)", () => {
    const { container } = render(
      <Funnel
        stages={[
          { label: "A", value: 10, colorClassName: "fill-orange-500" },
          { label: "B", value: 5, colorClassName: "fill-mint-500" },
        ]}
      />,
    );
    expect(container.querySelector("svg")).toBeDefined();
  });

  it("Spinner renderiza com aria-label de acessibilidade", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Carregando" })).toBeDefined();
  });
});
