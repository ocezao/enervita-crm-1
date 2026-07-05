#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

const csvPath = process.argv[2];
const tenantArg = process.argv[3];

const stateToUf = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPÁ: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARÁ: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPÍRITO SANTO': 'ES',
  GOIÁS: 'GO',
  MARANHÃO: 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARÁ: 'PA',
  PARAÍBA: 'PB',
  PARANÁ: 'PR',
  PERNAMBUCO: 'PE',
  PIAUÍ: 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDÔNIA: 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SÃO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
};

function parseCsvLine(line) {
  return line.replace(/\r$/, '').split(';');
}

function number(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

async function resolveTenantId(client) {
  if (tenantArg) return tenantArg;
  const result = await client.query("select id from tenants where status = 'active' order by created_at limit 1");
  const id = result.rows[0]?.id;
  if (!id) throw new Error('No active tenant found. Pass tenant id as third argument.');
  return id;
}

async function main() {
  if (!csvPath) {
    throw new Error('Usage: node infra/scripts/import-atlas-irradiacao.cjs <tilted_latitude_means_sedes-munic.csv> [tenant_id]');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const tenantId = await resolveTenantId(client);

  const stream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let headers = null;
  let imported = 0;
  let skipped = 0;

  await client.query('begin');
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      const columns = parseCsvLine(line);
      if (!headers) {
        headers = columns.map((column) => column.trim());
        continue;
      }
      const row = Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? '']));
      const estadoNome = String(row.STATE || '').trim().toUpperCase();
      const uf = stateToUf[estadoNome];
      const cidade = String(row.NAME || '').trim();
      const annualWh = number(row.ANNUAL);
      if (!uf || !cidade || !annualWh) {
        skipped += 1;
        continue;
      }
      await client.query(
        `insert into irradiacao_cidades (
           tenant_id, cidade, uf, codigo_ibge, lat, lon, classe, estado_nome, fonte_id,
           irradiacao_kwh_m2_dia, fonte, ativo
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, round(($10::numeric / 1000), 3), $11, true)
         on conflict (tenant_id, cidade, uf) do update set
           codigo_ibge = excluded.codigo_ibge,
           lat = excluded.lat,
           lon = excluded.lon,
           classe = excluded.classe,
           estado_nome = excluded.estado_nome,
           fonte_id = excluded.fonte_id,
           irradiacao_kwh_m2_dia = excluded.irradiacao_kwh_m2_dia,
           fonte = excluded.fonte,
           ativo = true,
           updated_at = now()`,
        [
          tenantId,
          cidade,
          uf,
          row.ID || null,
          number(row.LAT),
          number(row.LON),
          row.CLASS || null,
          estadoNome,
          'atlas_solar_2017_tilted_latitude_sedes_munic',
          annualWh,
          'LABREN/CCST/INPE Atlas Brasileiro de Energia Solar 2017 - Plano inclinado',
        ],
      );
      imported += 1;
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }

  console.log(JSON.stringify({ tenantId, imported, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
