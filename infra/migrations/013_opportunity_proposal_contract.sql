-- P1.4 — vínculo oportunidade ↔ proposta/contrato

alter table lead_opportunities
  add column if not exists accepted_proposal_id uuid references proposals(id) on delete set null,
  add column if not exists accepted_at timestamptz;

create index if not exists lead_opportunities_accepted_proposal_idx
  on lead_opportunities (tenant_id, accepted_proposal_id)
  where accepted_proposal_id is not null;
