/**
 * Solar Dimensioning Repository.
 *
 * Handles all database operations for:
 * - irradiacao_cidades
 * - modelos_placas
 * - modelos_inversores
 * - tipos_telhado
 * - parametros_dimensionamento
 * - custos_padrao
 * - dimensionamentos (snapshots)
 * - linhas_custo_proposta
 */

import pg from 'pg';

const { Pool } = pg;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface IrradiacaoCidade {
  id: string;
  tenant_id: string;
  cidade: string;
  uf: string;
  codigo_ibge: string | null;
  lat: number | null;
  lon: number | null;
  classe: string | null;
  estado_nome: string | null;
  fonte_id: string | null;
  irradiacao_kwh_m2_dia: number;
  fonte: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModeloPlaca {
  id: string;
  tenant_id: string;
  nome: string;
  fabricante: string | null;
  potencia_wp: number;
  area_util_m2: number;
  eficiencia_decimal: number;
  ativo: boolean;
  padrao: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModeloInversor {
  id: string;
  tenant_id: string;
  nome: string;
  fabricante: string | null;
  capacidade_kw: number;
  sobrecarga_decimal: number;
  ativo: boolean;
  padrao: boolean;
  created_at: string;
  updated_at: string;
}

export interface TipoTelhado {
  id: string;
  tenant_id: string;
  nome: string;
  perda_padrao_decimal: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParametroDimensionamento {
  id: string;
  tenant_id: string;
  chave: string;
  valor_decimal: number | null;
  valor_texto: string | null;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustoPadrao {
  id: string;
  tenant_id: string;
  nome: string;
  tipo: string;
  valor: number | null;
  percentual: number | null;
  base_calculo: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DimensionamentoSnapshot {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  proposal_id: string | null;
  cidade: string;
  uf: string;
  consumo_medio_mensal_kwh: number;
  tipo_telhado: string | null;
  perda_decimal: number;
  sobra_decimal: number;
  modelo_placa_id: string | null;
  modelo_placa_nome: string;
  modelo_placa_potencia_wp: number;
  modelo_placa_area_m2: number;
  modelo_placa_eficiencia: number;
  modelo_inversor_id: string | null;
  modelo_inversor_nome: string | null;
  modelo_inversor_capacidade_kw: number | null;
  modelo_inversor_sobrecarga: number | null;
  margem_inversor_decimal: number;
  dias_mes: number;
  irradiacao_kwh_m2_dia: number;
  producao_diaria_bruta_placa: number | null;
  producao_diaria_real_placa: number | null;
  producao_mensal_real_placa: number | null;
  consumo_com_sobra_kwh: number | null;
  quantidade_bruta_placas: number | null;
  quantidade_sugerida: number | null;
  potencia_total_sugerida_kwp: number | null;
  inversor_sugerido_id: string | null;
  inversor_sugerido_nome: string | null;
  inversor_capacidade_nominal_kw: number | null;
  inversor_sobrecarga_decimal: number | null;
  inversor_capacidade_real_kw: number | null;
  inversor_sobra_percentual: number | null;
  status: string;
  mensagens_erro: unknown;
  mensagens_alerta: unknown;
  usuario_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinhaCustoProposta {
  id: string;
  tenant_id: string;
  proposal_id: string;
  dimensionamento_id: string | null;
  custo_padrao_id: string | null;
  nome: string;
  tipo: string;
  valor_calculado: number;
  quantidade_modulos: number | null;
  distancia_km: number | null;
  percentual: number | null;
  origem: string;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────
// Repository
// ──────────────────────────────────────────────

export type DimensioningRepository = ReturnType<typeof createDimensioningRepository>;

export function createDimensioningRepository(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    // ── Irradiation ───────────────────────────

    async listIrradiacao(tenantId: string, filters: { q?: string; uf?: string; limit?: number } = {}): Promise<IrradiacaoCidade[]> {
      const params: unknown[] = [tenantId];
      const where = ['tenant_id = $1', 'ativo = true'];
      if (filters.q?.trim()) {
        params.push(`%${filters.q.trim()}%`);
        where.push(`lower(cidade) like lower($${params.length})`);
      }
      if (filters.uf?.trim()) {
        params.push(filters.uf.trim().toUpperCase());
        where.push(`uf = $${params.length}`);
      }
      params.push(Math.max(1, Math.min(filters.limit ?? 80, 200)));
      const { rows } = await pool.query(
        `SELECT * FROM irradiacao_cidades WHERE ${where.join(' AND ')} ORDER BY cidade, uf LIMIT $${params.length}`,
        params
      );
      return rows;
    },

    async getIrradiacao(tenantId: string, cidade: string, uf: string): Promise<IrradiacaoCidade | null> {
      const { rows } = await pool.query(
        'SELECT * FROM irradiacao_cidades WHERE tenant_id = $1 AND cidade = $2 AND uf = $3 AND ativo = true LIMIT 1',
        [tenantId, cidade, uf]
      );
      return rows[0] ?? null;
    },

    async upsertIrradiacao(tenantId: string, data: Omit<IrradiacaoCidade, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<IrradiacaoCidade> {
      const { rows } = await pool.query(
        `INSERT INTO irradiacao_cidades (tenant_id, cidade, uf, codigo_ibge, lat, lon, classe, estado_nome, fonte_id, irradiacao_kwh_m2_dia, fonte, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (tenant_id, cidade, uf) DO UPDATE SET
           codigo_ibge = EXCLUDED.codigo_ibge,
           lat = EXCLUDED.lat,
           lon = EXCLUDED.lon,
           classe = EXCLUDED.classe,
           estado_nome = EXCLUDED.estado_nome,
           fonte_id = EXCLUDED.fonte_id,
           irradiacao_kwh_m2_dia = EXCLUDED.irradiacao_kwh_m2_dia,
           fonte = EXCLUDED.fonte,
           ativo = EXCLUDED.ativo,
           updated_at = now()
         RETURNING *`,
        [tenantId, data.cidade, data.uf, data.codigo_ibge, data.lat, data.lon, data.classe, data.estado_nome, data.fonte_id, data.irradiacao_kwh_m2_dia, data.fonte, data.ativo]
      );
      return rows[0];
    },

    // ── Panel Models ──────────────────────────

    async listPlacas(tenantId: string): Promise<ModeloPlaca[]> {
      const { rows } = await pool.query(
        'SELECT * FROM modelos_placas WHERE tenant_id = $1 AND ativo = true ORDER BY padrao DESC, potencia_wp DESC',
        [tenantId]
      );
      return rows;
    },

    async getPlaca(tenantId: string, id: string): Promise<ModeloPlaca | null> {
      const { rows } = await pool.query(
        'SELECT * FROM modelos_placas WHERE tenant_id = $1 AND id = $2',
        [tenantId, id]
      );
      return rows[0] ?? null;
    },

    // ── Inverter Models ───────────────────────

    async listInversores(tenantId: string): Promise<ModeloInversor[]> {
      const { rows } = await pool.query(
        'SELECT * FROM modelos_inversores WHERE tenant_id = $1 AND ativo = true ORDER BY capacidade_kw ASC',
        [tenantId]
      );
      return rows;
    },

    async getInversor(tenantId: string, id: string): Promise<ModeloInversor | null> {
      const { rows } = await pool.query(
        'SELECT * FROM modelos_inversores WHERE tenant_id = $1 AND id = $2',
        [tenantId, id]
      );
      return rows[0] ?? null;
    },

    // ── Roof Types ────────────────────────────

    async listTelhados(tenantId: string): Promise<TipoTelhado[]> {
      const { rows } = await pool.query(
        'SELECT * FROM tipos_telhado WHERE tenant_id = $1 AND ativo = true ORDER BY nome',
        [tenantId]
      );
      return rows;
    },

    // ── Parameters ────────────────────────────

    async listParametros(tenantId: string): Promise<ParametroDimensionamento[]> {
      const { rows } = await pool.query(
        'SELECT * FROM parametros_dimensionamento WHERE tenant_id = $1 AND ativo = true ORDER BY chave',
        [tenantId]
      );
      return rows;
    },

    async getParametro(tenantId: string, chave: string): Promise<ParametroDimensionamento | null> {
      const { rows } = await pool.query(
        'SELECT * FROM parametros_dimensionamento WHERE tenant_id = $1 AND chave = $2 AND ativo = true',
        [tenantId, chave]
      );
      return rows[0] ?? null;
    },

    async getParametroDecimal(tenantId: string, chave: string, fallback: number): Promise<number> {
      const param = await this.getParametro(tenantId, chave);
      return param?.valor_decimal ?? fallback;
    },

    // ── Standard Costs ────────────────────────

    async listCustos(tenantId: string): Promise<CustoPadrao[]> {
      const { rows } = await pool.query(
        'SELECT * FROM custos_padrao WHERE tenant_id = $1 AND ativo = true ORDER BY ordem_execucao NULLS LAST, tipo, nome',
        [tenantId]
      );
      return rows;
    },

    // ── Dimensioning Snapshots ─────────────────

    async saveDimensionamento(
      tenantId: string,
      data: {
        lead_id?: string | null;
        proposal_id?: string | null;
        cidade: string;
        uf: string;
        consumo_medio_mensal_kwh: number;
        tipo_telhado?: string | null;
        perda_decimal: number;
        sobra_decimal: number;
        modelo_placa_id?: string | null;
        modelo_placa_nome: string;
        modelo_placa_potencia_wp: number;
        modelo_placa_area_m2: number;
        modelo_placa_eficiencia: number;
        modelo_inversor_id?: string | null;
        modelo_inversor_nome?: string | null;
        modelo_inversor_capacidade_kw?: number | null;
        modelo_inversor_sobrecarga?: number | null;
        margem_inversor_decimal: number;
        dias_mes: number;
        irradiacao_kwh_m2_dia: number;
        producao_diaria_bruta_placa?: number | null;
        producao_diaria_real_placa?: number | null;
        producao_mensal_real_placa?: number | null;
        consumo_com_sobra_kwh?: number | null;
        quantidade_bruta_placas?: number | null;
        quantidade_sugerida?: number | null;
        potencia_total_sugerida_kwp?: number | null;
        inversor_sugerido_id?: string | null;
        inversor_sugerido_nome?: string | null;
        inversor_capacidade_nominal_kw?: number | null;
        inversor_sobrecarga_decimal?: number | null;
        inversor_capacidade_real_kw?: number | null;
        inversor_sobra_percentual?: number | null;
        status: string;
        mensagens_erro?: unknown[];
        mensagens_alerta?: unknown[];
        usuario_id?: string | null;
      }
    ): Promise<DimensionamentoSnapshot> {
      const { rows } = await pool.query(
        `INSERT INTO dimensionamentos (
          tenant_id, lead_id, proposal_id, cidade, uf, consumo_medio_mensal_kwh,
          tipo_telhado, perda_decimal, sobra_decimal,
          modelo_placa_id, modelo_placa_nome, modelo_placa_potencia_wp, modelo_placa_area_m2, modelo_placa_eficiencia,
          modelo_inversor_id, modelo_inversor_nome, modelo_inversor_capacidade_kw, modelo_inversor_sobrecarga,
          margem_inversor_decimal, dias_mes, irradiacao_kwh_m2_dia,
          producao_diaria_bruta_placa, producao_diaria_real_placa, producao_mensal_real_placa,
          consumo_com_sobra_kwh, quantidade_bruta_placas, quantidade_sugerida, potencia_total_sugerida_kwp,
          inversor_sugerido_id, inversor_sugerido_nome, inversor_capacidade_nominal_kw,
          inversor_sobrecarga_decimal, inversor_capacidade_real_kw, inversor_sobra_percentual,
          status, mensagens_erro, mensagens_alerta, usuario_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19, $20, $21,
          $22, $23, $24,
          $25, $26, $27, $28,
          $29, $30, $31,
          $32, $33, $34,
          $35, $36, $37, $38
        ) RETURNING *`,
        [
          tenantId, data.lead_id ?? null, data.proposal_id ?? null,
          data.cidade, data.uf, data.consumo_medio_mensal_kwh,
          data.tipo_telhado ?? null, data.perda_decimal, data.sobra_decimal,
          data.modelo_placa_id ?? null, data.modelo_placa_nome,
          data.modelo_placa_potencia_wp, data.modelo_placa_area_m2, data.modelo_placa_eficiencia,
          data.modelo_inversor_id ?? null, data.modelo_inversor_nome ?? null,
          data.modelo_inversor_capacidade_kw ?? null, data.modelo_inversor_sobrecarga ?? null,
          data.margem_inversor_decimal, data.dias_mes, data.irradiacao_kwh_m2_dia,
          data.producao_diaria_bruta_placa ?? null, data.producao_diaria_real_placa ?? null,
          data.producao_mensal_real_placa ?? null,
          data.consumo_com_sobra_kwh ?? null, data.quantidade_bruta_placas ?? null,
          data.quantidade_sugerida ?? null, data.potencia_total_sugerida_kwp ?? null,
          data.inversor_sugerido_id ?? null, data.inversor_sugerido_nome ?? null,
          data.inversor_capacidade_nominal_kw ?? null,
          data.inversor_sobrecarga_decimal ?? null, data.inversor_capacidade_real_kw ?? null,
          data.inversor_sobra_percentual ?? null,
          data.status, JSON.stringify(data.mensagens_erro ?? []),
          JSON.stringify(data.mensagens_alerta ?? []), data.usuario_id ?? null,
        ]
      );
      return rows[0];
    },

    async listDimensionamentos(tenantId: string, leadId?: string): Promise<DimensionamentoSnapshot[]> {
      if (leadId) {
        const { rows } = await pool.query(
          'SELECT * FROM dimensionamentos WHERE tenant_id = $1 AND lead_id = $2 ORDER BY created_at DESC',
          [tenantId, leadId]
        );
        return rows;
      }
      const { rows } = await pool.query(
        'SELECT * FROM dimensionamentos WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50',
        [tenantId]
      );
      return rows;
    },

    async getDimensionamento(tenantId: string, id: string): Promise<DimensionamentoSnapshot | null> {
      const { rows } = await pool.query(
        'SELECT * FROM dimensionamentos WHERE tenant_id = $1 AND id = $2',
        [tenantId, id]
      );
      return rows[0] ?? null;
    },

    // ── Proposal Cost Lines ────────────────────

    async saveLinhasCusto(
      tenantId: string,
      proposalId: string,
      dimensionamentoId: string | null,
      linhas: Array<{
        custo_padrao_id?: string | null;
        nome: string;
        tipo: string;
        valor_calculado: number;
        quantidade_modulos?: number | null;
        distancia_km?: number | null;
        percentual?: number | null;
        origem?: string;
      }>
    ): Promise<LinhaCustoProposta[]> {
      if (linhas.length === 0) return [];

      const values: unknown[] = [];
      const placeholders: string[] = [];
      let idx = 1;

      for (const linha of linhas) {
        placeholders.push(
          `($1, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
        );
        values.push(
          tenantId, proposalId, dimensionamentoId ?? null,
          linha.custo_padrao_id ?? null, linha.nome, linha.tipo,
          linha.valor_calculado, linha.quantidade_modulos ?? null,
          linha.distancia_km ?? null, linha.percentual ?? null
        );
      }

      const { rows } = await pool.query(
        `INSERT INTO linhas_custo_proposta (
          tenant_id, proposal_id, dimensionamento_id,
          custo_padrao_id, nome, tipo, valor_calculado,
          quantidade_modulos, distancia_km, percentual
        ) VALUES ${placeholders.join(', ')}
        RETURNING *`,
        values
      );
      return rows;
    },

    async listLinhasCusto(tenantId: string, proposalId: string): Promise<LinhaCustoProposta[]> {
      const { rows } = await pool.query(
        'SELECT * FROM linhas_custo_proposta WHERE tenant_id = $1 AND proposal_id = $2 ORDER BY tipo, nome',
        [tenantId, proposalId]
      );
      return rows;
    },

    async deleteLinhasCusto(tenantId: string, proposalId: string): Promise<void> {
      await pool.query(
        'DELETE FROM linhas_custo_proposta WHERE tenant_id = $1 AND proposal_id = $2',
        [tenantId, proposalId]
      );
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}
