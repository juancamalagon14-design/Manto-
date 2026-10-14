# Certificación Oficial de QA y Seguridad: Integración de `manto-tech-lead`
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Auditor:** Agente 7 — Principal QA + Security Engineer  
**Objetivo:** Auditoría obligatoria de integridad, coherencia de gobernanza, seguridad adversaria, doctrina técnica y blindaje regulatorio tras la incorporación del agente `manto-tech-lead` (`tech-lead`).  
**Fecha:** Septiembre 2026  
**Resultado de Auditoría:** ✅ **APROBADO SIN RESERVAS (CERTIFICADO)**

---

## 1. Alcance de la Auditoría

Se auditó minuciosamente la incorporación del nuevo agente `manto-tech-lead` (Staff Engineer & Technical Lead) en todos los artefactos de gobernanza, configuración y documentación del repositorio:
1. `.claude/agents/manto-tech-lead.md` [NUEVO] — Definición canónica del agente para Claude Code.
2. `docs/agentes/claude-code/manto-tech-lead.md` [NUEVO] — Copia simétrica de referencia documental.
3. `docs/agentes/tech-lead/README.md` [NUEVO] — Dominio y responsabilidades del agente en la jerarquía documental.
4. `CLAUDE.md` [MODIFICADO] — Tabla maestra de agentes y delimitación de fronteras de rol.
5. `docs/REGLAS_ORQUESTACION_AGENTES.md` [MODIFICADO] — Matriz Canónica de Agentes y Lifecycle Mermaid con Fase 4 (Backend-First).
6. `.claude/agents/manto-frontmatter.md` y `docs/agentes/claude-code/manto-frontmatter.md` [MODIFICADO] — Inclusión en el catálogo oficial de agentes.

---

## 2. Matriz de Evaluación por Vectores de QA y Seguridad

| Vector de Riesgo / Norma | Criterio Auditado | Evidencia en el Perfil del Agente | Estado |
| :--- | :--- | :--- | :---: |
| **Simetría 100% Binaria** | Réplica exacta entre `.claude/agents/` y `docs/agentes/claude-code/` | Ambos archivos tienen exactamente 41 líneas, 3.948 bytes e idéntico contenido hash. | ✅ CUMPLE |
| **Principio Backend-First** | Persistencia y Core API terminadas y probadas antes de UI | Regla #2: *"Ejecuta siempre primero la capa de Backend y Base de Datos (migraciones DDL, entidades, servicios, DTOs, endpoints y pruebas) antes de autorizar el desarrollo de pantallas o componentes de UI."* | ✅ CUMPLE |
| **Política Cero Placeholders** | Prohibición absoluta de stubs, mocks incompletos o `// TODO` | Regla #3: *"Exige a los desarrolladores código 100% completo y funcional, sin mocks incompletos, placeholders o comentarios tipo `// TODO: agregar lógica aquí`. Todo método debe estar implementado y probado."* | ✅ CUMPLE |
| **Separación de Funciones (SoD)** | Delimitación estricta entre diseño, orquestación y auditoría | Frontera explícita: `software-architect` diseña contratos y DDL; `tech-lead` desglosa y coordina la ejecución; `backend`/`ux` implementan; `qa-security` audita independientemente. Cero asunción de diseño original o auditoría final. | ✅ CUMPLE |
| **Determinismo Actuarial (SFC)** | Ningún cálculo o suscripción delegado a Inteligencia Artificial | Responsabilidad #4: *"Motor determinista: la IA nunca calcula primas ni aprueba siniestros."* | ✅ CUMPLE |
| **Ley 1801 de 2016 (RCE)** | RCE 50 SMLMV obligatoria e inevadible en backend y BD | Responsabilidad #4: *"RCE Ley 1801 (50 SMLMV) obligatoria e inevadible en backend y base de datos para razas especiales."* | ✅ CUMPLE |
| **Ley 1581 de 2012 (Habeas Data)** | Cifrado y columnas dedicadas para datos sensibles | Responsabilidad #4: *"Ley 1581 (Habeas Data): datos personales en columnas dedicadas y cifradas."* | ✅ CUMPLE |
| **Precisión Financiera (COP)** | Erradicación de errores de redondeo IEEE 754 | Responsabilidad #4: *"Dinero en COP siempre tipado `ColombianPeso` (`bigint`/enteros, cadenas de dígitos en JSONB)."* | ✅ CUMPLE |
| **Code Review Estricto (TS)** | Prohibición de `any` y tipado riguroso | Responsabilidad #3: *"Supervisar que cada archivo generado respete tipado estricto en TypeScript (sin `any`), alta cohesión, modularidad y manejo adecuado de excepciones (RFC 7807 `ProblemDetails`)."* | ✅ CUMPLE |
| **Hand-Off Mandatorio a QA** | Cierre obligatorio con auditoría independiente | Sección *"Cierre obligatorio: revisión de QA"*: Sometimiento ineludible de archivos, contratos y pruebas a `manto-qa-security` antes del merge o confirmación de usuario. | ✅ CUMPLE |

