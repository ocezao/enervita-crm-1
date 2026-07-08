import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// 03 — MÉTRICAS COMPLEMENTARES
// ============================================================

export interface SparklineRowProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  data: number[];
  color?: string;
  className?: string;
}

export function SparklineRow({
  label,
  value,
  trend = "neutral",
  data,
  color = "#3FDDA3",
  className,
}: SparklineRowProps) {
  const width = 90;
  const height = 28;
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d - minValue) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const trendColor = trend === "up" ? "text-mint-400" : trend === "down" ? "text-red-400" : "text-text-secondary";

  return (
    <div className={cn("flex items-center justify-between py-3 border-b border-border-hair last:border-b-0", className)}>
      <span className="text-[12.5px] flex-1">{label}</span>
      <svg className="flex-shrink-0" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={`M ${points}`}
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={cn("font-mono text-[12.5px] w-[60px] text-right", trendColor)}>{value}</span>
    </div>
  );
}

// ============================================================

export interface VerticalBarChartProps {
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  height?: number;
  className?: string;
}

export function VerticalBarChart({
  data,
  height = 160,
  className,
}: VerticalBarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className={cn("flex items-end gap-4 h-[160px] pt-2.5", className)}>
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center h-full justify-end gap-2">
          <span className="font-mono text-[11px] text-text-secondary">{item.value}</span>
          <div
            className="w-full max-w-[40px] rounded-[6px_6px_0_0] transition-opacity duration-140 hover:opacity-85 relative"
            style={{
              height: `${(item.value / maxValue) * 100}%`,
              backgroundColor: item.color || "var(--orange-400)",
            }}
          />
          <span className="text-[11px] text-text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================

export interface ActivityHeatmapProps {
  data: number[][];
  intensityLevels?: string[];
  cellSize?: number;
  className?: string;
}

export function ActivityHeatmap({
  data,
  intensityLevels = [
    "bg-bg-surface-3",
    "bg-orange-500/25",
    "bg-orange-500/50",
    "bg-orange-500/75",
    "bg-orange-500",
  ],
  cellSize = 12,
  className,
}: ActivityHeatmapProps) {
  const flatData = data.flat();
  const maxValue = Math.max(...flatData);
  const minValue = Math.min(...flatData);
  const range = maxValue - minValue || 1;

  const getIntensityClass = (value: number) => {
    const normalized = (value - minValue) / range;
    const index = Math.min(Math.floor(normalized * intensityLevels.length), intensityLevels.length - 1);
    return intensityLevels[index];
  };

  return (
    <div className={className}>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${data[0]?.length || 12}, 1fr)` }}>
        {data.map((row, rowIndex) =>
          row.map((value, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                "aspect-square rounded-[3px] transition-transform duration-140 cursor-pointer hover:scale-125",
                getIntensityClass(value)
              )}
              style={{ width: cellSize, height: cellSize }}
              title={`Valor: ${value}`}
            />
          ))
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-3.5 text-[10.5px] text-text-muted">
        <span>menos</span>
        {intensityLevels.map((level, index) => (
          <div key={index} className={cn("w-[11px] h-[11px] rounded-[3px]", level)} />
        ))}
        <span>mais</span>
      </div>
    </div>
  );
}

// ============================================================

export interface GaugeProps {
  value: number;
  max: number;
  label?: string;
  subLabel?: string;
  colors?: [string, string];
  className?: string;
}

export function Gauge({
  value,
  max,
  label,
  subLabel,
  colors = ["#FF7A1A", "#2ED9A3"],
  className,
}: GaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = Math.PI * 90;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative">
        <svg width="220" height="130" viewBox="0 0 220 130">
          {/* Background arc */}
          <path
            d="M 20 110 A 90 90 0 0 1 200 110"
            fill="none"
            stroke="var(--bg-surface-3)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d="M 20 110 A 90 90 0 0 1 200 110"
            fill="none"
            stroke={`url(#gaugeGrad-${colors.join("-")})`}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
          <defs>
            <linearGradient id={`gaugeGrad-${colors.join("-")}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={colors[0]} />
              <stop offset="100%" stopColor={colors[1]} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -mb-11 text-center">
          <div className="font-display text-[28px] font-semibold">
            {value}
            <span className="text-[16px] text-text-secondary font-normal">/{max}</span>
          </div>
          {subLabel && <div className="text-[11.5px] text-text-muted mt-0.5">{subLabel}</div>}
        </div>
      </div>
      {label && <div className="mt-2 text-[13.5px] text-text-secondary">{label}</div>}
    </div>
  );
}

// ============================================================

export interface MonthComparisonProps {
  currentMonth: {
    label: string;
    value: string | number;
    percentage: number;
  };
  previousMonth: {
    label: string;
    value: string | number;
    percentage: number;
  };
  className?: string;
}

export function MonthComparison({
  currentMonth,
  previousMonth,
  className,
}: MonthComparisonProps) {
  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="flex-1 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[11.5px] text-text-muted w-16 flex-shrink-0">{previousMonth.label}</span>
          <div className="flex-1 h-5 bg-bg-surface-3 rounded-[5px] overflow-hidden">
            <div
              className="h-full rounded-[5px]"
              style={{ width: `${previousMonth.percentage}%`, backgroundColor: "var(--bg-surface-4)" }}
            />
          </div>
          <span className="font-mono text-[11.5px] w-14 text-right flex-shrink-0">{previousMonth.value}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11.5px] text-text-muted w-16 flex-shrink-0">{currentMonth.label}</span>
          <div className="flex-1 h-5 bg-bg-surface-3 rounded-[5px] overflow-hidden">
            <div
              className="h-full rounded-[5px]"
              style={{
                width: `${currentMonth.percentage}%`,
                background: "linear-gradient(90deg, var(--orange-500), var(--mint-500))",
              }}
            />
          </div>
          <span className="font-mono text-[11.5px] w-14 text-right flex-shrink-0 text-mint-400">{currentMonth.value}</span>
        </div>
      </div>
    </div>
  );
}
