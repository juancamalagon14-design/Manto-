# Manto 2.0 — Manual Operativo y Guía de Despliegue a Producción
**Versión:** 2.0.0-PROD  
**Fecha:** Octubre 2026  
**Responsable:** `manto-tech-lead` (Staff Engineer & Technical Lead)  
**Revisión de Arquitectura:** `manto-software-architect`  
**Auditoría de Seguridad:** Obligatoria por `manto-qa-security`  
**Doctrinas:** Backend-First, Cero Placeholders, Ley 1801 (RCE 50 SMLMV), Ley 1581 (Habeas Data).

---

## 1. Resumen Ejecutivo y Topologías de Despliegue

El MVP de **Manto 2.0** se compone de una arquitectura desacoplada y robusta:
1. **Frontend:** Next.js 14 (App Router, Tailwind CSS, compilación *Standalone*, puerto interno 3002).
2. **Backend:** Monolito Modular NestJS 10 (Node.js 20 Alpine, DDD, motor actuarial determinista, puerto interno 3003).
3. **Persistencia:** PostgreSQL 16 con esquema `insurance`, migraciones transaccionales nativas y disparadores de integridad legal (Ley 1801 de 2016).
4. **Proxy Inverso & TLS:** Caddy 2.8 con certificados automáticos Let's Encrypt (TLS 1.3), cabeceras de endurecimiento OWASP y enrutamiento Layer 7.

Se han diseñado e implementado dos estrategias completas de despliegue para llevar el MVP a internet:
* **Opción 1: Despliegue PaaS Rápido (Vercel + Railway / Render)** — Menor fricción operativa, sin administración de servidores, ideal para validación inmediata y demos a inversionistas o aseguradora aliada.
* **Opción 2: Despliegue VPS Soberano (Hetzner / DigitalOcean + Docker Compose + Caddy)** — Soberanía total de datos, costo fijo predecible en euros/dólares, latencia ultrabaja y aislamiento de red nativo mediante `manto-net`.

---

## 2. Opción 1: Despliegue PaaS Rápido (Vercel + Railway / Render)

Esta opción desacopla la capa estática/edge en Vercel y aloja la API NestJS y PostgreSQL en Railway o Render.

```mermaid
flowchart LR
    User(["Cliente / Navegador"]) -->|HTTPS manto.com.co| Vercel["Vercel Edge Network (Next.js 14)"]
    Vercel -->|fetch /v1/*| Railway["Railway / Render (NestJS API :3003)"]
    Railway -->|TCP SSL :5432| PostgresManaged[("PostgreSQL 16 Managed")]
```

### 2.1 Despliegue de Base de Datos y Backend en Railway

