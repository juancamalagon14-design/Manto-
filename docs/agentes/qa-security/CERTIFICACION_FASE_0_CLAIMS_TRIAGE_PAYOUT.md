# Certificación Oficial de QA y Seguridad: Especificación Técnica de Siniestros, Triage y Pago (Fase 0)
## Manto 2.0 — Plataforma Insurtech Multi-Ramo (Mascotas Colombia)
**Auditor:** Agente 7 — Principal QA + Security Engineer  
**Documento Auditado:** `docs/agentes/software-architect/PHASE_0_CLAIMS_TRIAGE_PAYOUT_SPEC.md`  
**Autor de la Especificación:** Principal Software & Solutions Architect (`manto-software-architect`)  
**Fecha de Auditoría:** 23 de Septiembre de 2026  
**Resultado de Auditoría:** ✅ **APROBADO CON ENMIENDAS DE BLINDAJE (CERTIFICADO V1.1.0)**

---

## 1. Resumen Ejecutivo y Declaración Doctrinal de QA

> [!IMPORTANT]
> **DICTAMEN DEL PRINCIPAL QA + SECURITY ENGINEER**:
> La especificación técnica de la Fase 0 establece una arquitectura sólida basada en aislamiento de binarios vía URLs prefirmadas en Cloudflare R2 / AWS S3, colas asíncronas BullMQ + Redis y persistencia relacional en PostgreSQL 16 con UUIDv7 y dinero entero (`ColombianPeso`).
> 
> Sin embargo, la inspección adversaria implacable identificó **5 vectores de riesgo crítico y alto** que habrían generado **pérdidas financieras directas** (reactivación de `BUG-CRIT-01` y omisión de deducibles), **vulnerabilidades de seguridad de datos BOLA/IDOR** (ausencia de `user_id` en soportes) y **brechas de cumplimiento ante la DIAN y la SFC** (índice CUFE no único y falso positivo en reintentos).
> 
> La presente certificación aprueba la especificación técnica condicionada a la incorporación inmediata e inmutable de las **Enmiendas de Blindaje Obligatorio (Versión 1.1.0)**.

---

## 2. Matriz de Evaluación por Vectores de Riesgo

| Vector de Riesgo | Estándar / Norma | Hallazgo en Especificación v1.0.0 | Enmienda Mandatoria v1.1.0 | Severidad | Estado |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Doble Gasto en Concurrencia (`BUG-CRIT-01`)** | Integridad Financiera / Concurrencia | El OCC (`version`) en `claims` solo protege una fila individual; no previene que 2 siniestros concurrentes agoten el saldo anual de la póliza. | Bloqueo pesimista `SELECT ... FOR UPDATE` sobre `insurance.policies` durante el Triage y liquidación. | `CRITICAL` | ✅ SUBSANADO |
| **Replay Attack de CUFE DIAN (`BUG-CRIT-02`)** | Fiscal DIAN / Prevención de Fraude | `idx_claims_dian_cufe` era un índice normal (no UNIQUE). Un atacante podía modificar 1 byte del PDF para variar el SHA-256 y cobrar el mismo CUFE 2 veces. | Índice parcial único global: `uq_claims_dian_cufe_global` con filtro `WHERE status NOT IN ('REJECTED', 'DISPUTED')`. | `CRITICAL` | ✅ SUBSANADO |
| **BOLA / IDOR en Bóveda de Documentos** | OWASP API 1 (BOLA) / Ley 1581 | La tabla `claim_documents` carecía de `user_id`. Un usuario podía adjuntar `documentIds` ajenos a su siniestro en `POST /claims`. | Inclusión de `user_id UUID NOT NULL REFERENCES core.users(id)` y validación estricta de tenencia en backend. | `CRITICAL` | ✅ SUBSANADO |
| **Bloqueo Operativo de Dispersión Financiera** | Integridad Operativa de Pagos | `payout_records` solo almacenaba `account_identifier_masked` (`'310****123'`). Es imposible dispersar fondos a una cuenta enmascarada. | Incorporación de `account_identifier_encrypted TEXT NOT NULL` (AES-256-GCM) y campos de ruteo ACH (`bank_code`, `account_type`). | `HIGH` | ✅ SUBSANADO |
| **Omisión de Deducible en Fast-Track** | Determinismo Actuarial / SFC | La fórmula Fast-Track enviaba a pago sin descontar deducible/copago, o fallaba en BD si el monto neto era $0 COP (`amount_cop > 0`). | Cálculo de `net_payable_amount_cop = max(0, approved - deductible - copay)`. Si es $0, se cierra sin pago sin error de BD. | `HIGH` | ✅ SUBSANADO |
| **Discrepancia Factura vs Reclamado** | Prevención de Fraude Actuarial | No se comparaba `claimed_amount_cop` contra el total extraído por OCR. Fraude posible subiendo factura de $10k y reclamando $199k. | Regla booleana #9: `claimed_amount_cop <= ocr_extracted_total_cop`. Si difieren, enrutamiento a auditoría manual. | `HIGH` | ✅ SUBSANADO |
| **Validación Débil en Contratos DTO** | OWASP API 3 / DoS | `documentIds` sin `@ArrayMaxSize` (DoS), `fileName` vulnerable a path traversal, y `claimedAmountCop` sin límite `@Max`. | Endurecimiento con regex estrictas, `@ArrayMaxSize(10)` y `@Max(100000000)`. | `MEDIUM` | ✅ SUBSANADO |
| **Inmutabilidad de Auditoría ante TRUNCATE** | SFC Circular Básica Jurídica | El trigger `FOR EACH ROW` de `claim_audit_logs` no interceptaba sentencias `TRUNCATE TABLE`. | Añadido trigger `BEFORE TRUNCATE ... FOR EACH STATEMENT` y revocación de permisos `TRUNCATE`. | `MEDIUM` | ✅ SUBSANADO |

