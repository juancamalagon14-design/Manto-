# Manto 2.0 🐾 ⚡
### Plataforma Insurtech Colombiana de Seguros para Mascotas

Plataforma integral de aseguramiento de mascotas (caninos y felinos) en Colombia con cotización instantánea, motor actuarial determinista ajustado a la **Ley 1801 de 2016** (50 SMLMV obligatorios para razas de manejo especial), y liquidación automatizada de siniestros (STP) en segundos con desembolsos vía **Bre-B**.

---

## 🌟 Componentes Principales

| Componente | Agente Digital / Módulo | Descripción |
| :--- | :--- | :--- |
| **Cotización y Emisión** | **Nuquí 🐾** | Experiencia conversacional fluida en Next.js 14. Clasificación biológica y emisión en menos de 60 segundos. |
| **Siniestros y Reembolsos** | **Sué ⚡** | FNOL automatizado, validación de facturas electrónicas con CUFE ante la DIAN, y pagos STP ($\le \$500.000$ COP). |
| **Motor Actuarial** | **Pricing Engine** | Motor determinista del lado servidor. Cumplimiento estricto de RCE de 50 SMLMV ($87.545.250 COP en 2026). Dinero en COP (`ColombianPeso` entero / cero flotantes). |
| **Centro de Datos** | **PostgreSQL 16** | Persistencia relacional pura (`pg` nativo), triggers de validación normativa, esquemas auditables y cumplimiento Habeas Data (Ley 1581 de 2012). |

---

## 🚀 Arquitectura Tecnológica

- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, diseño accesible mobile-first (*Manto Sanctuary*).
- **Backend:** NestJS (TypeScript modular DDD), validación estricta con `class-validator`, contratos OpenAPI 3.1.
- **Base de Datos:** PostgreSQL 16 con DDL estructurado, UUIDv7 y triggers de ley.
- **Infraestructura:** Docker Compose, Caddy Reverse Proxy, SSL automatizado.
- **Calidad y Seguridad:** Suite integral con 180+ pruebas Jest automatizadas y auditoría de seguridad OWASP API Top 10.

---

## 🛠️ Guía Rápida de Ejecución

### Prerrequisitos
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (opcional si se usa Docker)

### 1. Levantar Infraestructura con Docker
```bash
docker compose up -d
```

### 2. Ejecutar el Backend (NestJS)
```bash
cd backend
npm install
npm run start:dev
```
*Para ejecutar las pruebas automatizadas:*
```bash
npm test
```

### 3. Ejecutar el Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📚 Documentación Técnica Detallada

Toda la documentación especializada, arquitectura de los 19 dominios y directrices actuariales se encuentran centralizadas en el directorio [`/docs`](./docs/README.md):

- 🏛️ [Arquitectura Global y Dominios DDD](./docs/agentes/orchestrator/ARCHITECTURE.md)
- 📊 [Motor de Tarifas y Cumplimiento Ley 1801](./docs/agentes/pricing-engine/PRICING_ENGINE.md)
- ⚡ [Pipeline de Siniestros y Reembolsos Sué](./docs/agentes/claims/CLAIMS_SPEC.md)
- 🎨 [Sistema de Diseño y Principios UX](./docs/agentes/ux/DESIGN_SYSTEM.md)
- 📋 [Catálogo de Razas Asegurables](./docs/CATALOGO_RAZAS_ASEGURABLES.md)

---
© 2026 Manto Seguros Colombia. Todos los derechos reservados.
