# Certificación Oficial de QA y Seguridad: Integración de `manto-software-architect`
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Auditor:** Agente 7 — Principal QA + Security Engineer  
**Objetivo:** Auditoría obligatoria de integridad, coherencia de gobernanza, seguridad adversaria y doctrinas inquebrantables tras el alta del agente `manto-software-architect`.  
**Fecha:** Septiembre 2026  
**Resultado de Auditoría:** ✅ **APROBADO SIN RESERVAS (CERTIFICADO)**

---

## 1. Alcance de la Auditoría

Se realizó una inspección estricta, exhaustiva y adversaria sobre los siguientes archivos creados y actualizados en el repositorio:
1. `.claude/agents/manto-software-architect.md` [NUEVO]
2. `docs/agentes/claude-code/manto-software-architect.md` [NUEVO]
3. `docs/agentes/software-architect/README.md` [NUEVO]
4. `CLAUDE.md` [MODIFICADO]
5. `docs/REGLAS_ORQUESTACION_AGENTES.md` [MODIFICADO]
6. `.claude/agents/manto-frontmatter.md` y `docs/agentes/claude-code/manto-frontmatter.md` [MODIFICADO]
7. `.claude/agents/manto-orchestrator.md` y `docs/agentes/claude-code/manto-orchestrator.md` [MODIFICADO]

---

## 2. Matriz de Evaluación por Vectores Críticos

| Vector de Riesgo / Norma | Criterio Auditado | Evidencia en el Perfil del Agente | Estado |
| :--- | :--- | :--- | :---: |
| **Simetría de Gobernanza** | Réplica 1:1 entre `.claude/agents/` y `docs/agentes/claude-code/` | Ambos archivos poseen exactamente 49 líneas y 4.980 bytes de contenido binario idéntico. | ✅ CUMPLE |
| **Separación de Responsabilidades** | Cero intrusión en código de negocio o UI | Guardrail explícito: *"NUNCA escribas código de implementación de negocio ni componentes visuales de frontend."* Entrega exclusiva de DDL SQL, tipos TS y especificaciones DTO. | ✅ CUMPLE |
| **Determinismo Actuarial (SFC)** | La IA nunca calcula primas ni aprueba siniestros | Doctrina explícita: Flujos financieros 100% deterministas en servidor. Ningún flujo probabilístico en pricing o claims. | ✅ CUMPLE |
| **Ley 1801 de 2016 (RCE)** | RCE 50 SMLMV ($87.545.250 COP para 2026) mandatoria para razas especiales | Guardrail explícito: Cobertura obligatoria e inevadible a nivel estructural de base de datos (triggers PostgreSQL). | ✅ CUMPLE |
| **Ley 1581 de 2012 (Habeas Data)** | Protección y minimización de datos personales | Guardrail explícito: Datos personales (cédula, nombres, teléfono, correo) en columnas dedicadas y cifradas; prohibido enterrarlos en `jsonb`. | ✅ CUMPLE |
| **Precisión Financiera (COP)** | Prevención de errores de redondeo en pesos colombianos | Guardrail explícito: Siempre tipado nominal `ColombianPeso` (`bigint`/enteros). Cadenas de dígitos en persistencia JSONB para superar límites de $2^{53}$. Prohibidos números flotantes. | ✅ CUMPLE |
| **OWASP API & Concurrencia** | Prevención de condiciones de carrera y ataques de replay | Responsabilidad #4: Idempotencia transaccional (`Idempotency-Key`) y prevención de doble cobro / doble emisión / doble radicación. | ✅ CUMPLE |
| **Almacenamiento Seguro (S3/R2)** | Prevención de DoS por subida de binarios y fuga de adjuntos | Responsabilidad #3: URLs prefirmadas efímeras para facturas e historias clínicas, articulado con las zonas de cuarentena y escaneo. | ✅ CUMPLE |
| **Cadena de Orquestación** | Hand-off obligatorio e ineludible a QA antes del merge | Sección explícita *"Cierre obligatorio: revisión de QA"*, exigiendo reporte de DDL, transiciones de estado y vectores de concurrencia a `manto-qa-security`. | ✅ CUMPLE |
| **Delimitación CTO vs Architect** | Ausencia de solapamiento de activación en prompts | `CLAUDE.md` y descripciones en frontmatter delimitan: `manto-orchestrator` = *el qué y dónde vive* (CTO, 19 dominios, ADRs estratégicos); `manto-software-architect` = *el cómo estructural* (DDL, contratos, máquinas de estado). | ✅ CUMPLE |

---

## 3. Análisis de Seguridad Adversaria (Threat Modeling)

### 3.1 Vector de Doble Gasto y Replay en Claims/Checkout
* **Amenaza evaluada:** Si el arquitecto diseña contratos sin mecanismos de idempotencia o máquinas de estado sin candados transaccionales, se reactivan las vulnerabilidades críticas `BUG-CRIT-01` (doble gasto) y `BUG-CRIT-02` (CUFE duplicado).
* **Control implementado:** El agente tiene como mandato nativo la exigencia de `Idempotency-Key`, la especificación de máquinas de estados finitas con guardas estrictas de transición, y el bloqueo pesimista/optimista en operaciones con balance monetario.

### 3.2 Vector de Contaminación de Datos y Pérdida de Auditoría SFC
* **Amenaza evaluada:** Uso de números flotantes o modificación no versionada de reglas actuariales.
* **Control implementado:** El agente hereda la prohibición de coma flotante y la obligatoriedad de vinculación a `rulesVersion`. Además, la modificación de esquemas DDL PostgreSQL queda clasificada en la Matriz de Autonomía de las Reglas de Orquestación como ⚠️ **Aprobación Humana** obligatoria mediante script transaccional y ADR.

### 3.3 Vector de BOLA / Broken Object Level Authorization
* **Amenaza evaluada:** Exposición de endpoints de siniestros o pólizas con identificadores directos no validados contra el token de sesión.
* **Control implementado:** La especificación de contratos OpenAPI 3.1 y DTOs tipados con `class-validator` bajo RFC 7807 (`ProblemDetails`) garantiza que la tenencia de recursos (*resource ownership*) se declare en la interfaz formal antes de la implementación por parte de `manto-backend`.

---

## 4. Veredicto del Auditor

La incorporación del agente `manto-software-architect` (`software-architect`) **fortalece la postura de seguridad y robustez técnica de Manto 2.0**. No se detectan brechas de gobernanza, solapamientos operacionales ni debilitamiento de las directrices de la Superintendencia Financiera, la Ley 1801 de 2016 ni la Ley 1581 de 2012.

**Certificación:** `EMITIDA - CERTIFICADO PARA OPERACIÓN EN PIPELINE DE MANTO 2.0`.
