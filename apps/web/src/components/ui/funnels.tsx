import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// 01 — FUNIS DE VENDA
// ============================================================

export interface GeometricFunnelProps {
  stages: Array<{
    label: string;
    value: number | string;
    delta?: string;
    color: string;
  }>;
  className?: string;
}

export function GeometricFunnel({ stages, className }: GeometricFunnelProps) {
  const totalHeight = 200;
  const segmentHeight = totalHeight / stages.length;

  return (
    <div className={cn("flex gap-7 items-center", className)}>
      <svg
        className="flex-shrink-0"
        width="140"
        height={totalHeight}
        viewBox={`0 0 140 ${totalHeight}`}
      >
        {stages.map((stage, index) => {
          const y = index * segmentHeight;
          const topWidth = 140 - index * 15;
          const bottomWidth = 140 - (index + 1) * 15;
          const xLeft = (140 - topWidth) / 2;
          const xLeftBottom = (140 - bottomWidth) / 2;

          return (
            <polygon
              key={index}
              points={`${xLeft},${y} ${xLeft + topWidth},${y} ${xLeftBottom + bottomWidth},${y + segmentHeight} ${xLeftBottom},${y + segmentHeight}`}
              fill={stage.color}
              className="cursor-pointer transition-opacity duration-140 hover:opacity-85"
              style={{ opacity: 1 - index * 0.15 }}
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-3.5 flex-1">
        {stages.map((stage, index) => (
          <div key={index} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <div className="flex-1">
              <p className="text-[12.5px] font-semibold">{stage.label}</p>
              {stage.delta && (
                <span className="text-[11px] text-text-muted">{stage.delta}</span>
              )}
            </div>
            <div className="font-mono text-[15px] font-medium">{stage.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================

export interface VerticalFunnelProps {
  steps: Array<{
    label: string;
    value: number | string;
    sublabel?: string;
    color?: string;
  }>;
  className?: string;
}

export function VerticalFunnel({ steps, className }: VerticalFunnelProps) {
  const defaultColors = ['#FF9640', '#FF7A1A', '#E8620A', '#B84C08', '#3FDDA3', '#2ED9A3', '#1FB584'];
  
  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="w-full">
            <div
              className="w-full rounded-md px-5 py-3.5 flex items-center justify-between transition-transform duration-240 hover:scale-[1.01]"
              style={{ backgroundColor: step.color || defaultColors[index % defaultColors.length] }}
            >
              <p className="text-[13px] font-semibold text-white/90">{step.label}</p>
              <div className="text-right">
                <span className="font-mono text-[14px] font-semibold text-white">{step.value}</span>
                {step.sublabel && (
                  <p className="text-[10px] text-white/70 font-mono">{step.sublabel}</p>
                )}
              </div>
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================

export interface MiniFunnelProps {
  values: number[];
  colors: string[];
  className?: string;
}

export function MiniFunnel({ values, colors, className }: MiniFunnelProps) {
  const maxValue = Math.max(...values);

  return (
    <div className={cn("flex items-end gap-[3px] h-14", className)}>
      {values.map((value, index) => (
        <div
          key={index}
          className="flex-1 rounded-[3px] rounded-b-none relative transition-opacity duration-140 hover:opacity-80"
          style={{
            height: `${(value / maxValue) * 100}%`,
            backgroundColor: colors[index % colors.length],
          }}
        />
      ))}
    </div>
  );
}
