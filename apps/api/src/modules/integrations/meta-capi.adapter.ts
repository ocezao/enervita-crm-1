import crypto from 'crypto';

/**
 * Dados do usuário para envio ao Meta CAPI
 * Segue padrão de hash SHA-256 para PII (Personally Identifiable Information)
 */
interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  city?: string;
}

/**
 * Dados do evento para envio ao Meta CAPI
 */
interface EventData {
  event_name: string;
  event_time: number;
  action_source: 'website' | 'call_center' | 'chat' | 'physical_store' | 'app' | 'other';
  custom_data?: {
    currency?: string;
    value?: number;
    content_name?: string;
    status?: string;
    [key: string]: any;
  };
}

/**
 * Resposta da API do Meta
 */
interface MetaResponse {
  events_received: number;
  messages: any[];
  fb_trace_id?: string;
}

/**
 * Adaptador para integração com a Conversions API do Meta (Facebook)
 * Responsável por normalizar dados, hashear PII e enviar eventos.
 */
export class MetaCAPIAdapter {
  private readonly pixelId: string;
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly debugMode: boolean;

  constructor() {
    this.pixelId = process.env.META_PIXEL_ID || '';
    this.accessToken = process.env.META_ACCESS_TOKEN || '';
    this.baseUrl = 'https://graph.facebook.com/v18.0';
    this.debugMode = process.env.NODE_ENV === 'development';
  }

  /**
   * Envia um evento para a API do Meta
   * @param eventData - Dados do evento
   * @param userData - Dados do usuário (serão hasheados automaticamente)
   * @returns Resposta da API ou null em caso de falha silenciosa
   */
  async sendEvent(eventData: EventData, userData: UserData): Promise<MetaResponse | null> {
    // Validação básica de configuração
    if (!this.pixelId || !this.accessToken) {
      console.warn('[MetaCAPI] Pixel ID ou Access Token não configurados. Evento não enviado.');
      return null;
    }

    try {
      // Normalizar e hashear dados do usuário (exigência do Meta)
      const hashedUserData = this.hashUserData(userData);

      const payload = {
        data: [
          {
            ...eventData,
            user_data: hashedUserData,
          },
        ],
        test_event_code: this.debugMode ? 'TEST_CODE_IGNORE_IN_PROD' : undefined,
      };

      const url = `${this.baseUrl}/${this.pixelId}/events?access_token=${this.accessToken}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Meta API Error ${response.status}: ${errorText}`);
      }

      const result = await response.json() as MetaResponse;
      
      if (this.debugMode) {
        console.log('[MetaCAPI] Evento enviado com sucesso:', result);
      }

      return result;

    } catch (error) {
      console.error('[MetaCAPI] Erro ao enviar evento:', error);
      // Falha silenciosa: não propaga erro para não quebrar o fluxo principal
      return null;
    }
  }

  /**
   * Hashea dados sensíveis do usuário usando SHA-256
   * Conforme documentação do Meta: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
   */
  private hashUserData(userData: UserData): Record<string, string> {
    const hashed: Record<string, string> = {};

    if (userData.email) {
      // Email deve ser minúsculo e trimado antes do hash
      hashed.em = this.sha256(userData.email.toLowerCase().trim());
    }

    if (userData.phone) {
      // Telefone deve conter apenas números, removendo caracteres especiais
      const cleanPhone = userData.phone.replace(/\D/g, '');
      // Adicionar código do país se necessário (assumindo +55 para Brasil se não especificado)
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      hashed.ph = this.sha256(formattedPhone);
    }

    if (userData.firstName) {
      hashed.fn = this.sha256(userData.firstName.toLowerCase().trim());
    }

    if (userData.city) {
      hashed.ct = this.sha256(userData.city.toLowerCase().trim());
    }

    return hashed;
  }

  /**
   * Função utilitária para hash SHA-256
   */
  private sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Método de teste para validar conexão com a API do Meta
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.pixelId || !this.accessToken) {
      return { success: false, message: 'Pixel ID ou Access Token não configurados' };
    }

    try {
      const result = await this.sendEvent(
        {
          event_name: 'PageView',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
        },
        { email: 'test@example.com' }
      );

      if (result) {
        return { success: true, message: 'Conexão bem-sucedida. Eventos recebidos: ' + result.events_received };
      } else {
        return { success: false, message: 'Falha na comunicação com a API do Meta' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }
}
