# Manto 2.0 — Reglas Obligatorias (MUST) y Flujo de Trabajo

> [!CAUTION]
> # MANDATO SUPREMO E INQUEBRANTABLE (MUST)
> **SIEMPRE DEBEN DESPLEGARSE LOS SUBAGENTES QUE SEAN REQUERIDOS PARA CUALQUIER MODIFICACIÓN.**
> **ESTÁ ESTRICTAMENTE PROHIBIDO REALIZAR MODIFICACIONES DE MANERA MONOLÍTICA O DIRECTA.**
> El agente principal NUNCA debe esperar a que el usuario le recuerde invocar subagentes ni debe pedir permiso para convocarlos. El despliegue de subagentes es **AUTOMÁTICO E INMEDIATO** ante cualquier requisito.

---

## 1. Disparador Automático Obligatorio (Trigger de Ejecución)

Ante **CUALQUIER** requisito, tarea, bug, refactorización o cambio solicitado por el usuario:

1. **PRIMER PASO INMEDIATO (Primer turno de herramientas):**
   - El agente principal **DEBE INVOCAR AUTOMÁTICAMENTE** a `manto-orchestrator` mediante la herramienta `invoke_subagent`.
   - **`manto-orchestrator` tiene la obligación ineludible de generar el PLAN ESTRATÉGICO DE IMPLEMENTACIÓN** que involucre a todos los dominios y subagentes necesarios.
2. **SEGUNDO PASO (Diseño y Desglose):**
   - Si se modifican DDL, contratos API o máquinas de estado, se invoca a `manto-software-architect`.
   - Se despliega a `manto-tech-lead` para coordinar la ejecución bajo el principio **Backend-First** y garantizar **Cero Placeholders**.
3. **TERCER PASO (Construcción por Especialistas):**
   - Se despliegan concurrentemente o en secuencia los subagentes de dominio titular (`manto-backend`, `manto-ux`, `manto-pricing`, `manto-claims`, `manto-ai`).
4. **CUARTO PASO (Auditoría Mandatoria de Cierre):**
   - **NINGÚN CAMBIO SE DA POR TERMINADO** sin desplegar a `manto-qa-security` para auditoría adversaria, verificación de pruebas Jest (`cd backend && npx jest`) y control de garantías regulatorias.

> ⚠️ **Infracción Grave:** Responder con código o planes implementados sin haber desplegado a los subagentes correspondientes constituye una violación directa de las reglas del sistema.

---

## 2. Matriz Canónica de Subagentes

| Subagente | Especialidad y Dominio | Cuándo DEBE Desplegarse Automáticamente |
| :--- | :--- | :--- |
| **`manto-orchestrator`** | CTO & Arquitectura Global | **SIEMPRE en el primer turno de todo requisito.** Genera el Plan Estratégico de Implementación para todos los agentes, resuelve dominios DDD y gobernanza. |
| **`manto-software-architect`** | Arquitectura y Soluciones | Contratos OpenAPI, DDL SQL PostgreSQL 16, máquinas de estado finitas y SLAs (<400ms). |
| **`manto-tech-lead`** | Staff Engineer & Liderazgo Técnico | Desglose de tareas técnicas, supervisión de código, Backend-First y control de placeholders. |
| **`manto-backend`** | Senior Backend Engineer | Módulos NestJS, DTOs (`class-validator`), persistencia PostgreSQL 16 (`pg` nativo), migraciones. |
| **`manto-ux`** | Senior Product Designer / UI | Next.js 14 App Router, componentes Tailwind CSS, micro-copia colombiana y accesibilidad. |
| **`manto-pricing`** | Motor Actuarial Determinista | Tarifas, factores de riesgo, amparos, deducibles/copagos, razas y SMLMV. |
| **`manto-ai`** | Ingeniero de Visión e IA | Clasificación biológica con Gemini, triaje conversacional de Nuquí 🐾, OCR facturas DIAN. |
| **`manto-claims`** | Automatización de Siniestros | Ciclo FNOL, máquina de estados de Sué ⚡, STP ($\le \$500.000$ COP), CUFE y pagos Bre-B. |
| **`manto-qa-security`** | **Auditoría & Seguridad Obligatoria** | **OBLIGATORIO para todo cierre de código.** Pruebas Jest, OWASP API Top 10, validación regulatoria. |

