import { db } from '../../../db/pool';
import { MetaCAPIAdapter } from '../../integrations/meta-capi.adapter';
import { SOLAR_FUNNEL_STAGES, SolarStageKey } from '../config/solar-funnel.definition';
import { Lead } from '@myapp/shared-contracts';

interface MoveLeadDTO {
  leadId: string;
  targetStageId: string;
  userId: string;
  observation?: string;
}

interface CapiLogDTO {
  leadId: string;
  stageKey: string;
  eventName: string;
  status: 'success' | 'error' | 'skipped';
  payload?: any;
  errorMessage?: string;
  metaResponse?: any;
}

export class PipelineSolarService {
  private capiAdapter: MetaCAPIAdapter;

  constructor() {
    this.capiAdapter = new MetaCAPIAdapter();
  }

  /**
   * Move um lead para uma nova etapa no pipeline Solar.
   * Inclui validação de regras de negócio, atualização de status e disparo CAPI se aplicável.
   */
  async moveLead(dto: MoveLeadDTO) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Validar se a etapa existe e é válida para o funil Solar
      const targetStage = Object.values(SOLAR_FUNNEL_STAGES).find(
        (s) => s.id === dto.targetStageId
      );

      if (!targetStage) {
        throw new Error(`Etapa inválida: ${dto.targetStageId}`);
      }

      // 2. Obter dados atuais do lead para comparação e envio ao CAPI
      const leadResult = await client.query(
        `SELECT id, current_stage_id, email, phone, name, city, estimated_value 
         FROM leads 
         WHERE id = $1 AND pipeline_id = (SELECT id FROM pipelines WHERE slug = 'solar')
         FOR UPDATE`,
        [dto.leadId]
      );

      if (leadResult.rows.length === 0) {
        throw new Error('Lead não encontrado ou não pertence ao pipeline Solar');
      }

      const lead = leadResult.rows[0];
      const previousStageId = lead.current_stage_id;

      // 3. Regra de Negócio: Impedir retrocesso em etapas críticas (opcional, configurável)
      // Exemplo: Não permitir voltar de 'Assinatura' para 'Negociação' sem justificativa
      if (this.isCriticalRegression(previousStageId, dto.targetStageId) && !dto.observation) {
        throw new Error('Retrocesso em etapa crítica requer justificativa.');
      }

      // 4. Atualizar estágio do lead
      const updateQuery = `
        UPDATE leads 
        SET 
          current_stage_id = $1,
          updated_at = NOW(),
          last_stage_change_at = NOW()
        WHERE id = $2
        RETURNING *;
      `;
      
      await client.query(updateQuery, [dto.targetStageId, dto.leadId]);

      // 5. Registrar histórico de movimentação (Audit Log interno)
      await client.query(
        `INSERT INTO lead_stage_history (lead_id, from_stage_id, to_stage_id, user_id, observation)
         VALUES ($1, $2, $3, $4, $5)`,
        [dto.leadId, previousStageId, dto.targetStageId, dto.userId, dto.observation || null]
      );

      await client.query('COMMIT');

      // 6. Gatilho CAPI (FORA DA TRANSAÇÃO PRINCIPAL - Fail-Safe)
      // Se o CAPI falhar, o lead já foi movido. O erro é apenas logado.
      await this.triggerCapiIfNecessary(targetStage.key, lead);

      return { success: true, leadId: dto.leadId, newStage: targetStage.name };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PipelineSolarService] Erro ao mover lead:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verifica se a etapa possui gatilho CAPI e executa o disparo.
   * Execução assíncrona e não bloqueante.
   */
  private async triggerCapiIfNecessary(stageKey: SolarStageKey, leadData: any) {
    const stageDef = Object.values(SOLAR_FUNNEL_STAGES).find(s => s.key === stageKey);
    
    if (!stageDef || !stageDef.capiTrigger) {
      return; // Sem disparo necessário
    }

    try {
      console.log(`[CAPI] Disparando evento ${stageDef.capiTrigger.eventName} para lead ${leadData.id}`);

      // Preparar dados normalizados (Hash de PII)
      const userData = {
        email: leadData.email,
        phone: leadData.phone,
        firstName: leadData.name?.split(' ')[0],
        city: leadData.city,
      };

      const eventData = {
        event_name: stageDef.capiTrigger.eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        custom_data: {
          currency: 'BRL',
          value: stageDef.capiTrigger.sendValue ? leadData.estimated_value : undefined,
          content_name: 'Solar Project',
          status: stageKey,
        },
      };

      // Enviar para Meta
      const response = await this.capiAdapter.sendEvent(eventData, userData);

      // Salvar Log de Sucesso
      await this.saveCapiLog({
        leadId: leadData.id,
        stageKey,
        eventName: stageDef.capiTrigger.eventName,
        status: 'success',
        payload: eventData,
        metaResponse: response,
      });

    } catch (error) {
      console.error(`[CAPI] Falha ao disparar evento para lead ${leadData.id}:`, error);
      
      // Salvar Log de Erro (para auditoria e retry manual se necessário)
      await this.saveCapiLog({
        leadId: leadData.id,
        stageKey,
        eventName: stageDef?.capiTrigger?.eventName || 'unknown',
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Persiste o log do disparo CAPI no banco de dados.
   */
  private async saveCapiLog(logDto: CapiLogDTO) {
    try {
      await db.pool.query(
        `INSERT INTO meta_capi_logs (lead_id, stage_key, event_name, status, payload, error_message, meta_response, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          logDto.leadId,
          logDto.stageKey,
          logDto.eventName,
          logDto.status,
          JSON.stringify(logDto.payload || {}),
          logDto.errorMessage || null,
          JSON.stringify(logDto.metaResponse || {}),
        ]
      );
    } catch (logError) {
      console.error('[PipelineSolarService] Falha ao salvar log CAPI:', logError);
      // Falha silenciosa no log para não gerar loop de erro
    }
  }

  /**
   * Valida regras de retrocesso crítico.
   * Pode ser expandido conforme necessidade de negócio.
   */
  private isCriticalRegression(from: string, to: string): boolean {
    const criticalStages = ['contract_sign', 'won'];
    return criticalStages.includes(from) && !criticalStages.includes(to);
  }
}
