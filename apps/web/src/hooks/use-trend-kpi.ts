import { useState, useEffect } from 'react';

interface TrendData {
  value: number;
  percentage: number;
  isPositive: boolean;
  label: string;
}

/**
 * useTrendKPI: Hook para calcular tendências de KPIs comparando período atual vs anterior.
 * Retorna dados formatados para exibição em cards de dashboard.
 * 
 * @param currentValue - Valor do período atual
 * @param previousValue - Valor do período anterior
 * @param label - Rótulo do KPI (ex: "Receita", "Leads")
 */
export function useTrendKPI(currentValue: number, previousValue: number, label: string): TrendData {
  const [data, setData] = useState<TrendData>({
    value: currentValue,
    percentage: 0,
    isPositive: true,
    label,
  });

  useEffect(() => {
    let percentage = 0;
    
    if (previousValue === 0) {
      // Evita divisão por zero; se havia 0 e agora tem >0, é 100% crescimento
      percentage = currentValue > 0 ? 100 : 0;
    } else {
      percentage = ((currentValue - previousValue) / previousValue) * 100;
    }

    // Arredonda para 1 casa decimal
    const roundedPercentage = Math.round(percentage * 10) / 10;
    
    // Determina se é positivo (crescimento é bom para maioria dos KPIs)
    // Nota: Para KPIs onde "menos é mais" (ex: Churn), inverter a lógica aqui
    const isPositive = percentage >= 0;

    setData({
      value: currentValue,
      percentage: roundedPercentage,
      isPositive,
      label,
    });
  }, [currentValue, previousValue, label]);

  return data;
}

/**
 * Helper para formatar a porcentagem com sinal e cor (conceitual)
 * Ex: "+12.5%" ou "-3.2%"
 */
export function formatTrendPercentage(percentage: number): string {
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage}%`;
}
