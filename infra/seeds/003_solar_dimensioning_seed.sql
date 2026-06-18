-- Seed data for solar dimensioning tables (example data).
-- Run AFTER 016_solar_dimensioning.sql and after tenants/leads exist.
-- Uses a placeholder tenant_id; replace with actual tenant before production.

-- Get the first active tenant (or use a known one)
-- In production, replace this with the actual tenant_id

DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Get first active tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE status = 'active' LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No active tenant found, skipping seed data';
    RETURN;
  END IF;

  -- 1. Irradiation by city (example cities from São Paulo state)
  INSERT INTO irradiacao_cidades (tenant_id, cidade, uf, codigo_ibge, irradiacao_kwh_m2_dia, fonte, ativo)
  VALUES
    (v_tenant_id, 'São Paulo', 'SP', '3550308', 4.800, 'CRESESB/INPE', true),
    (v_tenant_id, 'Campinas', 'SP', '3509502', 5.100, 'CRESESB/INPE', true),
    (v_tenant_id, 'Ribeirão Preto', 'SP', '3543402', 5.400, 'CRESESB/INPE', true),
    (v_tenant_id, 'Sorocaba', 'SP', '3552205', 5.000, 'CRESESB/INPE', true),
    (v_tenant_id, 'Santos', 'SP', '3548500', 4.600, 'CRESESB/INPE', true),
    (v_tenant_id, 'Curitiba', 'PR', '4106902', 4.200, 'CRESESB/INPE', true),
    (v_tenant_id, 'Londrina', 'PR', '4113700', 4.800, 'CRESESB/INPE', true),
    (v_tenant_id, 'Belo Horizonte', 'MG', '3106200', 5.200, 'CRESESB/INPE', true),
    (v_tenant_id, 'Uberlândia', 'MG', '3170206', 5.500, 'CRESESB/INPE', true),
    (v_tenant_id, 'Rio de Janeiro', 'RJ', '3304557', 4.500, 'CRESESB/INPE', true),
    (v_tenant_id, 'Porto Alegre', 'RS', '4314902', 4.400, 'CRESESB/INPE', true),
    (v_tenant_id, 'Florianópolis', 'SC', '4205407', 4.300, 'CRESESB/INPE', true),
    (v_tenant_id, 'Brasília', 'DF', '5300108', 5.600, 'CRESESB/INPE', true),
    (v_tenant_id, 'Goiânia', 'GO', '5208707', 5.500, 'CRESESB/INPE', true),
    (v_tenant_id, 'Salvador', 'BA', '2927408', 5.300, 'CRESESB/INPE', true),
    (v_tenant_id, 'Recife', 'PE', '2611606', 5.400, 'CRESESB/INPE', true),
    (v_tenant_id, 'Fortaleza', 'CE', '2304400', 5.700, 'CRESESB/INPE', true),
    (v_tenant_id, 'Manaus', 'AM', '1302603', 4.500, 'CRESESB/INPE', true),
    (v_tenant_id, 'Adamantina', 'SP', '3500105', 5.200, 'CRESESB/INPE', true),
    (v_tenant_id, 'Foz do Iguaçu', 'PR', '4108304', 4.600, 'CRESESB/INPE', true)
  ON CONFLICT DO NOTHING;

  -- 2. Panel models (common residential/commercial panels)
  INSERT INTO modelos_placas (tenant_id, nome, fabricante, potencia_wp, area_util_m2, eficiencia_decimal, ativo, padrao)
  VALUES
    (v_tenant_id, 'Canadian Solar 550W', 'Canadian Solar', 550, 2.584, 0.2128, true, true),
    (v_tenant_id, 'JinkoSolar 555W', 'Jinko Solar', 555, 2.585, 0.2147, true, false),
    (v_tenant_id, 'Trina Solar 500W', 'Trina Solar', 500, 2.422, 0.2065, true, false),
    (v_tenant_id, 'LONGi 580W', 'LONGi', 580, 2.713, 0.2138, true, false),
    (v_tenant_id, 'JA Solar 540W', 'JA Solar', 540, 2.541, 0.2125, true, false),
    (v_tenant_id, 'Canadian Solar 450W', 'Canadian Solar', 450, 2.100, 0.2143, true, false),
    (v_tenant_id, 'Risen 370W', 'Risen Energy', 370, 1.870, 0.1979, true, false)
  ON CONFLICT DO NOTHING;

  -- 3. Inverter models (common residential/commercial inverters)
  INSERT INTO modelos_inversores (tenant_id, nome, fabricante, capacidade_kw, sobrecarga_decimal, ativo, padrao)
  VALUES
    (v_tenant_id, 'Growatt MIN 3000TL-X', 'Growatt', 3.000, 0.20, true, false),
    (v_tenant_id, 'Growatt MIN 5000TL-X', 'Growatt', 5.000, 0.20, true, false),
    (v_tenant_id, 'Growatt MOD 7000TL3-X', 'Growatt', 7.000, 0.20, true, false),
    (v_tenant_id, 'Fronius Primo 5.0-1', 'Fronius', 5.000, 0.15, true, true),
    (v_tenant_id, 'Fronius Primo 6.0-1', 'Fronius', 6.000, 0.15, true, false),
    (v_tenant_id, 'Fronius Primo 8.2-1', 'Fronius', 8.200, 0.15, true, false),
    (v_tenant_id, 'SMA Sunny Boy 5.0', 'SMA', 5.000, 0.15, true, false),
    (v_tenant_id, 'SMA Sunny Boy 6.0', 'SMA', 6.000, 0.15, true, false),
    (v_tenant_id, 'WEG SIW200G 5K', 'WEG', 5.000, 0.20, true, false),
    (v_tenant_id, 'WEG SIW200G 10K', 'WEG', 10.000, 0.20, true, false),
    (v_tenant_id, 'Huawei SUN2000-5KTL', 'Huawei', 5.000, 0.20, true, false),
    (v_tenant_id, 'Huawei SUN2000-8KTL', 'Huawei', 8.000, 0.20, true, false),
    (v_tenant_id, 'Huawei SUN2000-12KTL', 'Huawei', 12.000, 0.20, true, false),
    (v_tenant_id, 'Deye SUN-5K-SG04LP3', 'Deye', 5.000, 0.20, true, false),
    (v_tenant_id, 'Deye SUN-8K-SG04LP3', 'Deye', 8.000, 0.20, true, false)
  ON CONFLICT DO NOTHING;

  -- 4. Roof types
  INSERT INTO tipos_telhado (tenant_id, nome, perda_padrao_decimal, ativo)
  VALUES
    (v_tenant_id, 'Cerâmico (telha colonial)', 0.22, true),
    (v_tenant_id, 'Fibrocimento (telha Eternit)', 0.20, true),
    (v_tenant_id, 'Metálico (telha sanduíche)', 0.18, true),
    (v_tenant_id, 'Laje concreto', 0.25, true),
    (v_tenant_id, 'Solo (estrutura fixa)', 0.15, true),
    (v_tenant_id, 'Sem informação', 0.22, true)
  ON CONFLICT DO NOTHING;

  -- 5. Default dimensioning parameters
  INSERT INTO parametros_dimensionamento (tenant_id, chave, valor_decimal, valor_texto, descricao, ativo)
  VALUES
    (v_tenant_id, 'perda_padrao', 0.22, NULL, 'Perda padrão do sistema (22%)', true),
    (v_tenant_id, 'sobra_padrao', 0.30, NULL, 'Sobra comercial padrão (30%)', true),
    (v_tenant_id, 'margem_inversor', 0.10, NULL, 'Margem mínima de segurança do inversor (10%)', true),
    (v_tenant_id, 'dias_mes', NULL, '30', 'Dias considerados no mês', true),
    (v_tenant_id, 'perda_minima_alerta', 0.20, NULL, 'Perda mínima antes de alertar (20%)', true),
    (v_tenant_id, 'perda_maxima_alerta', 0.30, NULL, 'Perda máxima antes de alertar (30%)', true)
  ON CONFLICT DO NOTHING;

  -- 6. Standard costs
  INSERT INTO custos_padrao (tenant_id, nome, tipo, valor, percentual, base_calculo, ativo)
  VALUES
    (v_tenant_id, 'Mão de obra instalação', 'por_modulo', 150.00, NULL, 'quantidade_modulos', true),
    (v_tenant_id, 'Projeto elétrico', 'fixo', 800.00, NULL, NULL, true),
    (v_tenant_id, 'Material elétrico (cabos, disjuntores)', 'por_modulo', 80.00, NULL, 'quantidade_modulos', true),
    (v_tenant_id, 'Estrutura de fixação', 'por_modulo', 120.00, NULL, 'quantidade_modulos', true),
    (v_tenant_id, 'Homologação concessionária', 'fixo', 500.00, NULL, NULL, true),
    (v_tenant_id, 'Deslocamento técnico', 'por_distancia', 2.50, NULL, 'distancia_km', true),
    (v_tenant_id, 'Impostos', 'percentual_sobre_total', NULL, 0.06, NULL, true),
    (v_tenant_id, 'Margem comercial', 'percentual_sobre_total', NULL, 0.15, NULL, true),
    (v_tenant_id, 'Comissão vendedor', 'comissao_sobre_total', NULL, 0.05, NULL, true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Solar dimensioning seed data inserted for tenant %', v_tenant_id;
END $$;