#### Paso 1: Aprovisionar PostgreSQL 16 en Railway
1. Ingresar a [railway.app](https://railway.app) y crear un proyecto nuevo (`New Project`).
2. Seleccionar **Provision PostgreSQL**.
3. En la pestaña *Variables* del servicio Postgres, copiar la variable `DATABASE_URL` generada (formato: `postgresql://postgres:password@roundhouse.proxy.rlwy.net:PORT/railway`).
4. En *Settings*, configurar copias de seguridad automáticas (Backups diarios).

#### Paso 2: Desplegar el Backend en Railway
1. En el mismo proyecto de Railway, hacer clic en `+ New` -> **GitHub Repo** y seleccionar el repositorio `Manto 2.0`.
2. En la configuración del servicio, definir:
   - **Root Directory:** `/backend`
   - **Build Command:** `npm run build`
   - **Start Command:** `node dist/main.js` (o usar el `backend/Dockerfile` multi-stage automático).
3. En la pestaña **Variables**, configurar las variables de entorno de producción:

| Variable | Valor / Ejemplo | Propósito |
|---|---|---|
| `NODE_ENV` | `production` | Optimización de runtime NestJS |
| `PORT` | `3003` (o dejar que Railway asigne `$PORT`) | Puerto HTTP del backend |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Conexión directa a la BD provisionada |
| `DATABASE_SSL` | `true` | Exigido por conexiones gestionadas en la nube |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` | Acepta certificados de proxy en nube |
| `DATABASE_POOL_MAX` | `20` | Tamaño del pool de conexiones `pg` |
| `JWT_SECRET` | *(Generar 64 caracteres aleatorios)* | Firma criptográfica de tokens de sesión |
| `MERCADOPAGO_ACCESS_TOKEN` | `APP_USR-...` | Token de producción o sandbox MercadoPago |
| `GEMINI_API_KEY` | `AIzaSy...` | API Key de Google Cloud Vertex / AI Studio |

> [!IMPORTANT]
> El backend ejecutará automáticamente las migraciones SQL al arrancar (incluyendo `001_esquema_inicial.sql`) dentro de una transacción en el esquema `insurance`. Verificar en los logs de Railway el mensaje: `Conectado a PostgreSQL (esquema insurance)`.

4. En **Settings** -> **Networking**, generar un dominio público para el backend (ej: `manto-backend-production.up.railway.app`).
5. Configurar el Healthcheck probe:
   - **Healthcheck Path:** `/health`
   - **Healthcheck Timeout:** `10` segundos.

---

### 2.2 Despliegue del Frontend en Vercel

#### Paso 1: Importar Repositorio en Vercel
1. Ingresar a [vercel.com](https://vercel.com) y hacer clic en **Add New...** -> **Project**.
2. Conectar la cuenta de GitHub y seleccionar el repositorio `Manto 2.0`.
3. En la configuración del proyecto:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

#### Paso 2: Configurar Variables de Entorno en Vercel Dashboard
En la sección **Environment Variables**, definir:

| Variable | Valor | Ámbito |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `https://manto-backend-production.up.railway.app` | Production, Preview, Development |
| `NEXT_PUBLIC_API_URL` | `https://manto-backend-production.up.railway.app/v1` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_ENV` | `production` | Production |

> [!NOTE]
> Al estar desacoplado en Vercel, el cliente web invocará directamente la URL del backend en Railway. El backend NestJS ya tiene configurado `cors({ origin: true, credentials: true })` en [`backend/src/main.ts`](file:///e:/Manto%202.0/backend/src/main.ts#L36-L39), permitiendo la comunicación sin bloqueos de navegador.

#### Paso 3: Asignar Dominio Personalizado en Vercel
1. Ir a **Settings** -> **Domains**.
2. Añadir `manto.com.co` y `www.manto.com.co`.
3. Configurar en el proveedor de DNS:
   - Tipo `A`: `@` -> `76.76.21.21` (IP de Vercel)
   - Tipo `CNAME`: `www` -> `cname.vercel-dns.com`

---

## 3. Opción 2: Despliegue VPS Soberano (Ubuntu 24.04 LTS + Docker Compose + Caddy)

Esta opción es la recomendada para cumplimiento estricto de **Soberanía de Datos (Ley 1581)**, aislamiento de red local y costos de infraestructura fijos y predecibles.

```mermaid
flowchart TD
    Internet(["Tráfico de Internet"]) -->|Puertos 80 / 443 / UDP 443 QUIC| CaddyProxy["Caddy 2.8 Reverse Proxy (Auto TLS Let's Encrypt)"]
    
    subgraph DockerBridge ["Red Aislada: manto-net"]
        CaddyProxy -->|/v1/*, /api/*, /health| Backend["manto-backend (:3003)"]
        CaddyProxy -->|/* (Next.js Standalone)| Frontend["manto-frontend (:3002)"]
        Backend -->|TCP :5432| Postgres[("manto-postgres (PostgreSQL 16)")]
    end
    
    subgraph Storage ["Volúmenes Persistentes"]
        Postgres -.-> VolPG["manto_postgres_data"]
        CaddyProxy -.-> VolCaddyData["caddy_data (Certificados SSL)"]
        CaddyProxy -.-> VolCaddyConf["caddy_config"]
    end
```

### 3.1 Aprovisionamiento del Servidor VPS (Hetzner Cloud o DigitalOcean)

**Especificaciones Mínimas Recomendadas:**
* **Proveedor:** Hetzner Cloud (Instancia **CX22** o **CPX21**) o DigitalOcean Droplet (**Basic 2 vCPU, 4GB RAM**).
* **Sistema Operativo:** Ubuntu 24.04 LTS x64 (Noble Numbat).
* **Ubicación:** Ashburn / Virginia (US East) o Frankfurt (EU) para menor latencia con APIs internacionales (Gemini, MercadoPago).

#### Paso 1: Conexión SSH Inicial y Actualización del Sistema
Conectarse al servidor mediante la terminal de comandos:
```bash
ssh root@<IP_DEL_VPS>
```

Actualizar repositorios y paquetes base:
```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git ufw htop fail2ban ca-certificates gnupg lsb-release
```

#### Paso 2: Endurecimiento de Seguridad y Firewall (UFW)
Configurar el firewall del sistema operativo para abrir únicamente los puertos necesarios:
```bash
# Reglas por defecto
ufw default deny incoming
ufw default allow outgoing

# Puerto SSH (22)
ufw allow 22/tcp comment 'SSH'

# Puertos Web para Caddy (80 HTTP, 443 HTTPS TCP y UDP para HTTP/3 QUIC)
ufw allow 80/tcp comment 'Caddy HTTP'
ufw allow 443/tcp comment 'Caddy HTTPS'
ufw allow 443/udp comment 'Caddy HTTP3-QUIC'

# Activar firewall
ufw --force enable
ufw status verbose
```

#### Paso 3: Instalación Oficial de Docker Engine y Docker Compose v2
Instalar el motor Docker oficial (evitar versiones obsoletas de apt):
```bash
# Crear directorio de llaves
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Añadir repositorio oficial
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verificar versiones instaladas
docker --version
docker compose version
```

---

### 3.2 Clonado del Repositorio y Configuración del Entorno

#### Paso 1: Crear Usuario de Despliegue sin Privilegios de Root
```bash
adduser --disabled-password --gecos "" manto
usermod -aG docker manto
mkdir -p /opt/manto
chown -R manto:manto /opt/manto
```

#### Paso 2: Clonar el Repositorio de Manto 2.0
Iniciar sesión con el usuario `manto`:
```bash
su - manto
cd /opt/manto
git clone https://github.com/tu-organizacion/manto-2.0.git .
```

#### Paso 3: Generar Secretos Criptográficos y Configurar `.env`
Generar claves aleatorias de alta entropía para la base de datos y JWT:
```bash
DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
JWT_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
```

Crear el archivo `.env` de producción en `/opt/manto/.env` basado en la plantilla:
```bash
cat <<EOF > /opt/manto/.env
# ==============================================================================
# Manto 2.0 - Variables de Entorno de Producción
# ==============================================================================

# Dominio y Certificados Caddy
DOMAIN_NAME=manto.com.co
ACME_EMAIL=operaciones@manto.com.co

# Base de Datos PostgreSQL 16
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=manto_app
DATABASE_PASSWORD=${DB_PASS}
DATABASE_NAME=manto_db
DATABASE_POOL_MAX=20

# Backend NestJS
PORT=3003
JWT_SECRET=${JWT_KEY}
MERCADOPAGO_ACCESS_TOKEN=APP_USR-tu-token-de-produccion
GEMINI_API_KEY=AIzaSyTuClaveDeGeminiEnProduccion

# Frontend Next.js 14
# Dejar NEXT_PUBLIC_BACKEND_URL vacío en despliegue con Caddy (reverse proxy local)
NEXT_PUBLIC_BACKEND_URL=
NEXT_PUBLIC_API_URL=https://manto.com.co/v1
NEXT_PUBLIC_APP_ENV=production
EOF

chmod 600 /opt/manto/.env
```

---

### 3.3 Configuración de DNS

Antes de iniciar Caddy, configurar los registros DNS en el proveedor de dominio (Cloudflare, GoDaddy, Namecheap o Mi.com.co):

| Tipo | Nombre | Valor | TTL | Proxy / CDN |
|---|---|---|---|---|
| **A** | `@` (o `manto.com.co`) | `<IP_PUBLICA_DEL_VPS>` | 300 (Automático) | Solo DNS (Gris en Cloudflare) |
| **A** | `api` (opcional si subdominio) | `<IP_PUBLICA_DEL_VPS>` | 300 | Solo DNS |
| **CNAME** | `www` | `manto.com.co` | 300 | Solo DNS |

> [!CAUTION]
> Si se utiliza Cloudflare, asegurarse de desactivar el proxy naranja inicialmente (modo *DNS Only*). Esto permite que el desafío HTTP-01 / TLS-ALPN-01 de Let's Encrypt ejecutado por Caddy valide directamente contra el servidor sin interferencias de certificados intermedios.

---

### 3.4 Construcción y Despliegue de los Contenedores

Ejecutar la verificación previa al despliegue:
```bash
node scripts/verify-pre-deploy.mjs
```

Construir y levantar la pila completa en modo demonio (`daemon`):
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

#### Monitoreo y Verificación de Arranque:
```bash
# Ver estado de salud de todos los contenedores
docker compose -f docker-compose.prod.yml ps

# Salida esperada:
# NAME             IMAGE                 STATUS                    PORTS
# manto-postgres   postgres:16-alpine    Up (healthy)             5432/tcp
# manto-backend    manto-production-backend Up (healthy)          3003/tcp
# manto-frontend   manto-production-frontend Up (healthy)         3002/tcp
# manto-proxy      caddy:2.8-alpine      Up (healthy)             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp, 0.0.0.0:443->443/udp
```

Inspeccionar logs de inicialización y migraciones:
```bash
# Logs del backend comprobando migraciones de PostgreSQL
docker compose -f docker-compose.prod.yml logs -f backend

# Logs de Caddy confirmando emisión de certificado SSL Let's Encrypt
docker compose -f docker-compose.prod.yml logs -f caddy
```

---

### 3.5 Verificación Funcional y Healthchecks en Producción

Probar endpoints públicos desde cualquier terminal externa:

1. **Healthcheck del Backend (vía Caddy Reverse Proxy):**
```bash
curl -i https://manto.com.co/health
```
*Respuesta esperada (HTTP 200 OK):*
```json
{
  "status": "ok",
  "timestamp": "2026-10-14T22:45:00.000Z",
  "uptimeSeconds": 45,
  "environment": "production",
  "database": {
    "status": "connected",
    "latencyMs": 2,
    "pool": { "total": 5, "idle": 5, "waiting": 0 }
  },
  "service": "manto-backend",
  "version": "2.0.0"
}
```

2. **Carga del Frontend Next.js:**
```bash
curl -I https://manto.com.co/
```
*Respuesta esperada (HTTP 200 OK con cabeceras de seguridad HSTS y CSP):*
```http
HTTP/2 200
server: Caddy
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
content-security-policy: default-src 'self'; ...
```

3. **Verificación del Motor Tarifario Determinista:**
```bash
curl -X GET https://manto.com.co/v1/pricing/breeds
```
*Respuesta esperada:* Catálogo actuarial completo de razas con 200 OK.

---

### 3.6 Automatización de Copias de Seguridad de PostgreSQL

Configurar una tarea cron en el host para respaldar la base de datos diariamente en un archivo comprimido y rotar copias mayores a 14 días:

Crear el script de respaldo en `/opt/manto/backup-db.sh`:
```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/manto/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/manto_db_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# Ejecutar pg_dump dentro del contenedor
docker exec -t manto-postgres pg_dump -U manto_app -d manto_db | gzip > "$FILENAME"
chmod 600 "$FILENAME"

# Rotación: eliminar respaldos con más de 14 días
find "$BACKUP_DIR" -type f -name "manto_db_*.sql.gz" -mtime +14 -delete

echo "[$(date)] Backup exitoso: $FILENAME"
```

Hacer ejecutable y programar en `crontab -e`:
```bash
chmod +x /opt/manto/backup-db.sh

# Ejecutar todos los días a las 02:00 AM hora de Colombia (UTC-5 -> 07:00 UTC)
0 7 * * * /opt/manto/backup-db.sh >> /var/log/manto-backup.log 2>&1
```

---

## 4. Presupuesto Mensual Detallado (USD y COP — TRM ~$4.000 COP/USD)

A continuación se desglosan los costos reales calculados para el MVP y primeros 6 meses de operación.

### Alternativa 1: PaaS Rápido (Vercel + Railway / Render)

| Componente | Proveedor / Nivel | Costo Mensual (USD) | Costo Mensual (COP) | Notas |
|---|---|---|---|---|
| **Frontend Next.js** | Vercel Pro Plan (o Hobby inicial) | $20,00 USD | $80.000 COP | Incluye CDN global, analíticas y deployments ilimitados |
| **Backend NestJS** | Railway Team/Developer Plan | $10,00 USD | $40.000 COP | 1 vCPU, 2GB RAM escalable |
| **PostgreSQL 16** | Railway Managed Postgres (10GB) | $10,00 USD | $40.000 COP | Backups automáticos y métricas |
| **Dominio `.com.co`** | Mi.com.co / GoDaddy | $2,50 USD | $10.000 COP | ~$120.000 COP anual prorrateado |
| **IA Gemini 1.5 Flash** | Google Cloud Vertex / AI Studio | $5,00 USD | $20.000 COP | ~10.000 fotos analizadas al mes |
| **TOTAL MENSUAL PAAS** | | **$47,50 USD** | **$190.000 COP** | *Cero mantenimiento de servidores* |

---

### Alternativa 2: VPS Soberano (Hetzner Cloud + Docker Compose) ⭐ *Opción Más Eficiente*

| Componente | Proveedor / Nivel | Costo Mensual (USD) | Costo Mensual (COP) | Notas |
|---|---|---|---|---|
| **Servidor VPS CX22** | Hetzner Cloud (2 vCPU AMD, 4GB RAM, 40GB NVMe, 20TB Tráfico) | €3,99 EUR (~$4,40 USD) | $17.600 COP | Ejecuta PostgreSQL, Backend, Frontend y Caddy en el mismo nodo |
| **IP Pública IPv4** | Hetzner Cloud | €0,60 EUR (~$0,66 USD) | $2.640 COP | Dirección fija para registros DNS |
| **Backups Automáticos** | Hetzner Cloud Backups (20% del servidor) | €0,80 EUR (~$0,88 USD) | $3.520 COP | Snapshots automáticos del disco |
| **Certificados SSL** | Let's Encrypt vía Caddy | $0,00 USD | $0 COP | Auto-renovable de por vida |
| **Dominio `.com.co`** | Mi.com.co / GoDaddy | $2,50 USD | $10.000 COP | ~$120.000 COP anual prorrateado |
| **IA Gemini 1.5 Flash** | Google Cloud Vertex / AI Studio | $5,00 USD | $20.000 COP | Consumo variable según tráfico |
| **TOTAL MENSUAL VPS** | | **$13,44 USD** | **$53.760 COP** | *Ahorro del 72% frente a PaaS* |

---

### Comparativa Estratégica

```mermaid
pie title Comparativa de Presupuesto Mensual (COP)
    "VPS Hetzner Soberano ($53.760 COP)" : 53760
    "Diferencia Ahorrada ($136.240 COP)" : 136240
```

| Criterio | Opción 1: PaaS (Vercel + Railway) | Opción 2: VPS Soberano (Hetzner + Compose) |
|---|---|---|
| **Costo Mensual** | ~$190.000 COP / mes | **~$53.760 COP / mes** |
| **Curva de Aprendizaje** | Muy baja (UI Web) | Media (Línea de comandos Linux) |
| **Aislamiento de Red** | Red pública con SSL | **Red privada Docker `manto-net`** |
| **Soberanía Ley 1581** | Datos en nubes multi-tenant | **Control total del host y disco cifrado** |
| **Escalabilidad MVP** | Alta de inmediato | Óptima hasta ~100.000 cotizaciones/mes |

---

## 5. Procedimientos de Actualización Continua y Rollback

### Actualización sin Caída (Zero-Downtime Re-deploy):
Cuando se publiquen cambios en la rama `main`:
```bash
cd /opt/manto
git pull origin main

# Validar integridad
node scripts/verify-pre-deploy.mjs

# Reconstruir imágenes y reemplazar contenedores en caliente
docker compose -f docker-compose.prod.yml up -d --build --no-deps backend frontend

# Limpieza de imágenes dangling
docker image prune -f
```

### Procedimiento de Rollback Inmediato:
En caso de un error crítico en producción:
```bash
# 1. Regresar al commit estable anterior en Git
git reset --hard <COMMIT_SHA_ANTERIOR>

# 2. Reconstruir y reiniciar inmediatamente
docker compose -f docker-compose.prod.yml up -d --build

# 3. Si la base de datos sufrió cambios no deseados, restaurar backup:
gunzip -c /opt/manto/backups/manto_db_YYYYMMDD_HHMMSS.sql.gz | docker exec -i manto-postgres psql -U manto_app -d manto_db
```

---

## 6. Estado de Auditoría y Hand-off a QA

* **Placeholders en código crítico:** 0 detectados. Las variables requeridas en `.env` usan guardas estrictas `${VAR:?error}`.
* **Multi-stage Builds:** Optimizados con Alpine, usuario sin privilegios (`node` UID 1000 y `nextjs` UID 1001).
* **Base de Datos:** Migración `001_esquema_inicial.sql` probada con triggers de Ley 1801 y tipos de moneda en enteros `bigint`.
* **Script de Verificación:** Disponible en `scripts/verify-pre-deploy.mjs`.

El sistema se declara **APTO PARA AUDITORÍA DE SEGURIDAD** y se transfiere formalmente a `manto-qa-security`.
