# Flujo Obligatorio y Automático de Despliegue de Subagentes — Manto 2.0

> [!CAUTION]
> **REGLA MANDATORIA DE AUTOMATIZACIÓN:**
> Ante cualquier requerimiento del usuario, el asistente principal **DEBE INVOCAR DE FORMA AUTOMÁTICA E INMEDIATA** al subagente `manto-orchestrator`.
> Está estrictamente prohibido esperar a que el usuario lo solicite.

---

## Fases de Ejecución Automática

### 1. Despliegue Inmediato de `manto-orchestrator`
- **Acción:** `invoke_subagent` convocando a `manto-orchestrator`.
- **Entregable Obligatorio:** Plan Estratégico de Implementación para todo el equipo, indicando:
  - Dominios impactados (19 dominios DDD de Manto 2.0).
  - Secuencia de construcción respetando el principio **Backend-First**.
  - Asignación de subagentes necesarios.
  - Matriz de pruebas y criterios de aceptación.

### 2. Diseño Contract-First (`manto-software-architect`)
- Invocado para definir modelos relacionales DDL PostgreSQL 16, contratos OpenAPI y especificaciones DTO.

### 3. Orquestación y Desglose Técnico (`manto-tech-lead`)
- Invocado para desglosar la solución en tareas atómicas y coordinar a los desarrolladores bajo el principio de Cero Placeholders.

### 4. Implementación por Subagentes de Dominio
- Despliegue de `manto-backend`, `manto-ux`, `manto-pricing`, `manto-claims` y/o `manto-ai` según el plan trazado.

### 5. Auditoría Obligatoria de Cierre (`manto-qa-security`)
- **Paso ineludible:** Todo cambio a archivos se audita con `manto-qa-security`.
- Ejecución de suites de prueba (`cd backend && npx jest`), revisión OWASP API y verificación de las doctrinas inquebrantables.
- Si hay defectos, se devuelven al agente autor; nunca se entrega al usuario con fallos.
