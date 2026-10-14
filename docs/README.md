# Centro Maestro de Documentación y Gobernanza por Agentes (Manto 2.0)

> [!IMPORTANT]
> **Lectura Obligatoria en Primera Instancia:** Antes de cualquier tarea de desarrollo, diseño o arquitectura, consulta las **[`Reglas Maestras de Orquestación y Gobernanza por Agentes`](file:///e:/Manto%202.0/docs/REGLAS_ORQUESTACION_AGENTES.md)** para identificar el agente titular, límites de autonomía y doctrinas inquebrantables.

Toda la documentación especializada de la plataforma se encuentra centralizada dentro de la carpeta contenedora **[`/docs/agentes/`](file:///e:/Manto%202.0/docs/agentes/)**, organizada en **8 carpetas especializadas**:

```
docs/
├── README.md                              # [Este Índice Maestro de Navegación]
├── REGLAS_ORQUESTACION_AGENTES.md         # 🚨 [REGLAS MAESTRAS DE GOBERNANZA Y ORQUESTACIÓN (Lectura Obligatoria en Primera Instancia)]
│
└── agentes/                               # [CARPETA CONTENEDORA DE TODOS LOS AGENTES]
    │
    ├── claude-code/                       # [COPIA DE REFERENCIA DE LOS 9 AGENTES (.claude/agents)]
    │   ├── manto-orchestrator.md
    │   ├── manto-ux.md
    │   ├── manto-ux-research.md
    │   ├── manto-backend.md
    │   ├── manto-pricing.md
    │   ├── manto-ai.md
    │   ├── manto-claims.md
    │   ├── manto-qa-security.md
    │   └── manto-frontmatter.md
    │
    ├── orchestrator/                      # [AGENTE 1: CTO / PRINCIPAL ARCHITECT (ORQUESTADOR)]
    │   ├── ARCHITECTURE.md                # Arquitectura global, monolito modular NestJS, DDD
    │   ├── DOMAINS_SPEC.md                # ESPECIFICACIÓN CANÓNICA DE LOS 19 DOMINIOS DEL SISTEMA
    │   ├── PRODUCT_SPEC.md                # Visión de producto, contexto Colombia y multi-ramo
    │   ├── DATABASE.md                    # Esquemas relacionales PostgreSQL 16, DDL, UUIDv7
    │   ├── API_SPEC.md                    # Especificación RESTful OpenAPI 3.1, RFC 7807, Auth JWT
    │   ├── SECURITY.md                    # Seguridad STRIDE, RBAC, ClamAV y Habeas Data Ley 1581
    │   ├── DECISIONS.md                   # Registro formal de 8 ADRs arquitectónicos
    │   ├── DEVELOPMENT_GUIDELINES.md      # Protocolo inter-agentes, DoD y estándares TypeScript
    │   ├── CLAIMS_SPEC.md                 # Máquina de estados FNOL, STP hasta COP $500.000
    │   ├── INSURANCE_RULES.md             # Reglas maestras de suscripción
    │   └── AI_SPEC.md                     # Directrices maestras de IA
    │
    ├── ux/                                # [AGENTE 2: SENIOR PRODUCT DESIGNER + UX ARCHITECT]
    │   ├── UX_PRINCIPLES.md               # Filosofía mobile-first, justificación de preguntas
    │   ├── USER_FLOWS.md                  # Viajes de usuario y catálogo de las 14 pantallas MVP
    │   ├── QUOTE_FLOW.md                  # Flujo de cotización <60 segundos desglosado al segundo
    │   ├── DESIGN_SYSTEM.md               # Sistema Manto Sanctuary: paleta, tipografía, a11y
    │   └── UX_COPY.md                     # Tono de voz colombiano, glosario desmitificado y micro-copia
    │
    ├── backend/                           # [AGENTE 3: SENIOR BACKEND ENGINEER]
    │   ├── BACKEND_SPEC.md                # Arquitectura técnica NestJS, principios y patrones
    │   └── DOMAIN_MAPPING.md              # Mapeo exhaustivo de los 19 módulos en NestJS
    │
    ├── pricing-engine/                    # [AGENTE 4: INSURANCE PRODUCT + PRICING ENGINEER]
    │   └── PRICING_ENGINE.md              # Contratos TypeScript, fórmulas actuariales, Ley 1801 RCE y siniestros
    │
    ├── ai/                                # [AGENTE 5: SENIOR AI & COMPUTER VISION ENGINEER]
    │   └── AI_VISION_SPEC.md              # Pipeline de visión en 8 etapas, IVisionProvider y fallback de 3s
    │
    ├── claims/                            # [AGENTE 6: SENIOR CLAIMS AUTOMATION ENGINEER]
    │   └── CLAIMS_SPEC.md                 # Pipeline de siniestros, OCR DIAN CUFE, STP <= $500k y pagos ACH
    │
    └── qa-security/                       # [AGENTE 7: PRINCIPAL QA + SECURITY ENGINEER]
        ├── QA_REPORT.md                   # Análisis implacable de 8 fallos críticos y remediaciones
        ├── SECURITY_REPORT.md             # Evaluación OWASP Top 10 API, prevención BOLA y malware
        └── TEST_MATRIX.md                 # Pirámide de pruebas (Unitarias, Integración, API, E2E)
```

---

## Mapeo Directo a Agentes del Proyecto

1. 🏛️ **[`manto-orchestrator`](file:///e:/Manto%202.0/.claude/agents/manto-orchestrator.md)** (Agente 1 - CTO / Orquestador) — Doc: [`docs/agentes/orchestrator/`](file:///e:/Manto%202.0/docs/agentes/orchestrator/)
2. 🎨 **[`manto-ux`](file:///e:/Manto%202.0/.claude/agents/manto-ux.md)** (Agente 2 - Senior Product Designer + UI) — Doc: [`docs/agentes/ux/`](file:///e:/Manto%202.0/docs/agentes/ux/)
3. 🔍 **[`manto-ux-research`](file:///e:/Manto%202.0/.claude/agents/manto-ux-research.md)** (Agente Especializado - Benchmark & Competitive Intelligence)
4. ⚙️ **[`manto-backend`](file:///e:/Manto%202.0/.claude/agents/manto-backend.md)** (Agente 3 - Senior Backend Engineer) — Doc: [`docs/agentes/backend/`](file:///e:/Manto%202.0/docs/agentes/backend/)
5. 🔢 **[`manto-pricing`](file:///e:/Manto%202.0/.claude/agents/manto-pricing.md)** (Agente 4 - Insurance Product + Pricing Engineer) — Doc: [`docs/agentes/pricing-engine/`](file:///e:/Manto%202.0/docs/agentes/pricing-engine/)
6. 🤖 **[`manto-ai`](file:///e:/Manto%202.0/.claude/agents/manto-ai.md)** (Agente 5 - Senior AI & Vision Engineer) — Doc: [`docs/agentes/ai/`](file:///e:/Manto%202.0/docs/agentes/ai/)
7. 🩺 **[`manto-claims`](file:///e:/Manto%202.0/.claude/agents/manto-claims.md)** (Agente 6 - Senior Claims Automation Engineer) — Doc: [`docs/agentes/claims/`](file:///e:/Manto%202.0/docs/agentes/claims/)
8. 🛡️ **[`manto-qa-security`](file:///e:/Manto%202.0/.claude/agents/manto-qa-security.md)** (Agente 7 - Principal QA + Security Engineer) — Doc: [`docs/agentes/qa-security/`](file:///e:/Manto%202.0/docs/agentes/qa-security/)
9. 📝 **[`manto-frontmatter`](file:///e:/Manto%202.0/.claude/agents/manto-frontmatter.md)** (Agente de Gobernanza y Mantenimiento de Agentes)

