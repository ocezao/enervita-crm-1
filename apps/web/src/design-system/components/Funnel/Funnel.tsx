/**
 * ============================================================================
 * COMPONENT — Funnel (geométrico trapezoidal)
 * ============================================================================
 * Reconstrução do funil SVG estático dos protótipos HTML como componente
 * data-driven: os pontos do trapézio são CALCULADOS a partir de `stages`,
 * não hardcoded por etapa. Isso significa que o componente funciona para
 * qualquer funil de vendas (3 etapas, 7 etapas, valores diferentes),
 * não só para o pipeline solar de 5 etapas usado como exemplo.
 *
 * Matemática: cada trapézio tem largura proporcional a stage.value / max,
 * centralizado no eixo X do SVG. Ver funnel.test.ts para os testes que
 * validam a geometria (números não podem "vazar" para fora do viewBox).
 * ============================================================================
 */

import { useMemo } from "react";
import { cn } from "../../utilities/cn";

export interface FunnelStage {
  label: string;
  value: number;
  /** Cor do segmento — usa uma classe Tailwind de fill (ex: "fill-brand-primary-emphasis").
   *  Passado explicitamente por stage (não inferido) porque o gradiente
   *  visual laranja→verde do funil solar é uma decisão de PRODUTO
   *  (energia gerada → economia entregue), não algo que o componente
   *  deveria adivinhar sozinho. */
  colorClassName: string;
}

export interface FunnelProps {
  stages: FunnelStage[];
  className?: string;
  /** Altura de cada segmento em px. Altura total = segmentHeight * stages.length. */
  segmentHeight?: number;
  /** Largura do segmento mais largo (topo do funil), em px. */
  maxWidth?: number;
  onStageClick?: (stage: FunnelStage, index: number) => void;
}

interface TrapezoidPoints {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
  y: number;
}

const VIEWBOX_WIDTH = 220;
const GAP_BETWEEN_SEGMENTS = 4;

export function Funnel({
  stages,
  className,
  segmentHeight = 40,
  maxWidth = 200,
  onStageClick,
}: FunnelProps) {
  const centerX = VIEWBOX_WIDTH / 2;
  const maxValue = Math.max(...stages.map((s) => s.value));

  const trapezoids = useMemo<TrapezoidPoints[]>(() => {
    return stages.map((stage, i) => {
      const width = (stage.value / maxValue) * maxWidth;
      const nextWidth =
        i < stages.length - 1
          ? (stages[i + 1].value / maxValue) * maxWidth
          : width * 0.55; // ponta final, quando não há próxima etapa para referenciar

      const y = i * (segmentHeight + GAP_BETWEEN_SEGMENTS);

      return {
        topLeft: centerX - width / 2,
        topRight: centerX + width / 2,
        bottomLeft: centerX - nextWidth / 2,
        bottomRight: centerX + nextWidth / 2,
        y,
      };
    });
  }, [stages, maxValue, maxWidth, centerX, segmentHeight]);

  const totalHeight =
    stages.length * segmentHeight + (stages.length - 1) * GAP_BETWEEN_SEGMENTS;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${totalHeight}`}
      width={VIEWBOX_WIDTH}
      height={totalHeight}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`Funil com ${stages.length} etapas: ${stages
        .map((s) => `${s.label} (${s.value})`)
        .join(", ")}`}
    >
      {stages.map((stage, i) => {
        const t = trapezoids[i];
        const points = `${t.topLeft},${t.y} ${t.topRight},${t.y} ${t.bottomRight},${
          t.y + segmentHeight
        } ${t.bottomLeft},${t.y + segmentHeight}`;

        return (
          <g
            key={stage.label}
            className={cn(
              "transition-opacity duration-fast ease-out-expo",
              onStageClick && "cursor-pointer hover:opacity-85",
            )}
            onClick={() => onStageClick?.(stage, i)}
          >
            <polygon points={points} className={stage.colorClassName} />
            <text
              x={centerX}
              y={t.y + segmentHeight / 2 + 4}
              textAnchor="middle"
              className="fill-neutral-950 font-mono text-[11px] font-medium select-none"
            >
              {stage.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