---

## 3. Desglose Detallado de Hallazgos y Soluciones Técnicas Obligatorias

### 3.1 Vector Financiero: Prevención de Carrera en Límite de Póliza (`BUG-CRIT-01`)
* **Diagnóstico Adversario:** El arquitecto implementó OCC (`version`) a nivel de `claims.claims` y `claims.payout_records`. Si bien esto evita colisiones al editar el mismo siniestro, es **totalmente ineficaz contra el doble gasto de cobertura**: dos siniestros concurrentes para la misma póliza residen en filas distintas de la base de datos. Ambos leerían un saldo remanente suficiente y ambos serían aprobados por Fast-Track en BullMQ.
* **Remediación en v1.1.0:**
  1. Durante la ejecución de `TriageWorker`, la liquidación y la emisión del payout deben ejecutarse dentro de una transacción serializada o con **bloqueo pesimista** sobre la entidad de póliza:
     ```sql
     SELECT id, remaining_coverage_cop, status 
     FROM insurance.policies 
     WHERE id = :policyId 
     FOR UPDATE;
     ```
  2. El débito del monto neto indemnizable se efectúa atómicamente contra el saldo de la póliza con constraint de integridad `CHECK (remaining_coverage_cop >= 0)`.

### 3.2 Vector Fiscal: Blindaje Definitivo de Factura Electrónica DIAN (`BUG-CRIT-02`)
* **Diagnóstico Adversario:** El DDL original presentaba dos fallas graves:
  1. `idx_claims_dian_cufe` era un índice ordinario. Si un atacante modificaba metadatos de un PDF (variando el SHA-256), el motor no detectaba la duplicidad del CUFE, permitiendo cobrar la misma factura dos veces en cuentas distintas.
  2. `uq_claims_invoice_hash` no filtraba siniestros rechazados. Si un usuario honesto tenía un siniestro rechazado por falta de epicrisis y volvía a radicar su factura válida, el sistema rechazaba la inserción por violación de unicidad.
* **Remediación en v1.1.0:**
  ```sql
  -- Índice global único de CUFE (excluyendo siniestros no indemnizados)
  CREATE UNIQUE INDEX IF NOT EXISTS uq_claims_dian_cufe_global 
  ON claims.claims (dian_cufe) 
  WHERE dian_cufe IS NOT NULL AND status NOT IN ('REJECTED', 'DISPUTED');

  -- Índice único de hash de archivo (con filtro de estado para reintentos legítimos)
  DROP INDEX IF EXISTS claims.uq_claims_invoice_hash;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_claims_invoice_hash 
  ON claims.claims (invoice_sha256_hash) 
  WHERE invoice_sha256_hash IS NOT NULL AND status NOT IN ('REJECTED', 'DISPUTED');
  ```

### 3.3 Vector de Seguridad de Datos: Aislamiento BOLA/IDOR en Soportes Médicos
* **Diagnóstico Adversario:** `claim_documents` no registraba `user_id`. Al permitir que `POST /claims` reciba una lista de `documentIds: string[]`, cualquier usuario autenticado podía asociar identificadores de documentos de otros asegurados a sus propios siniestros, vulnerando la reserva médica de historias clínicas y violando la Ley 1581 de 2012.
* **Remediación en v1.1.0:**
  1. Se añade la columna obligatoria `user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT` en `claims.claim_documents`.
  2. Al recibir `POST /claims`, el servicio valida que todos los `documentIds` pertenezcan al `userId` del token de sesión:
     ```typescript
     const userDocsCount = await this.claimDocsRepo.count({
       where: { id: In(dto.documentIds), userId: currentUser.id, claimId: IsNull() }
     });
     if (userDocsCount !== dto.documentIds.length) {
       throw new ForbiddenException('Uno o más documentos no pertenecen al usuario o ya fueron radicados');
     }
     ```

