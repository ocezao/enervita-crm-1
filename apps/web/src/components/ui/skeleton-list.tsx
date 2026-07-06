import React, { useEffect, useState } from 'react';
import { Skeleton as ShadcnSkeleton } from '@/components/ui/skeleton'; // Assumindo shadcn/ui

interface SkeletonListProps {
  count?: number;
  height?: string;
  className?: string;
}

/**
 * SkeletonList: Exibe uma lista de skeletons para simular carregamento de listas/tabelas.
 * Substitui spinners genéricos por uma prévia estrutural do conteúdo.
 */
export const SkeletonList: React.FC<SkeletonListProps> = ({ 
  count = 5, 
  height = "h-12", 
  className = "" 
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <ShadcnSkeleton key={i} className={`${height} w-full rounded-md`} />
      ))}
    </div>
  );
};

interface SkeletonCardProps {
  className?: string;
}

/**
 * SkeletonCard: Simula o carregamento de um card de KPI ou conteúdo rico.
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({ className = "" }) => {
  return (
    <div className={`flex flex-col space-y-3 p-4 border rounded-lg ${className}`}>
      <ShadcnSkeleton className="h-4 w-[100px]" /> {/* Título */}
      <ShadcnSkeleton className="h-8 w-[150px]" /> {/* Valor Principal */}
      <div className="flex items-center space-x-2">
        <ShadcnSkeleton className="h-4 w-4 rounded-full" /> {/* Ícone tendência */}
        <ShadcnSkeleton className="h-4 w-[80px]" /> {/* Texto tendência */}
      </div>
    </div>
  );
};

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

/**
 * SkeletonTable: Prévia estrutural para tabelas de dados complexas.
 */
export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="w-full space-y-2">
      {/* Header Fake */}
      <div className="flex gap-4 border-b pb-2">
        {Array.from({ length: columns }).map((_, i) => (
          <ShadcnSkeleton key={`h-${i}`} className="h-4 w-full" />
        ))}
      </div>
      {/* Rows Fake */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <ShadcnSkeleton key={`${r}-${c}`} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
};