---

## 3. Cadena de Flujo de Trabajo (Workflow)

```
[Requerimiento del Usuario]
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 1. Invocación Automática Inmediata (invoke_subagent)   │
│    ──► manto-orchestrator                              │
│    Genera: Plan Estratégico de Implementación Global   │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 2. Diseño Contract-First & DDL SQL                     │
│    ──► manto-software-architect                        │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 3. Desglose Técnico & Asignación (Backend-First)       │
│    ──► manto-tech-lead                                 │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 4. Construcción por Agentes Titulares                  │
│    ──► manto-backend / manto-ux / manto-pricing / etc. │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 5. Auditoría Adversaria y Pruebas Obligatorias         │
│    ──► manto-qa-security (Bloquea entrega si hay fallas)│
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 6. Registro, Trazabilidad y Entrega al Usuario         │
└────────────────────────────────────────────────────────┘
```

---

## 4. Doctrinas Inquebrantables del Negocio (Insurtech Colombia)

1. **Determinismo Actuarial (Superintendencia Financiera):**
   - La IA **NUNCA** calcula primas, no decide elegibilidad ni aprueba reembolsos o siniestros.
   - Todo cálculo de precio es determinista, auditable y ejecutado del lado servidor por `manto-pricing`.
2. **Ley 1801 de 2016 (Manejo de Razas Especiales):**
   - Amparo de RCE por **50 SMLMV** ($87.545.250 COP en 2026) obligatorio e inevadible para las 15 razas de manejo especial.
   - Forzado por el motor de cálculo y respaldado por triggers en PostgreSQL (`quotes_exigir_rce_ley_1801` y `policies_exigir_rce_ley_1801`).
3. **Dinero en COP Tipado Estrictamente:**
   - Prohibido el uso de flotantes (`number`) para valores monetarios.
   - Usar exclusivamente `ColombianPeso` (`bigint`/enteros).
   - En persistencia JSONB, las cantidades viajan siempre como **cadenas de dígitos** (con sufijo `Cop`) para evitar pérdida de precisión sobre $2^{53}$.
4. **Habeas Data (Ley 1581 de 2012):**
   - Datos personales y llaves de pago (Bre-B) en columnas dedicadas de base de datos, nunca enterrados en documentos JSONB.
   - Toda tabla con datos personales debe soportar la rutina `suprimirDatosPersonales` (anonimización contractual).
   - Las fotos de mascotas se usan exclusivamente para clasificación biológica.
5. **Cero Placeholders y Código Completo:**
   - Queda terminantemente prohibido dejar código simulado, funciones vacías o comentarios `// TODO`. Todo código entregado debe estar completo y funcional.
6. **El Código Manda sobre la Documentación:**
   - Si existe discrepancia entre la documentación histórica y el código fuente activo, la verdad reside en el código. La divergencia debe declararse formalmente y resolverse mediante un ADR.
7. **Nombres Propios y Vocabulario al Cliente:**
   - **Nuquí 🐾:** cotiza y emite.
   - **Sué ⚡:** gestiona siniestros, reembolsos y pagos.
   - Vocabulario obligatorio: *tu aporte por evento* (nunca "deducible"), *reembolso veterinario* (nunca "siniestro"), *cuota mensual* (nunca "prima"), *días para activación de cobertura* (nunca "carencia").
8. **Integridad del Logotipo:**
   - El logotipo de Manto se toma siempre de `public/brand/manto-logo-color.png`. Prohibido redibujarlo en SVG o alterarlo.
9. **Verificación de Pruebas:**
   - Las 181+ pruebas Jest en `backend` deben permanecer en verde (`cd backend && npx jest`). Cada prueba previene una regresión real.