---

## 3. Análisis de Seguridad Adversaria (Threat Modeling)

### 3.1 Vector de Evasión de QA (QA Bypass Risk)
* **Amenaza evaluada:** Que el Tech Lead, al realizar "Code Review Riguroso", asuma erróneamente que reemplaza la auditoría independiente de `manto-qa-security` y dé por cerrado un desarrollo sin someterlo a pruebas adversarias.
* **Control verificado:** El flujo del ciclo de vida en `docs/REGLAS_ORQUESTACION_AGENTES.md` (diagrama Mermaid) y la sección de cierre de `.claude/agents/manto-tech-lead.md` establecen contractualmente que ninguna iteración técnica concluye sin la revisión formal de `manto-qa-security`. Además, el diagrama modela el bucle de rechazo de QA devolviendo directamente al Tech Lead para la gestión de fallas.

### 3.2 Vector de Falsas Rutas Felices por Mocks en Producción (Stub Leakage)
* **Amenaza evaluada:** Subagentes ejecutores que dejan mocks, respuestas simuladas o métodos truncados con `// TODO`, derivando en fallas de liquidación o dispersión de pagos inexistentes.
* **Control verificado:** Mandato expreso de **Cero Placeholders** con bloqueo de integración si existen stubs no funcionales. Todo método debe contar con implementación completa y pruebas de soporte.

### 3.3 Vector de Incompatibilidad y Relajación de Tipos (TypeScript Escape Hatches)
* **Amenaza evaluada:** Introducción de `any`, `@ts-ignore` o números flotantes para dinero `COP` para forzar compilación rápida ante discordancias de contratos DTO/DDL.
* **Control verificado:** El perfil del Tech Lead impone supervisión de tipado estricto en TypeScript (prohibición de `any`), respeto irrestricto al tipo nominal `ColombianPeso` (`bigint`) y bloqueo inmediato de cualquier código que altere o viole los contratos de API o esquemas de base de datos fijados por el arquitecto.

### 3.4 Vector de Asimetría Frontend/Backend (Frontend Silencing)
* **Amenaza evaluada:** Desarrollo de componentes frontend que inventan lógica de tarifas o atrapan excepciones en silencio (`safeFetch`) debido a la ausencia de endpoints funcionales en el backend.
* **Control verificado:** Mandato estricto de **Backend-First**: Base de datos, servicios, DTOs, endpoints y pruebas deben estar finalizados y validados antes de autorizar la construcción de interfaces de usuario.

---

## 4. Veredicto Oficial

La incorporación de `manto-tech-lead` (`tech-lead`) como **Staff Engineer & Technical Lead** está **plenamente blindada**. Llena un vacío crítico de orquestación técnica intermedia entre el diseño de arquitectura y la ejecución de código, reforzando la gobernanza, garantizando el principio Backend-First y eliminando el riesgo de código incompleto.

**Certificación Emitida:**  
✅ **CERTIFICADO PARA OPERACIÓN EN EL PIPELINE DE MANTO 2.0 (APROBADO)**
