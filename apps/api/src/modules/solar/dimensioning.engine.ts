/**
 * Solar Dimensioning Engine - PATCH 01 Compliant.
 * 
 * CORRECTION 01: Dimensionamento is NOT independent - it's a step in proposal flow.
 * CORRECTION 02: Result is a suggestion, not absolute truth.
 * CORRECTION 03: Separate Dimensionamento (suggestion) from Produto (final).
 * CORRECTION 04: Snapshot must be immutable.
 * CORRECTION 10: Engine only receives consumption, not source.
 * CORRECTION 12: Engine only calculates, never generates PDF/proposals/saves costs.
 */

export type DimensionamentoStatus =
  | 'sucesso'
  | 'pendente_irradiacao'
  | 'placa_invalida'
  | 'inversor_incompativel'
  | 'entradas_invalidas'
  | 'calculo_incompleto';

export interface PanelModel {
  id: string;
  nome: string;
  fabricante: string | null;
  potencia_wp: number;
  area_util_m2: number;
  eficiencia_decimal: number;
  ativo: boolean;
  padrao: boolean;
}

export interface InverterModel {
  id: string;
  nome: string;
  fabricante: string | null;
  capacidade_kw: number;
  sobrecarga_decimal: number;
  ativo: boolean;
  padrao: boolean;
}

// CORRECTION 10: Input contract - only consumption, not source
export interface DimensioningInput {
  cidade: string;
  uf: string;
  consumo_medio_mensal_kwh: number; // Can come from typing, OCR, API, import
  tipo_telhado?: string;
  perda_decimal: number;
  sobra_decimal: number;
  modelo_placa: PanelModel;
  inversores_disponiveis: InverterModel[];
  margem_inversor_decimal: number;
  dias_mes: number;
  irradiacao_kwh_m2_dia: number;
  formula_version?: string;
}

export interface DimensioningOutput {
  status: DimensionamentoStatus;
  mensagens_erro: string[];
  mensagens_alerta: string[];
  
  // Irradiation
  irradiacao_kwh_m2_dia: number;
  
  // Consumption
  consumo_medio_mensal_kwh: number;
  consumo_com_sobra_kwh: number;
  
  // Panel production
  producao_diaria_bruta_placa: number;
  producao_diaria_real_placa: number;
  producao_mensal_real_placa: number;
  
  // Panel count
  quantidade_bruta_placas: number;
  quantidade_sugerida: number;
  potencia_total_sugerida_kwp: number;
  
  // Inverter (CORRECTION 02: suggestion only)
  inversor_sugerido_id: string | null;
  inversor_sugerido_nome: string | null;
  inversor_capacidade_nominal_kw: number | null;
  inversor_sobrecarga_decimal: number | null;
  inversor_capacidade_real_kw: number | null;
  inversor_sobra_percentual: number | null;
  
  // CORRECTION 11: Snapshot metadata
  formula_version: string;
  snapshot_imutavel: boolean;
}

// CORRECTION 09: Technical compatibility check after manual changes
export interface CompatibilityCheck {
  compativel: boolean;
  alertas: string[];
  potencia_total_kwp: number;
  inversor_capacidade_real_kw: number;
  inversor_sobra_percentual: number;
}

/**
 * CORRECTION 12: Motor only calculates dimensioning.
 * Does NOT: generate PDF, create proposals, save costs, calculate commission.
 */
