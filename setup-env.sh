#!/usr/bin/env bash
# Script de deploy para VPS.
# O arquivo .env deve existir em um nível acima do diretório do projeto:
#
#   /srv/
#   ├── .env          ← arquivo com as variáveis sensíveis (fora do git)
#   └── casa-app/     ← diretório do projeto (este repositório)
#
# O composer install copia ../.env automaticamente durante a instalação.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT_ENV="${APP_DIR}/../.env"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

cd "$APP_DIR"

# ── Pré-requisito: .env no diretório pai ──────────────────────────────────────
if [ ! -f "$PARENT_ENV" ]; then
    echo -e "${RED}Erro: arquivo .env não encontrado em ${PARENT_ENV}${NC}"
    echo
    echo "Crie o arquivo antes de continuar. Exemplo mínimo:"
    echo
    cat <<'EXAMPLE'
APP_NAME="CasaApp"
APP_ENV=production
APP_KEY=          # será gerado pelo artisan key:generate
APP_DEBUG=false
APP_URL=https://meudominio.com

APP_LOCALE=pt_BR
APP_FALLBACK_LOCALE=pt_BR

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=casa_app
DB_USERNAME=casa_user
DB_PASSWORD=senha_segura_aqui
DB_ROOT_PASSWORD=senha_root_aqui

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=database

MAIL_MAILER=smtp
MAIL_HOST=smtp.exemplo.com
MAIL_PORT=587
MAIL_USERNAME=user@exemplo.com
MAIL_PASSWORD=senha_mail_aqui
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="no-reply@meudominio.com"
MAIL_FROM_NAME="CasaApp"

VITE_APP_NAME="CasaApp"
EXAMPLE
    exit 1
fi

echo -e "${GREEN}=== Deploy casa-app ===${NC}"
echo "Usando .env de: ${PARENT_ENV}"
echo

# ── Build e inicialização ─────────────────────────────────────────────────────
echo "→ Construindo imagens Docker..."
docker compose build

echo "→ Subindo containers..."
docker compose up -d

echo "→ Aguardando banco de dados..."
docker compose exec app sh -c "until php artisan db:monitor 2>/dev/null; do sleep 2; done" 2>/dev/null || sleep 10

echo "→ Rodando migrations..."
docker compose exec app php artisan migrate --force

echo "→ Criando link de storage..."
docker compose exec app php artisan storage:link

echo "→ Otimizando..."
docker compose exec app php artisan optimize

echo -e "\n${GREEN}✓ Deploy concluído!${NC}"
echo "Acesse: $(grep APP_URL "${APP_DIR}/.env" 2>/dev/null | cut -d= -f2 || echo 'http://localhost')"
