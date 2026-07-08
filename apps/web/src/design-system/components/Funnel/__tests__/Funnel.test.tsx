/**
 * ============================================================================
 * TESTE DE GEOMETRIA — Funnel
 * ============================================================================
 * O comentário em Funnel.tsx promete que "números não podem vazar para
 * fora do viewBox". Este teste valida isso via renderização real (Testing
 * Library + jsdom), não apenas lendo o código-fonte.
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Funnel, type FunnelStage } from "../Funnel";

const solarPipelineStages: FunnelStage[] = [
  { label: "Novo lead", value: 148, colorClassName: "fill-orange-700" },
  { label: "Qualificação", value: 109, colorClassName: "fill-orange-600" },
  { label: "Proposta", value: 71, colorClassName: "fill-orange-500" },
  { label: "Negociação", value: 46, colorClassName: "fill-orange-200" },
  { label: "Fechado", value: 28, colorClassName: "fill-mint-500" },
];

describe("Funnel — geometria", () => {
  it("renderiza um polygon por stage", () => {
    const { container } = render(<Funnel stages={solarPipelineStages} />);
    expect(container.querySelectorAll("polygon")).toHaveLength(
      solarPipelineStages.length,
    );
  });

  it("nenhum ponto do polygon sai dos limites horizontais do viewBox (0–220)", () => {
    const { container } = render(<Funnel stages={solarPipelineStages} />);
    const polygons = container.querySelectorAll("polygon");

    polygons.forEach((polygon) => {
      const pointsAttr = polygon.getAttribute("points") ?? "";
      const points = pointsAttr
        .trim()
        .split(" ")
        .map((pair) => pair.split(",").map(Number));

      points.forEach(([x]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(220);
      });
    });
  });

  it("o primeiro segmento (maior valor) é sempre o mais largo", () => {
    const { container } = render(<Funnel stages={solarPipelineStages} />);
    const polygons = Array.from(container.querySelectorAll("polygon"));

    function widthOf(polygon: Element): number {
      const points = (polygon.getAttribute("points") ?? "")
        .trim()
        .split(" ")
        .map((pair) => Number(pair.split(",")[0]));
      return Math.max(...points) - Math.min(...points);
    }

    const firstWidth = widthOf(polygons[0]);
    const lastWidth = widthOf(polygons[polygons.length - 1]);

    expect(firstWidth).toBeGreaterThan(lastWidth);
  });

  it("funciona com número arbitrário de etapas (não só 5)", () => {
    const threeStages: FunnelStage[] = [
      { label: "A", value: 100, colorClassName: "fill-orange-500" },
      { label: "B", value: 50, colorClassName: "fill-orange-400" },
      { label: "C", value: 10, colorClassName: "fill-mint-500" },
    ];
    const { container } = render(<Funnel stages={threeStages} />);
    expect(container.querySelectorAll("polygon")).toHaveLength(3);
  });

  it("dispara onStageClick com a stage e o índice corretos", async () => {
    let clickedStage: FunnelStage | null = null;
    let clickedIndex: number | null = null;

    const { container } = render(
      <Funnel
        stages={solarPipelineStages}
        onStageClick={(stage, index) => {
          clickedStage = stage;
          clickedIndex = index;
        }}
      />,
    );

    const groups = container.querySelectorAll("g");
    groups[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(clickedStage).toEqual(solarPipelineStages[2]);
    expect(clickedIndex).toBe(2);
  });
});