export function calcularDimensionamento(input: DimensioningInput): DimensioningOutput {
  const erros: string[] = [];
  const alertas: string[] = [];

  // Validations (blocking)
  if (!input.cidade || !input.uf) {
    erros.push('Cidade e UF são obrigatórios.');
  }

  if (!input.irradiacao_kwh_m2_dia || input.irradiacao_kwh_m2_dia <= 0) {
    erros.push('Irradiação solar não cadastrada para esta cidade.');
  }

  if (!input.consumo_medio_mensal_kwh || input.consumo_medio_mensal_kwh <= 0) {
    erros.push('Consumo médio mensal deve ser maior que zero (em kWh).');
  }

  if (!input.modelo_placa) {
    erros.push('Modelo de placa não informado.');
  } else {
    if (!input.modelo_placa.potencia_wp || input.modelo_placa.potencia_wp <= 0) {
      erros.push('Placa sem potência definida (Wp).');
    }
    if (!input.modelo_placa.area_util_m2 || input.modelo_placa.area_util_m2 <= 0) {
      erros.push('Placa sem área útil definida (m²).');
    }
    if (!input.modelo_placa.eficiencia_decimal || input.modelo_placa.eficiencia_decimal <= 0) {
      erros.push('Placa sem eficiência definida.');
    }
  }

  if (input.perda_decimal < 0 || input.perda_decimal >= 1) {
    erros.push('Perda deve ser entre 0% e 99%.');
  }

  if (input.sobra_decimal < 0) {
    erros.push('Sobra não pode ser negativa.');
  }

  if (erros.length > 0) {
    return {
      status: 'entradas_invalidas',
      mensagens_erro: erros,
      mensagens_alerta: alertas,
      irradiacao_kwh_m2_dia: input.irradiacao_kwh_m2_dia,
      consumo_medio_mensal_kwh: input.consumo_medio_mensal_kwh,
      consumo_com_sobra_kwh: 0,
      producao_diaria_bruta_placa: 0,
      producao_diaria_real_placa: 0,
      producao_mensal_real_placa: 0,
      quantidade_bruta_placas: 0,
      quantidade_sugerida: 0,
      potencia_total_sugerida_kwp: 0,
      inversor_sugerido_id: null,
      inversor_sugerido_nome: null,
      inversor_capacidade_nominal_kw: null,
      inversor_sobrecarga_decimal: null,
      inversor_capacidade_real_kw: null,
      inversor_sobra_percentual: null,
      formula_version: input.formula_version || 'v1.0',
      snapshot_imutavel: true,
    };
  }

  // Alerts (non-blocking) - CORRECTION 02: these are suggestions
  if (input.perda_decimal < 0.20 || input.perda_decimal > 0.30) {
    alertas.push(`Perda de ${(input.perda_decimal * 100).toFixed(1)}% fora da faixa esperada (20%–30%).`);
  }

  if (input.sobra_decimal > 0.50) {
    alertas.push(`Sobra de ${(input.sobra_decimal * 100).toFixed(1)}% está muito acima do padrão comercial.`);
  }

  // Core Calculations
  const producao_diaria_bruta_placa =
    input.modelo_placa.area_util_m2 *
    input.modelo_placa.eficiencia_decimal *
    input.irradiacao_kwh_m2_dia;

  const producao_diaria_real_placa =
    producao_diaria_bruta_placa * (1 - input.perda_decimal);

  const producao_mensal_real_placa =
    producao_diaria_real_placa * input.dias_mes;

  const consumo_com_sobra_kwh =
    input.consumo_medio_mensal_kwh * (1 + input.sobra_decimal);

  const quantidade_bruta_placas =
    producao_mensal_real_placa > 0
      ? consumo_com_sobra_kwh / producao_mensal_real_placa
      : 0;

  const quantidade_sugerida = Math.ceil(quantidade_bruta_placas);

  const potencia_total_sugerida_kwp =
    (quantidade_sugerida * input.modelo_placa.potencia_wp) / 1000;

  // Inverter selection
  type InverterWithCalc = InverterModel & { capacidade_real_kw: number; compativel: boolean; sobra: number };

  const invertersCompativeis: InverterWithCalc[] = input.inversores_disponiveis
    .filter((inv) => inv.ativo)
    .map((inv) => {
      const capacidade_real = inv.capacidade_kw * (1 + inv.sobrecarga_decimal);
      const potencia_com_margem = potencia_total_sugerida_kwp * (1 + input.margem_inversor_decimal);
      return {
        ...inv,
        capacidade_real_kw: capacidade_real,
        compativel: capacidade_real >= potencia_com_margem,
        sobra: potencia_total_sugerida_kwp > 0
          ? ((capacidade_real - potencia_total_sugerida_kwp) / potencia_total_sugerida_kwp) * 100
          : 0,
      };
    })
    .filter((inv) => inv.compativel)
    .sort((a, b) => a.capacidade_real_kw - b.capacidade_real_kw);

  if (producao_mensal_real_placa <= 0) {
    erros.push('Produção mensal real da placa é zero ou negativa.');
    return {
      status: 'placa_invalida',
      mensagens_erro: erros,
      mensagens_alerta: alertas,
      irradiacao_kwh_m2_dia: input.irradiacao_kwh_m2_dia,
      consumo_medio_mensal_kwh: input.consumo_medio_mensal_kwh,
      consumo_com_sobra_kwh,
      producao_diaria_bruta_placa,
      producao_diaria_real_placa,
      producao_mensal_real_placa,
      quantidade_bruta_placas,
      quantidade_sugerida,
      potencia_total_sugerida_kwp,
      inversor_sugerido_id: null,
      inversor_sugerido_nome: null,
      inversor_capacidade_nominal_kw: null,
      inversor_sobrecarga_decimal: null,
      inversor_capacidade_real_kw: null,
      inversor_sobra_percentual: null,
      formula_version: input.formula_version || 'v1.0',
      snapshot_imutavel: true,
    };
  }

  if (invertersCompativeis.length === 0) {
    erros.push('Nenhum inversor ativo suporta a potência calculada com a margem de segurança.');
    return {
      status: 'inversor_incompativel',
      mensagens_erro: erros,
      mensagens_alerta: alertas,
      irradiacao_kwh_m2_dia: input.irradiacao_kwh_m2_dia,
      consumo_medio_mensal_kwh: input.consumo_medio_mensal_kwh,
      consumo_com_sobra_kwh,
      producao_diaria_bruta_placa,
      producao_diaria_real_placa,
      producao_mensal_real_placa,
      quantidade_bruta_placas,
      quantidade_sugerida,
      potencia_total_sugerida_kwp,
      inversor_sugerido_id: null,
      inversor_sugerido_nome: null,
      inversor_capacidade_nominal_kw: null,
      inversor_sobrecarga_decimal: null,
      inversor_capacidade_real_kw: null,
      inversor_sobra_percentual: null,
      formula_version: input.formula_version || 'v1.0',
      snapshot_imutavel: true,
    };
  }

  const selectedInverter = invertersCompativeis[0];
  const inversor_sugerido_id = selectedInverter.id;
  const inversor_sugerido_nome = selectedInverter.nome;
  const inversor_capacidade_nominal_kw = selectedInverter.capacidade_kw;
  const inversor_sobrecarga_decimal = selectedInverter.sobrecarga_decimal;
  const inversor_capacidade_real_kw = selectedInverter.capacidade_real_kw;
  const inversor_sobra_percentual = selectedInverter.sobra;

  // Inverter alerts
  if (inversor_sobra_percentual < 5) {
    alertas.push(`Sobra do inversor muito baixa (${inversor_sobra_percentual.toFixed(1)}%).`);
  } else if (inversor_sobra_percentual > 50) {
    alertas.push(`Sobra do inversor muito alta (${inversor_sobra_percentual.toFixed(1)}%).`);
  }

  return {
    status: 'sucesso',
    mensagens_erro: erros,
    mensagens_alerta: alertas,
    irradiacao_kwh_m2_dia: input.irradiacao_kwh_m2_dia,
    consumo_medio_mensal_kwh: input.consumo_medio_mensal_kwh,
    consumo_com_sobra_kwh,
    producao_diaria_bruta_placa,
    producao_diaria_real_placa,
    producao_mensal_real_placa,
    quantidade_bruta_placas,
    quantidade_sugerida,
    potencia_total_sugerida_kwp,
    inversor_sugerido_id,
    inversor_sugerido_nome,
    inversor_capacidade_nominal_kw,
    inversor_sobrecarga_decimal,
    inversor_capacidade_real_kw,
    inversor_sobra_percentual,
    formula_version: input.formula_version || 'v1.0',
    snapshot_imutavel: true,
  };
}

