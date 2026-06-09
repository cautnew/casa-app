# ─── Stage 1: build front-end assets ────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: install PHP dependencies (sem devDependencies) ─────────────────
FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock .env.example ./
# Durante o build não há ../.env; copia o example para que hooks do composer
# (php artisan package:discover) não falhem. O .env real vem do docker-compose.
RUN cp .env.example .env && \
    composer install \
        --no-dev \
        --optimize-autoloader \
        --no-interaction \
        --prefer-dist

# ─── Stage 3: imagem de produção ─────────────────────────────────────────────
FROM php:8.3-fpm-alpine AS production

# Dependências do sistema + extensões PHP
RUN apk add --no-cache \
        nginx \
        supervisor \
        libpng-dev \
        libzip-dev \
        oniguruma-dev \
        icu-dev \
        libxml2-dev \
    && docker-php-ext-install \
        pdo_mysql \
        mbstring \
        zip \
        gd \
        intl \
        opcache \
        bcmath

# Configurações PHP para produção
COPY docker/php.ini /usr/local/etc/php/conf.d/app.ini

# Nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Supervisor (gerencia nginx + php-fpm + queue worker)
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /var/www/html

# Copia dependências e código
COPY --from=vendor /app/vendor ./vendor
COPY --from=frontend /app/public/build ./public/build
COPY . .

# Remove arquivos que não devem ir para produção
RUN rm -rf .ddev docker node_modules tests

# Permissões
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 80

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
