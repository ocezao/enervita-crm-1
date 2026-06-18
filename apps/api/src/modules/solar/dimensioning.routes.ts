/**
 * Solar Dimensioning API Routes.
 *
 * Endpoints:
 * - GET  /api/solar/irradiacao          - List irradiation data
 * - GET  /api/solar/irradiacao/:cidade/:uf - Get irradiation for city
 * - GET  /api/solar/placas              - List panel models
 * - GET  /api/solar/placas/:id          - Get panel model
 * - GET  /api/solar/inversores          - List inverter models
 * - GET  /api/solar/inversores/:id      - Get inverter model
 * - GET  /api/solar/telhados            - List roof types
 * - GET  /api/solar/parametros          - List dimensioning parameters
 * - GET  /api/solar/custos              - List standard costs
 * - POST /api/solar/dimensionar         - Calculate dimensioning
 * - GET  /api/solar/dimensionamentos    - List dimensioning snapshots
 * - GET  /api/solar/dimensionamentos/:id - Get dimensioning snapshot
 */

import type { FastifyInstance } from 'fastify';
import { calcularDimensionamento } from './dimensioning.engine.js';
import { createDimensioningRepository, type DimensioningRepository } from './dimensioning.repository.js';

interface SolarDimensioningRouteOptions {
  dimensioningRepository: DimensioningRepository;
}