### 3.4 Vector Operativo de Pagos: Cifrado y Datos Bancarios en `payout_records`
* **Diagnóstico Adversario:** El DDL almacenaba únicamente `account_identifier_masked` (ej. `'310****123'`). Esta paradoja impedía que el gateway (Bre-B, Nequi, ACH) pudiera efectuar la transferencia real. Además, para transferencias ACH faltaban los campos `bank_code` y `account_type`.
* **Remediación en v1.1.0:**
  ```sql
  -- Ajustes en claims.payout_records
  ALTER TABLE claims.payout_records 
    ADD COLUMN IF NOT EXISTS account_identifier_encrypted TEXT NOT NULL,
    ADD COLUMN IF NOT EXISTS bank_code VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NULL CHECK (account_type IN ('SAVINGS', 'CHECKING', 'WALLET', 'BRE_B_KEY')),
    ADD CONSTRAINT chk_payout_retry_count CHECK (retry_count >= 0 AND retry_count <= 5);
  ```

### 3.5 Vector de Lógica de Negocio: Liquidación Actuarial y Comparación Factura vs Reclamado
* **Diagnóstico Adversario:**
  1. Un usuario podía declarar un monto reclamado de $199.000 COP adjuntando una factura de $15.000 COP, aprobándose de forma fraudulenta vía Fast-Track.
  2. No se definía cómo se aplicaba el deducible en Fast-Track. Si el reclamo era menor al deducible, el monto neto resultaba $\le 0$, disparando error de BD en `payout_records` (`CHECK (amount_cop > 0)`).
* **Remediación en v1.1.0:**
  1. Se incorpora la **Regla de Triage #9**:
     $$\text{claimed\_amount\_cop} \le \text{ocr\_extracted\_total\_cop}$$
  2. En la liquidación Fast-Track:
     $$\text{net\_payable\_amount\_cop} = \max(0, \text{approved\_amount\_cop} - \text{deductible\_cop} - \text{copay\_cop})$$
  3. Si $\text{net\_payable\_amount\_cop} == 0$, el siniestro transiciona a `FAST_TRACK_APPROVED` y finaliza con estatus `CLOSED_UNDER_DEDUCTIBLE` sin emitir registro en `payout_records` ni llamar a la pasarela bancaria.

---

## 4. Criterios de Aceptación Técnicos Blindados para `tech-lead`

Para la implementación del **Paso 1 y Paso 2**, el Tech Lead debe verificar obligatoriamente los siguientes 8 mandatos de seguridad:

1. **Bloqueo Pesimista de Póliza:** Todo proceso de aprobación de siniestro debe obtener `SELECT FOR UPDATE` sobre la póliza para evitar sobregiro de cobertura en concurrencia.
2. **Validación de Pertenencia BOLA:** `ClaimsService` debe rechazar cualquier radicación cuyos `documentIds` no pertenezcan al usuario autenticado extraído del JWT.
3. **Cifrado AES-256-GCM:** Los identificadores de cuenta para dispersión deben almacenarse cifrados en reposo (`account_identifier_encrypted`), exponiendo únicamente versiones enmascaradas en logs y respuestas de API.
4. **Idempotencia con Mismo Hash en Reintentos:** En caso de reintento de dispersión bancaria por timeout, el gateway debe reutilizar el `idempotency_key` original para prevenir dispersiones duplicadas.
5. **Alineación Factura vs Reclamo:** Rechazar Fast-Track si el monto reclamado supera el total extraído por el OCR de la factura electrónica.
6. **Descuento Estricto de Deducible:** Ninguna dispersión financiera puede ejecutarse sin haber liquidado y descontado el deducible y copago contractuales.
7. **Limpieza de Documentos Huérfanos:** Implementar cron diario que purgue de la base de datos y de S3/R2 los documentos con `claim_id IS NULL` con más de 24 horas de antigüedad.
8. **Protección Total de Auditoría:** Garantizar que la tabla `claim_audit_logs` no admita `UPDATE`, `DELETE` ni `TRUNCATE`.

---

## 5. Veredicto Oficial

La especificación técnica `PHASE_0_CLAIMS_TRIAGE_PAYOUT_SPEC.md` ha sido **auditada minuciosamente, endurecida contra ataques de concurrencia y fraude fiscal, y homologada bajo los estándares OWASP API Top 10, SFC y Ley 1581**.

Con la incorporación de las enmiendas documentadas en la **Versión 1.1.0**, la arquitectura técnica queda **PLENAMENTE BLINDADA Y CERTIFICADA** para su ejecución técnica.

**Certificación:**  
✅ **CERTIFICADO PARA CONSTRUCCIÓN — FASE 0 CERRADA EXITOSAMENTE**
