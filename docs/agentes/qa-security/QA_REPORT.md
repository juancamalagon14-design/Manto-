# Informe de Aseguramiento de Calidad y Fallos Potenciales (QA & Vulnerability Report)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Agente:** Agente 7 - Principal QA + Security Engineer  
**Objetivo:** Control de Calidad Final, Detección Temprana de Fallos y Blindaje Preventivo  
**Versión:** 1.0.0  
**Fecha:** Septiembre 2026  
**Estado:** Hallazgos Críticos Identificados para Subsanación Obligatoria  

---

## 1. Declaración Doctrinal de QA

> [!CAUTION]
> **POSTURA DEL AUDITOR DE CALIDAD Y SEGURIDAD**:
> Nuestra labor **NO es hacer que el producto se vea bien ni felicitar al equipo por la arquitectura**. Nuestra función es encontrar de forma implacable **todo lo que puede romperse, ser explotado, fallar bajo estrés o generar pérdidas financieras y regulatorias**.
> 
> Una funcionalidad **NO está lista para producción** hasta que todos los hallazgos de severidad `CRITICAL` y `HIGH` estén completamente mitigados y verificados con pruebas automatizadas.

---

## 2. Resumen Ejecutivo de Hallazgos

Tras inspeccionar exhaustivamente la arquitectura, los esquemas de base de datos, los contratos de API y los flujos de UX, se identificaron **8 vectores de riesgo y fallos potenciales**:

| ID | Severidad | Dominio Afectado | Descripción Resumida del Fallo |
| :--- | :---: | :--- | :--- |
| **`BUG-CRIT-01`** | `CRITICAL` | Siniestros / Finanzas | Condición de carrera (*Race Condition*) en concurrencia: Doble gasto del saldo anual de cobertura en póliza. |
| **`BUG-CRIT-02`** | `CRITICAL` | Siniestros / Fiscal | Replay Attack de facturas DIAN: Posibilidad de radicar el mismo CUFE desde cuentas distintas. |
| **`BUG-HIGH-01`** | `HIGH` | Rendimiento / UX | Cuello de botella en subida de fotos (10 MB en 4G Colombia) destruyendo el SLA de "Cotización < 60s". |
| **`BUG-HIGH-02`** | `HIGH` | Suscripción Actuarial | Desfase temporal en cálculo de edad por huso horario (UTC vs. UTC-5 Colombia) y años bisiestos. |
| **`BUG-HIGH-03`** | `HIGH` | Seguridad API / BOLA | Riesgo de BOLA/IDOR en descarga de facturas y visualización de carátulas mediante UUIDs predecibles. |
| **`BUG-MED-01`** | `MEDIUM` | Suscripción / Ley 1801 | Intento de desmarcación maliciosa del add-on mandatorio de RCE mediante manipulación del payload en API. |
| **`BUG-MED-02`** | `MEDIUM` | Checkout / Wompi | Pérdida de estado y timeout de cotización durante la redirección al banco en PSE. |
| **`BUG-LOW-01`** | `LOW` | Generación de PDFs | Inyección de caracteres especiales o emojis en el nombre de la mascota rompiendo el renderizador de carátulas. |

---

## 3. Desglose Exhaustivo de Hallazgos y Remediación

### `BUG-CRIT-01`: Condición de Carrera en Doble Gasto de Saldo Anual de Cobertura
* **Severidad:** `CRITICAL`
* **Dominio:** Motor de Siniestros y Contabilidad de Pólizas
* **Descripción del Fallo:**
  Si un cliente o atacante radíca dos solicitudes de reembolso simultáneas mediante llamadas concurrentes a la API (`POST /v1/claims`) para una póliza que tiene un remanente de COP $1.000.000, ambas solicitudes leen el saldo disponible antes de que la otra debite su liquidación. Si ambas solicitudes son por COP $800.000, el sistema aprobaría ambas ($1.600.000 en total), superando el límite anual contratado y generando pérdida financiera directa.
