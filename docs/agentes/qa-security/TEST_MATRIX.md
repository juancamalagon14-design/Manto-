# Matriz Exhaustiva de Pruebas Automatizadas (Automated Test Matrix)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Agente:** Agente 7 - Principal QA + Security Engineer  
**Versión:** 1.0.0  
**Fecha:** Septiembre 2026  
**Estado:** Suite de Pruebas Obligatoria para Certificación de Release  

---

## 1. Cobertura por Nivel de Prueba

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PIRÁMIDE DE PRUEBAS DE MANTO                          │
└─────────────────────────────────────────────────────────────────────────────┘
  ▲
  │   [E2E: 15 Casos]            ──▶ Flujos Completos de Usuario (Playwright)
  │   [API & Seguridad: 30 Casos]──▶ Contratos REST, BOLA, RBAC y Throttling
  │   [Integración: 25 Casos]    ──▶ Concurrencia, Transacciones DB, Webhooks
  │   [Unitarias: 60+ Casos]     ──▶ Motores Actuariales, Siniestros y Reglas
  └───────────────────────────────────────────────────────────────────────────
```

---

## 2. Matriz Detallada de Casos de Prueba

### 2.1 Pruebas Unitarias del Motor Actuarial y Reglas (Pricing Engine)

| ID Caso | Módulo / Función | Datos de Entrada (Input) | Comportamiento Esperado | Criterio de Aceptación |
| :--- | :--- | :--- | :--- | :--- |
| **`TC-UNIT-01`** | `evaluateEligibility` | Cachorro de 7 semanas (49 días) | Rechazo por edad mínima | `isEligible === false`, razón: edad mínima 8 semanas. |
| **`TC-UNIT-02`** | `evaluateEligibility` | Cachorro de 8 semanas exactas (56 días)| Aceptación en límite inferior | `isEligible === true`. |
| **`TC-UNIT-03`** | `evaluateEligibility` | Perro de 8 años y 364 días (107 meses)| Aceptación en límite superior | `isEligible === true`. |
| **`TC-UNIT-04`** | `evaluateEligibility` | Perro de 9 años y 1 día (109 meses) | Rechazo por edad máxima | `isEligible === false`, derivar a Plan Senior. |
| **`TC-UNIT-05`** | `evaluateEligibility` | Especie `'RABBIT'` o `'HORSE'` | Rechazo por especie no cubierta | `isEligible === false`, especie no admitida. |
| **`TC-UNIT-06`** | `calculatePricing` | Pitbull Terrier (`isSpecialHandlingBreed`)| Inclusión forzosa Ley 1801 | Add-on `RCE_LEY_1801` incluido obligatoriamente. |
| **`TC-UNIT-07`** | `calculatePricing` | Bulldog Francés vs. Perro Criollo | Factor braquicéfalo aplicado | Prima de Bulldog es exactamente $1.35 / 0.95 \approx 1.42\times$ mayor. |
| **`TC-UNIT-08`** | `calculatePricing` | `isSterilized: true` | Descuento preventivo del 5% | Prima neta tiene un descuento exacto de $0.95\times$. |
| **`TC-UNIT-09`** | `calculatePricing` | Deducible 10% vs. 15% vs. 20% | Variación de factor deducible | Factores aplicados: 10% (1.15), 15% (1.00), 20% (0.88). |
| **`TC-UNIT-10`** | `traceability` | Mismas entradas con `PET_STANDARD_v1` | Determinismo matemático idéntico | Cero fluctuación en prima tras 1.000 ejecuciones consecutivas. |

---

### 2.2 Pruebas de Siniestros y Liquidación Determinista (Claims Settlement)

| ID Caso | Módulo / Función | Datos de Entrada (Input) | Comportamiento Esperado | Criterio de Aceptación |
| :--- | :--- | :--- | :--- | :--- |
| **`TC-CLM-01`** | `calculateReimbursement` | Factura $200.000 COP, deducible 15% (mín. $40.000) | Aplicación de deducible porcentual | Deducible = $30.000 COP $< \$40.000$ $\to$ Aplica mínimo de $40.000$. Reembolso = $160.000 COP. |
| **`TC-CLM-02`** | `calculateReimbursement` | Factura $1.000.000 COP, deducible 15% | Aplicación de deducible porcentual | Deducible = $150.000 COP. Reembolso = $850.000 COP. |
| **`TC-CLM-03`** | `calculateReimbursement` | Reclamo neto $4.000.000 COP, saldo póliza $2.500.000 | Respeto estricto del saldo remanente | Reembolso topado exactamente en $2.500.000 COP. |
| **`TC-CLM-04`** | `evaluateStpEligibility` | Factura limpia $420.000 COP, carencias OK, FraudScore 5 | Aprobación automática (STP) | `isStpEligible === true` $\to$ Estado `APPROVED`. |
| **`TC-CLM-05`** | `evaluateStpEligibility` | Factura $650.000 COP (supera umbral $500k) | Enrutamiento a Auditor Humano | `isStpEligible === false` $\to$ Estado `PENDING_MANUAL_REVIEW`. |
| **`TC-CLM-06`** | `evaluateStpEligibility` | Siniestro ocurrido a las 24 hrs de emisión (Enfermedad)| Rechazo por periodo de carencia | Partida no cubierta (Carencia de enfermedad: 14 días). |

---

### 2.3 Pruebas de Integración y Concurrencia (PostgreSQL & Redis)

| ID Caso | Escenario de Prueba | Metodología de Ejecución | Comportamiento Esperado |
| :--- | :--- | :--- | :--- |
| **`TC-INT-01`** | **Condición de Carrera en Siniestros** | Dos peticiones simultáneas de $800k COP sobre póliza con $1M de saldo | Transacción con `PESSIMISTIC_WRITE`: La primera aprueba $800k; la segunda solo aprueba $200k. |
| **`TC-INT-02`** | **Duplicidad de Factura DIAN (CUFE)** | Dos reclamos con el mismo CUFE en diferentes cuentas de usuario | El segundo reclamo es rechazado por índice único en BD y marca alerta de fraude. |
| **`TC-INT-03`** | **Idempotencia en Checkout** | Envío repetido del mismo `Idempotency-Key` en compra de póliza | Se ejecuta un solo cobro en Wompi y se retorna la misma respuesta en caché. |
| **`TC-INT-04`** | **Expiración de Cotización** | Intento de vinculación (`bind`) a los 16 días de generada | Error RFC 7807: `Cotización expirada. Por favor cotiza nuevamente.` |

---

### 2.4 Pruebas de Seguridad y Resiliencia (API Security)

| ID Caso | Escenario de Amenaza | Payload / Acción Maliciosa | Resultado Esperado |
| :--- | :--- | :--- | :--- |
| **`TC-SEC-01`** | **Ataque BOLA/IDOR** | Usuario `A` intenta consultar `GET /v1/claims/{id_de_usuario_B}` | Respuesta `404 Not Found` (Cero fuga de información). |
| **`TC-SEC-02`** | **Manipulación de Precios** | Cliente envía `monthlyPremiumCop: 100` en payload de checkout | El backend ignora el valor del cliente y cobra la tarifa calculada en servidor. |
| **`TC-SEC-03`** | **Archivo Malicioso Camuflado** | Archivo `.exe` o script bash renombrado a `factura.jpg` | Rechazo inmediato por inspección de *Magic Bytes* (`422 Unprocessable Entity`). |
| **`TC-SEC-04`** | **Ataque de Pixel Flood** | Imagen de 100 KB con dimensiones de $20000 \times 20000 \text{ px}$ | Rechazo preventivo por superar el límite dimensional de $4096 \text{ px}$. |
| **`TC-SEC-05`** | **Abuso de Tasa (Rate Limiting)** | Disparo de 20 peticiones en 1 minuto a `/v1/quotes/calculate` | Respuesta `429 Too Many Requests` tras la petición número 15. |
| **`TC-SEC-06`** | **Timeout de IA (Graceful Fallback)**| Simulación de retardo de 4.000 ms en llamada a proveedor de visión | El sistema salta a los 3.000 ms y ofrece el formulario manual sin error 500. |

---

### 2.5 Pruebas de Rendimiento y Experiencia (< 60 Segundos)

| Métrica Evaluada | Criterio de Éxito | Metodología de Medición |
| :--- | :--- | :--- |
| **Latencia del Cotizador (API)** | $\le 85\text{ ms}$ (Percentil 95) | Pruebas de carga con k6 simulando 100 usuarios concurrentes. |
| **Inferencia de Visión con IA** | $\le 1.800\text{ ms}$ en red normal | Medición de tiempo de respuesta de `POST /v1/ai/pet-vision`. |
| **Tiempo Total de Cotización de Usuario**| $\le 60\text{ segundos}$ de punta a punta | Pruebas de usabilidad E2E en dispositivos móviles Android y iOS sobre red 4G simulada. |
