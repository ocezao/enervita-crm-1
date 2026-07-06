import pg from 'pg';
import { getDatabasePool } from '../../db/pool.ts';

const { Pool } = pg;

export type PipelineStage = {
  key: string;
  label: string;
  legacyStage: string;
  sortOrder: number;
  isTerminal: boolean;
};

export type LeadPipeline = {
  key: string;
  label: string;
  description: string | null;
  sortOrder: number;
  stages: PipelineStage[];
};

export type PipelinesRepository = {
  listPipelines(tenantId: string, userId: string, isAdmin: boolean): Promise<LeadPipeline[]>;
  close?(): Promise<void>;
};

export function createPgPipelinesRepository(databaseUrl?: string): PipelinesRepository {
  // Usa o pool singleton se databaseUrl não for fornecido (padrão)
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : getDatabasePool();

  return {
    async listPipelines(tenantId, userId, isAdmin) {
      const result = await pool.query(
        `select p.key,
                p.label,
                p.description,
                p.sort_order as "sortOrder",
                coalesce(jsonb_agg(
                  jsonb_build_object(
                    'key', s.key,
                    'label', s.label,
                    'legacyStage', s.legacy_stage::text,
                    'sortOrder', s.sort_order,
                    'isTerminal', s.is_terminal
                  )
                  order by s.sort_order asc
                ) filter (where s.key is not null), '[]'::jsonb) as stages
           from lead_pipelines p
           left join lead_pipeline_stages s on s.tenant_id = p.tenant_id and s.pipeline_key = p.key
          where p.tenant_id = $1
            and p.is_active = true
            and (
              $3::boolean = true
              or exists (
                select 1
                  from lead_pipeline_user_access access
                 where access.tenant_id = p.tenant_id
                   and access.pipeline_key = p.key
                   and access.user_id = $2::uuid
              )
            )
          group by p.key, p.label, p.description, p.sort_order
          order by p.sort_order asc, p.label asc`,
        [tenantId, userId, isAdmin],
      );

      return result.rows.map((row) => ({
        key: row.key as string,
        label: row.label as string,
        description: row.description as string | null,
        sortOrder: Number(row.sortOrder ?? 0),
        stages: (Array.isArray(row.stages) ? row.stages : []).map((stage: Record<string, unknown>) => ({
          key: String(stage.key ?? ''),
          label: String(stage.label ?? ''),
          legacyStage: String(stage.legacyStage ?? ''),
          sortOrder: Number(stage.sortOrder ?? 0),
          isTerminal: Boolean(stage.isTerminal),
        })),
      }));
    },
    async close() {
      // Apenas fecha o pool se ele foi criado localmente (não é o singleton)
      if (databaseUrl) {
        await pool.end();
      }
      // Se estiver usando o pool singleton, não fechamos aqui pois ele é compartilhado
    },
  };
}

export function createStaticPipelinesRepository(pipelines: LeadPipeline[] = []): PipelinesRepository {
  return {
    async listPipelines() {
      return pipelines;
    },
  };
}