/**
 * CORRECTION 09: Check technical compatibility after manual vendor changes.
 * This is called when vendor changes panel count, panel model, or inverter.
 */
export function verificarCompatibilidadeTecnica(
  quantidade_placas: number,
  modelo_placa: PanelModel,
  modelo_inversor: InverterModel,
  margem_inversor_decimal: number
): CompatibilityCheck {
  const potencia_total_kwp = (quantidade_placas * modelo_placa.potencia_wp) / 1000;
  const capacidade_real_kw = modelo_inversor.capacidade_kw * (1 + modelo_inversor.sobrecarga_decimal);
  const potencia_com_margem = potencia_total_kwp * (1 + margem_inversor_decimal);
  const sobra_percentual = potencia_total_kwp > 0
    ? ((capacidade_real_kw - potencia_total_kwp) / potencia_total_kwp) * 100
    : 0;

  const alertas: string[] = [];
  const compativel = capacidade_real_kw >= potencia_com_margem;

  if (!compativel) {
    alertas.push(`Inversor ${modelo_inversor.nome} não suporta ${potencia_total_kwp.toFixed(2)} kWp com margem de ${(margem_inversor_decimal * 100).toFixed(0)}%.`);
  }

  if (sobra_percentual < 5) {
    alertas.push(`Sobra do inversor muito baixa (${sobra_percentual.toFixed(1)}%).`);
  } else if (sobra_percentual > 50) {
    alertas.push(`Sobra do inversor muito alta (${sobra_percentual.toFixed(1)}%).`);
  }

  return {
    compativel,
    alertas,
    potencia_total_kwp,
    inversor_capacidade_real_kw: capacidade_real_kw,
    inversor_sobra_percentual: sobra_percentual,
  };
}