* **Pasos para Reproducir:**
  1. Crear una póliza con saldo remanente de COP $1.000.000.
  2. Disparar concurrentemente (diferencia de $< 100\text{ ms}$) dos solicitudes `POST /v1/claims` con montos aprobables de COP $800.000 cada una.
  3. Observar que ambas consultas leen `remainingLimit = 1.000.000` y ambas pasan a estado de dispersión bancaria.
* **Comportamiento Esperado:**
  La segunda transacción debe ser bloqueada o recalculada contra el saldo restante tras la primera liquidación, respetando estrictamente el tope de COP $1.000.000.
* **Impacto:** Pérdida patrimonial acumulada y violación de límites asegurados ante la aseguradora aliada.
* **Solución Técnica Obligatoria:**
  Implementar **bloqueo pesimista a nivel de fila (`SELECT ... FOR UPDATE`)** dentro de la transacción de liquidación de siniestro en PostgreSQL, combinado con la columna de versión optimista:
  ```typescript
  // En ClaimsService.executeSettlementTransaction()
  await queryRunner.manager.findOne(PolicyEntity, {
    where: { id: policyId },
    lock: { mode: 'pessimistic_write' }
  });
  ```

---

### `BUG-CRIT-02`: Replay Attack de Facturas Electrónicas DIAN (CUFE Duplicado Inter-Cuentas)
* **Severidad:** `CRITICAL`
* **Dominio:** Anti-Fraude e Integridad Fiscal
* **Descripción del Fallo:**
  El diseño original valida el CUFE buscando duplicados dentro de la póliza del usuario. Si un tercero obtiene una copia de una factura veterinaria ajena (o un cliente con dos mascotas aseguradas presenta la misma factura para ambas), el sistema podría autorizar dos reembolsos sobre el mismo gasto fiscal.
* **Comportamiento Esperado:**
  El CUFE de la DIAN debe ser un **identificador único global estricto** en toda la base de datos de siniestros, impidiendo que cualquier factura electrónica sea cobrada más de una vez en la historia de la plataforma.
* **Solución Técnica Obligatoria:**
  1. Crear un índice único parcial en PostgreSQL:
     ```sql
     CREATE UNIQUE INDEX uq_claims_dian_cufe_global 
     ON claims.claims (dian_cufe) 
     WHERE dian_cufe IS NOT NULL AND status NOT IN ('REJECTED', 'CANCELLED');
     ```
  2. En caso de colisión, marcar el nuevo reclamo con alerta de fraude severo (`FraudScore = 100.00`) y derivar a investigación sin emitir pago.

---

### `BUG-HIGH-01`: Cuello de Botella en Carga de Fotos que Destruye el SLA de < 60 Segundos
* **Severidad:** `HIGH`
* **Dominio:** Rendimiento, UX y Tasa de Conversión
* **Descripción del Fallo:**
  Las cámaras de smartphones modernos capturan fotos de 8 a 15 MB. En redes móviles colombianas promedio (4G con subida de 2 a 5 Mbps), subir un archivo de 10 MB toma entre **16 y 40 segundos**, consumiendo más del 50% de la ventana total de 60 segundos antes de que el usuario siquiera vea la primera inferencia.
* **Comportamiento Esperado:**
  La transferencia debe tomar **menos de 1.5 segundos** en cualquier red 4G.
* **Solución Técnica Obligatoria:**
  Imponer **compresión mandatoria del lado del cliente** en Next.js (usando un Web Worker con Canvas HTML5 o librería `browser-image-compression`) antes de iniciar la subida a S3:
  * Redimensionar a un máximo de $1600 \times 1200 \text{ px}$ en formato WebP/JPEG calidad 82%.
  * Reducción de peso típica: de $12\text{ MB} \to 450\text{ KB}$ (reducción del $96\%$ en tiempo de subida).

---

### `BUG-HIGH-02`: Desfase en Cálculo de Edad por Huso Horario y Años Bisiestos
* **Severidad:** `HIGH`
* **Dominio:** Motor de Elegibilidad y Suscripción Actuarial
* **Descripción del Fallo:**
  Si un usuario selecciona como fecha de nacimiento el 29 de febrero en un año bisiesto, o si la comparación de meses se hace con `new Date()` sin normalizar la zona horaria `America/Bogota` (UTC-5), una mascota exactamente en el límite de los 8 años (108 meses) puede ser evaluada como elegible a las 23:00 UTC y como inelegible a las 05:00 UTC del día siguiente.
