# Manto 2.0 — AGENTS.md (Reglas de Orquestación y Mandato MUST)

> [!CAUTION]
> **REGLA DE ORO / MUST INQUEBRANTABLE:**
> **SIEMPRE DEBEN DESPLEGARSE LOS SUBAGENTES QUE SEAN REQUERIDOS PARA CUALQUIER MODIFICACIÓN.**
> **EL DESPLIEGUE ES AUTOMÁTICO ANTE CUALQUIER REQUISITO.**
> Está terminantemente prohibido que el asistente principal trabaje de forma monolítica o espere a que el usuario le pida invocar agentes. Ante cualquier requisito, en el primer turno se debe invocar a `manto-orchestrator` para que trace el Plan Estratégico de Implementación para todo el equipo.

---

## 1. Disparador Automático Obligatorio

Ante cualquier requerimiento del usuario:
1. **Invocación Automática Inmediata:** Desplegar `manto-orchestrator` con `invoke_subagent`.
2. **Plan Estratégico:** `manto-orchestrator` formula el Plan de Implementación Integral detallando la secuencia de dominios, contratos y requerimientos.
3. **Despliegue de Especialistas:** Se convocan sucesivamente o en paralelo los subagentes correspondientes:
   - `manto-software-architect`: DDL SQL, OpenAPI, máquinas de estado finitas.
   - `manto-tech-lead`: Desglose atómico, principio Backend-First, Cero Placeholders.
   - `manto-backend`: Módulos NestJS, DTOs con class-validator, persistencia `pg` nativa.
   - `manto-ux`: Next.js 14 App Router, Tailwind CSS, micro-copia colombiana.
   - `manto-pricing`: Motor actuarial determinista, Ley 1801 (50 SMLMV), COP nominal.
   - `manto-claims`: Siniestros FNOL (Sué ⚡), STP $\le \$500.000$ COP, pagos Bre-B.
   - `manto-ai`: Visión Gemini, triaje Nuquí 🐾, OCR DIAN (CUFE).
4. **Auditoría de Cierre con `manto-qa-security`:** NINGÚN cambio se entrega sin que `manto-qa-security` haya corrido las pruebas Jest (`cd backend && npx jest`) y verificado la seguridad y cumplimiento regulatorio.

---

## 2. Flujo de Trabajo Obligatorio (Workflow)

```
[Solicitud de Requerimiento]
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
│ 4. Construcción (Backend-First)                        │
│    ──► manto-backend / manto-ux / manto-pricing / etc. │
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 5. Auditoría & Pruebas Obligatorias                    │
│    ──► manto-qa-security (Bloquea entrega si hay error)│
└────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ 6. Registro, Trazabilidad y Entrega al Usuario         │
└────────────────────────────────────────────────────────┘
```

---

## 3. Doctrinas Inquebrantables de Manto 2.0

* **La IA NUNCA calcula primas ni aprueba siniestros:** Motor determinista del lado servidor. La IA solo captura y normaliza datos estructurados.
* **Ley 1801 de 2016:** RCE de 50 SMLMV ($87.545.250 COP en 2026) obligatoria e inevadible en motor y base de datos para razas especiales.
* **Dinero en COP:** Tipado estricto `ColombianPeso` (`bigint`/enteros). Cero números flotantes. En JSONB viaja siempre como string numérico.
* **Habeas Data (Ley 1581 de 2012):** Datos personales en columnas dedicadas; soporte para `suprimirDatosPersonales`. Fotos únicamente para clasificación biológica.
* **Cero Placeholders:** Prohibido código simulado o `// TODO`. Todo componente y servicio debe estar completo y funcional.
* **El código manda sobre la documentación:** Donde diverjan, la verdad está en el código y la discrepancia debe documentarse formalmente.
* **Verificación de Pruebas:** Ejecutar siempre `cd backend && npx jest`. Ningún cambio se aprueba con pruebas rotas.
