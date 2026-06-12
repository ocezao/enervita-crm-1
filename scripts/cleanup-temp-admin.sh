#!/usr/bin/env bash
set -Eeuo pipefail

# Limpeza segura de admin temporário no banco público do CRM Enervita.
# Feito para evitar o erro de limpar o usuário no banco preview em vez do banco público.

PUBLIC_DB_CONTAINER="${PUBLIC_DB_CONTAINER:-enervita-postgres}"
PUBLIC_DB_NAME="${PUBLIC_DB_NAME:-enervita_crm}"
PUBLIC_DB_USER="${PUBLIC_DB_USER:-enervita}"
DRY_RUN=0
FORCE=0
EMAIL=""

usage() {
  cat <<'USAGE'
Uso:
  scripts/cleanup-temp-admin.sh --email EMAIL [--dry-run] [--force]

Regras de segurança:
  - Só aceita emails de admin temporário Hermes: hermes-*@cesarmachado.local
  - Usa explicitamente o banco público: enervita-postgres/enervita_crm
  - Remove user_roles, user_permissions, user_stage_permissions e users
  - Sem --force, pede confirmação interativa quando terminal permite

Variáveis opcionais:
  PUBLIC_DB_CONTAINER=enervita-postgres
  PUBLIC_DB_NAME=enervita_crm
  PUBLIC_DB_USER=enervita
USAGE
}

log() { printf '[cleanup-temp-admin] %s\n' "$*"; }
fail() { printf '[cleanup-temp-admin] ERRO: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      shift
      EMAIL="${1:-}"
      ;;
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "argumento desconhecido: $1" ;;
  esac
  shift
done

[[ -n "$EMAIL" ]] || fail "informe --email"
case "$EMAIL" in
  hermes-*@cesarmachado.local) ;;
  *) fail "por segurança, este script só remove emails hermes-*@cesarmachado.local" ;;
esac

command -v docker >/dev/null || fail "docker não encontrado"
docker inspect "$PUBLIC_DB_CONTAINER" >/dev/null 2>&1 || fail "container de banco público não encontrado: $PUBLIC_DB_CONTAINER"
state="$(docker inspect -f '{{.State.Running}}' "$PUBLIC_DB_CONTAINER")"
[[ "$state" == "true" ]] || fail "container de banco público não está rodando: $PUBLIC_DB_CONTAINER"

psql_base=(docker exec -i "$PUBLIC_DB_CONTAINER" psql -U "$PUBLIC_DB_USER" -d "$PUBLIC_DB_NAME" -v ON_ERROR_STOP=1 -P pager=off)

log "alvo: container=$PUBLIC_DB_CONTAINER database=$PUBLIC_DB_NAME user=$PUBLIC_DB_USER email=$EMAIL"

lookup_sql="select id::text, email, name, status, created_at from users where email = :'email';"
lookup_output="$(printf "\\set email '%s'\n%s\n" "$EMAIL" "$lookup_sql" | "${psql_base[@]}" -At)"

if [[ -z "$lookup_output" ]]; then
  log "nenhum usuário encontrado; nada para remover"
  exit 0
fi

log "usuário encontrado: $(printf '%s' "$lookup_output" | cut -d'|' -f1-4)"

role_count="$(printf "\\set email '%s'\nselect count(*) from user_roles where user_id in (select id from users where email = :'email');\n" "$EMAIL" | "${psql_base[@]}" -At)"
perm_count="$(printf "\\set email '%s'\nselect count(*) from user_permissions where user_id in (select id from users where email = :'email');\n" "$EMAIL" | "${psql_base[@]}" -At)"
stage_count="$(printf "\\set email '%s'\nselect count(*) from user_stage_permissions where user_id in (select id from users where email = :'email');\n" "$EMAIL" | "${psql_base[@]}" -At)"
log "relacionados: roles=$role_count permissions=$perm_count stage_permissions=$stage_count"

if [[ "$DRY_RUN" == "1" ]]; then
  log "dry-run: nenhuma alteração aplicada"
  exit 0
fi

if [[ "$FORCE" != "1" && -t 0 ]]; then
  printf 'Digite REMOVER para confirmar a exclusão de %s: ' "$EMAIL" >&2
  read -r confirmation
  [[ "$confirmation" == "REMOVER" ]] || fail "confirmação inválida; abortado"
elif [[ "$FORCE" != "1" ]]; then
  fail "sem TTY para confirmação; use --force em automação"
fi

cleanup_sql="
begin;
delete from user_permissions where user_id in (select id from users where email = :'email');
delete from user_stage_permissions where user_id in (select id from users where email = :'email');
delete from user_roles where user_id in (select id from users where email = :'email');
delete from users where email = :'email';
commit;
select count(*) as remaining_users from users where email = :'email';
"
printf "\\set email '%s'\n%s\n" "$EMAIL" "$cleanup_sql" | "${psql_base[@]}"

remaining="$(printf "\\set email '%s'\nselect count(*) from users where email = :'email';\n" "$EMAIL" | "${psql_base[@]}" -At)"
[[ "$remaining" == "0" ]] || fail "limpeza incompleta: remaining_users=$remaining"
log "limpeza concluída: remaining_users=0"