* **Solución Técnica Obligatoria:**
  Estandarizar el cálculo de edad utilizando aritmética de días solares exactos anclados a medianoche de Colombia (`UTC-5`) mediante funciones puras sin dependencia del huso horario del servidor:
  ```typescript
  export function calculateExactAgeInMonths(birthDateStr: string, referenceDateStr: string): number {
    // Cálculo determinista basado en strings YYYY-MM-DD sin desbordamiento de zona
  }
  ```

---

### `BUG-HIGH-03`: BOLA / IDOR en Descarga de Facturas y Carátulas Oficiales
* **Severidad:** `HIGH`
* **Dominio:** Seguridad de Datos y Cumplimiento Habeas Data
* **Descripción del Fallo:**
  Si los endpoints `GET /v1/documents/{id}/download-url` o `GET /v1/policies/{id}/certificate` aceptan el UUID del documento sin validar que `document.userId === authenticatedUser.id`, un usuario autenticado podría enumerar o acceder a historias clínicas y carátulas de otros asegurados.
* **Solución Técnica Obligatoria:**
  Incorporar una guarda de autorización a nivel de objeto obligatoria (`ResourceOwnerGuard`):
  ```typescript
  if (document.userId !== request.user.id && !request.user.roles.includes('ADMIN')) {
    throw new ProblemDetailsException({
      status: 403,
      title: 'Acceso Denegado',
      detail: 'No tienes autorización para acceder a este documento.'
    });
  }
  ```

---

### `BUG-MED-01`: Manipulación Maliciosa del Payload para Desmarcar RCE Obligatoria
* **Severidad:** `MEDIUM`
* **Dominio:** Suscripción y Cumplimiento Legal (Ley 1801 de 2016)
* **Descripción del Fallo:**
  Un usuario con un perro de raza de manejo especial (ej. Pitbull) podría interceptar la petición `POST /v1/quotes/{id}/bind` y enviar `selectedAddonCodes: []` (omitiendo `RCE_LEY_1801`) para pagar una prima mensual inferior evadiendo la ley.
* **Solución Técnica Obligatoria:**
  El backend **re-evalúa determinísticamente las reglas de suscripción** al momento del *bind*. Si `breed.isSpecialHandlingBreed === true`, el backend re-anexa forzosamente el add-on de RCE y recalcula la prima antes de generar la transacción de Wompi, ignorando cualquier exclusión enviada por el cliente.

---

### `BUG-MED-02`: Pérdida de Estado de Cotización en Redirección Bancaria PSE
* **Severidad:** `MEDIUM`
* **Dominio:** Checkout y Pagos
* **Descripción del Fallo:**
  En Colombia, el flujo de PSE redirecciona al usuario al portal de su banco. Si el usuario tarda más de 15 minutos en autorizar el débito en su aplicación bancaria, la cotización original puede expirar en el backend antes de que Wompi despache el webhook de confirmación.
* **Solución Técnica Obligatoria:**
  Al generar la intención de pago (`PENDING_PAYMENT`), la cotización entra en un estado transitorio `LOCKED_FOR_PAYMENT` con extensión de vigencia de 2 horas para permitir la conciliación asíncrona del webhook bancario.

---

### `BUG-LOW-01`: Inyección de Caracteres Especiales y Emojis en Nombres de Mascotas
* **Severidad:** `LOW`
* **Dominio:** Generación de PDFs y Sanitización
* **Descripción del Fallo:**
  Dueños que nombran a sus mascotas con caracteres especiales o emojis (ej. `"Luna 🐾"` o nombres con apóstrofes o etiquetas `<script>`) provocan fallos de renderizado en librerías de generación de PDFs (Puppeteer/PDFKit) o inyecciones visuales en el certificado oficial.
* **Solución Técnica Obligatoria:**
  Sanitización estricta mediante regex en el DTO de entrada:
  `@Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{1,50}$/)` permitiendo solo nombres alfabéticos legales en español.