export async function registerSolarDimensioningRoutes(app: FastifyInstance, options: SolarDimensioningRouteOptions) {
  const repo = options.dimensioningRepository;

  // ── Auth helper ─────────────────────────────
  function getTenantId(request: any): string {
    const tenantId = request.user?.tenantId ?? request.session?.tenantId;
    if (!tenantId) throw new Error('Tenant não identificado');
    return tenantId;
  }

  function getUserId(request: any): string | null {
    return request.user?.id ?? request.session?.userId ?? null;
  }

  // ── Reference Data ──────────────────────────

  app.get('/api/solar/irradiacao', async (request, reply) => {
    const tenantId = getTenantId(request);
    const data = await repo.listIrradiacao(tenantId);
    return reply.send({ irradiacao: data });
  });

  app.get('/api/solar/irradiacao/:cidade/:uf', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { cidade, uf } = request.params as { cidade: string; uf: string };
    const data = await repo.getIrradiacao(tenantId, decodeURIComponent(cidade), uf.toUpperCase());
    if (!data) return reply.status(404).send({ error: 'Irradiação não cadastrada para esta cidade.' });
    return reply.send({ irradiacao: data });
  });

  app.get('/api/solar/placas', async (request, reply) => {
    const tenantId = getTenantId(request);
    const data = await repo.listPlacas(tenantId);
    return reply.send({ placas: data });
  });

  app.get('/api/solar/placas/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };
    const data = await repo.getPlaca(tenantId, id);
    if (!data) return reply.status(404).send({ error: 'Modelo de placa não encontrado.' });
    return reply.send({ placa: data });
  });

  app.get('/api/solar/inversores', async (request, reply) => {
    const tenantId = getTenantId(request);
    const data = await repo.listInversores(tenantId);
    return reply.send({ inversores: data });
  });

  app.get('/api/solar/inversores/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };
    const data = await repo.getInversor(tenantId, id);
    if (!data) return reply.status(404).send({ error: 'Modelo de inversor não encontrado.' });
    return reply.send({ inversor: data });
  });

  app.get('/api/solar/telhados', async (request, reply) => {
    const tenantId = getTenantId(request);
    const data = await repo.listTelhados(tenantId);
    return reply.send({ telhados: data });
  });

  app.get('/api/solar/parametros', async (request, reply) => {
    const tenantId = getTenantId(request);
    const data = await repo.listParametros(tenantId);
    return reply.send({ parametros: data });
  });

  app.get('/api/solar/custos', async (request, reply) => {
    const tenantId = getTenantId(request);
    const data = await repo.listCustos(tenantId);
    return reply.send({ custos: data });
  });

  // ── Dimensioning Calculation ────────────────

  app.post('/api/solar/dimensionar', async (request, reply) => {
    const tenantId = getTenantId(request);
    const userId = getUserId(request);
    const body = request.body as any;

    // Validate required fields
    if (!body?.cidade || !body?.uf) {
      return reply.status(400).send({ error: 'Cidade e UF são obrigatórios.' });
    }
    if (!body?.consumo_medio_mensal_kwh || body.consumo_medio_mensal_kwh <= 0) {
      return reply.status(400).send({ error: 'Consumo médio mensal em kWh é obrigatório e deve ser maior que zero.' });
    }
    if (!body?.modelo_placa_id) {
      return reply.status(400).send({ error: 'Modelo de placa é obrigatório.' });
    }

    // Load reference data
    const irradiacao = await repo.getIrradiacao(tenantId, body.cidade, body.uf.toUpperCase());
    const placa = await repo.getPlaca(tenantId, body.modelo_placa_id);
    const inversores = await repo.listInversores(tenantId);

    if (!irradiacao) {
      return reply.status(400).send({
        error: 'Irradiação não cadastrada para esta cidade.',
        status: 'pendente_irradiacao',
      });
    }
    if (!placa) {
      return reply.status(400).send({ error: 'Modelo de placa não encontrado.' });
    }

    // Load default parameters
    const perdaPadrao = await repo.getParametroDecimal(tenantId, 'perda_padrao', 0.22);
    const sobraPadrao = await repo.getParametroDecimal(tenantId, 'sobra_padrao', 0.30);
    const margemInversor = await repo.getParametroDecimal(tenantId, 'margem_inversor', 0.10);

    // Use provided values or defaults
    const perda = body.perda_decimal ?? perdaPadrao;
    const sobra = body.sobra_decimal ?? sobraPadrao;
    const margem = body.margem_inversor_decimal ?? margemInversor;
    const diasMes = body.dias_mes ?? 30;

    // Get preferred inverter if specified
    if (body.modelo_inversor_id) {
    }

    // Run calculation engine
    const resultado = calcularDimensionamento({
      cidade: body.cidade,
      uf: body.uf.toUpperCase(),
      consumo_medio_mensal_kwh: Number(body.consumo_medio_mensal_kwh),
      tipo_telhado: body.tipo_telhado ?? null,
      perda_decimal: perda,
      sobra_decimal: sobra,
      modelo_placa: {
        id: placa.id,
        nome: placa.nome,
        fabricante: placa.fabricante,
        potencia_wp: placa.potencia_wp,
        area_util_m2: Number(placa.area_util_m2),
        eficiencia_decimal: Number(placa.eficiencia_decimal),
        ativo: placa.ativo,
        padrao: placa.padrao,
      },
      inversores_disponiveis: inversores.map((inv) => ({
        id: inv.id,
        nome: inv.nome,
        fabricante: inv.fabricante,
        capacidade_kw: Number(inv.capacidade_kw),
        sobrecarga_decimal: Number(inv.sobrecarga_decimal),
        ativo: inv.ativo,
        padrao: inv.padrao,
      })),
      margem_inversor_decimal: margem,
      dias_mes: diasMes,
      irradiacao_kwh_m2_dia: Number(irradiacao.irradiacao_kwh_m2_dia),
    });

    // Save snapshot
    const snapshot = await repo.saveDimensionamento(tenantId, {
      lead_id: body.lead_id ?? null,
      proposal_id: body.proposal_id ?? null,
      cidade: body.cidade,
      uf: body.uf.toUpperCase(),
      consumo_medio_mensal_kwh: Number(body.consumo_medio_mensal_kwh),
      tipo_telhado: body.tipo_telhado ?? null,
      perda_decimal: perda,
      sobra_decimal: sobra,
      modelo_placa_id: placa.id,
      modelo_placa_nome: placa.nome,
      modelo_placa_potencia_wp: placa.potencia_wp,
      modelo_placa_area_m2: Number(placa.area_util_m2),
      modelo_placa_eficiencia: Number(placa.eficiencia_decimal),
      modelo_inversor_id: resultado.inversor_sugerido_id,
      modelo_inversor_nome: resultado.inversor_sugerido_nome,
      modelo_inversor_capacidade_kw: resultado.inversor_capacidade_nominal_kw,
      modelo_inversor_sobrecarga: resultado.inversor_sobrecarga_decimal,
      margem_inversor_decimal: margem,
      dias_mes: diasMes,
      irradiacao_kwh_m2_dia: Number(irradiacao.irradiacao_kwh_m2_dia),
      producao_diaria_bruta_placa: resultado.producao_diaria_bruta_placa,
      producao_diaria_real_placa: resultado.producao_diaria_real_placa,
      producao_mensal_real_placa: resultado.producao_mensal_real_placa,
      consumo_com_sobra_kwh: resultado.consumo_com_sobra_kwh,
      quantidade_bruta_placas: resultado.quantidade_bruta_placas,
      quantidade_sugerida: resultado.quantidade_sugerida,
      potencia_total_sugerida_kwp: resultado.potencia_total_sugerida_kwp,
      inversor_sugerido_id: resultado.inversor_sugerido_id,
      inversor_sugerido_nome: resultado.inversor_sugerido_nome,
      inversor_capacidade_nominal_kw: resultado.inversor_capacidade_nominal_kw,
      inversor_sobrecarga_decimal: resultado.inversor_sobrecarga_decimal,
      inversor_capacidade_real_kw: resultado.inversor_capacidade_real_kw,
      inversor_sobra_percentual: resultado.inversor_sobra_percentual,
      status: resultado.status,
      mensagens_erro: resultado.mensagens_erro,
      mensagens_alerta: resultado.mensagens_alerta,
      usuario_id: userId,
    });

    return reply.send({
      dimensionamento: snapshot,
      resultado,
    });
  });

  // ── Snapshots ───────────────────────────────

  app.get('/api/solar/dimensionamentos', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { lead_id } = request.query as { lead_id?: string };
    const data = await repo.listDimensionamentos(tenantId, lead_id);
    return reply.send({ dimensionamentos: data });
  });

  app.get('/api/solar/dimensionamentos/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params as { id: string };
    const data = await repo.getDimensionamento(tenantId, id);
    if (!data) return reply.status(404).send({ error: 'Dimensionamento não encontrado.' });
    return reply.send({ dimensionamento: data });
  });

  // ── Financial Calculation ───────────────────

  app.post('/api/solar/calcular-custos', async (request, reply) => {
    const tenantId = getTenantId(request);
    const body = request.body as any;

    if (!body?.dimensionamento_id && !body?.quantidade_modulos) {
      return reply.status(400).send({ error: 'Informe dimensionamento_id ou quantidade_modulos.' });
    }

    const custosPadrao = await repo.listCustos(tenantId);
    let quantidadeModulos = body.quantidade_modulos ?? 0;

    // If dimensionamento_id provided, load snapshot for module count
    if (body.dimensionamento_id) {
      const dim = await repo.getDimensionamento(tenantId, body.dimensionamento_id);
      if (dim) quantidadeModulos = dim.quantidade_sugerida ?? 0;
    }

    const distanciaKm = body.distancia_km ?? 0;
    const linhas: Array<{
      custo_padrao_id?: string | null;
      nome: string;
      tipo: string;
      valor_calculado: number;
      quantidade_modulos?: number | null;
      distancia_km?: number | null;
      percentual?: number | null;
      origem?: string;
    }> = [];

    let subtotalNaoPercentual = 0;

    for (const custo of custosPadrao) {
      let valorCalculado = 0;

      switch (custo.tipo) {
        case 'fixo':
          valorCalculado = Number(custo.valor ?? 0);
          break;
        case 'por_modulo':
          valorCalculado = Number(custo.valor ?? 0) * quantidadeModulos;
          break;
        case 'por_distancia':
          valorCalculado = Number(custo.valor ?? 0) * distanciaKm;
          break;
        case 'percentual_sobre_total':
        case 'comissao_sobre_total':
          // Will be calculated after subtotal
          valorCalculado = 0;
          break;
      }

      linhas.push({
        custo_padrao_id: custo.id,
        nome: custo.nome,
        tipo: custo.tipo,
        valor_calculado: valorCalculado,
        quantidade_modulos: custo.tipo === 'por_modulo' ? quantidadeModulos : null,
        distancia_km: custo.tipo === 'por_distancia' ? distanciaKm : null,
        percentual: custo.percentual ? Number(custo.percentual) : null,
        origem: 'automatico',
      });

      if (custo.tipo !== 'percentual_sobre_total' && custo.tipo !== 'comissao_sobre_total') {
        subtotalNaoPercentual += valorCalculado;
      }
    }

    // Calculate gross-up for percentage costs
    const somaPercentuais = linhas
      .filter((l) => l.tipo === 'percentual_sobre_total' || l.tipo === 'comissao_sobre_total')
      .reduce((sum, l) => sum + (l.percentual ?? 0), 0);

    if (somaPercentuais >= 1) {
      return reply.status(400).send({
        error: 'Soma dos percentuais sobre o total é maior ou igual a 100%. Não é possível calcular.',
      });
    }

    const totalFinal = somaPercentuais > 0
      ? subtotalNaoPercentual / (1 - somaPercentuais)
      : subtotalNaoPercentual;

    // Update percentage lines with calculated values
    for (const linha of linhas) {
      if (linha.tipo === 'percentual_sobre_total' || linha.tipo === 'comissao_sobre_total') {
        linha.valor_calculado = Math.round(totalFinal * (linha.percentual ?? 0) * 100) / 100;
      }
    }

    const totalGeral = linhas.reduce((sum, l) => sum + l.valor_calculado, 0);

    return reply.send({
      linhas,
      subtotal_nao_percentual: Math.round(subtotalNaoPercentual * 100) / 100,
      soma_percentuais: Math.round(somaPercentuais * 10000) / 100,
      total_final: Math.round(totalFinal * 100) / 100,
      total_geral: Math.round(totalGeral * 100) / 100,
      quantidade_modulos: quantidadeModulos,
    });
  });
}
