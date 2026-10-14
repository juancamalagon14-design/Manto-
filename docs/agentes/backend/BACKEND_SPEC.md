# Especificación Técnica del Backend (Backend Architecture Specification)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Agente:** Agente 3 - Senior Backend Engineer  
**Stack Tecnológico:** TypeScript (Strict), NestJS, PostgreSQL 16, Redis 7, BullMQ, TypeORM, Jest  
**Fecha:** Septiembre 2026  
**Estado:** Aprobado para Implementación  

---

## 1. Principios de Ingeniería del Backend

1. **Monolito Modular con Límites de Dominio Estrictos (DDD)**:
   * Cada dominio funcional se encapsula en su propio módulo NestJS dentro de `backend/src/modules/`.
   * Comunicación sincrónica mediante servicios tipados; eventos asíncronos desacoplados mediante `@nestjs/event-emitter`.
2. **Cero Confianza en el Cliente (Zero Client Trust)**:
   * El cliente web o móvil **nunca envía precios, deducibles ni montos calculados**. El backend calcula y valida el 100% de los valores financieros.
3. **Manejo Monetario sin Punto Flotante**:
   * Todos los valores monetarios en Pesos Colombianos se manejan con el tipo nominal `ColombianPeso` como enteros (`BIGINT`), erradicando errores de redondeo IEEE 754.
4. **Respuesta de Errores Normalizada (RFC 7807 Problem Details)**:
   * Todas las respuestas de error ($4xx$ y $5xx$) devuelven `application/problem+json` con código de traza (`traceId`) y descripción precisa.
5. **Idempotencia Financiera**:
   * Las operaciones críticas (pagos, emisión, radicación de siniestros) requieren el encabezado `Idempotency-Key` (UUIDv4) con almacenamiento en Redis por 24 horas.

---

## 2. Mapa de Módulos de Dominio (18 Submódulos)

| Módulo | Responsabilidad | Dependencias Principales |
| :--- | :--- | :--- |
| **`AuthModule`** | Autenticación, JWT (15 min), Argon2id, guardas RBAC (`RolesGuard`). | `UsersModule` |
| **`UsersModule`** | Gestión de usuarios, Cédula CC/CE, consentimiento Habeas Data (Ley 1581). | `DatabaseModule` |
| **`ProductsModule`** | Catálogo de productos y ramos (Mascotas, Hogar, Autos). | `DatabaseModule` |
| **`PlansModule`** | Planes comerciales (Esencial, Tranquilidad, Total) y límites. | `ProductsModule` |
| **`CoveragesModule`** | Coberturas maestras, carencias y topes anuales/por evento. | `PlansModule` |
| **`AddonsModule`** | Catálogo de coberturas opcionales configurables (Ley 1801 RCE, Exequial). | `CoveragesModule` |
| **`EligibilityModule`** | Evaluación determinista de elegibilidad biológica (edad, especie). | `PetsModule` |
| **`PricingModule`** | Motor actuarial de cálculo de primas en Pesos Colombianos. | `EligibilityModule` |
| **`QuotesModule`** | Orquestación de cotizaciones con trazabilidad e inmutabilidad (15 días de vigencia).| `PricingModule` |
| **`PoliciesModule`** | Ciclo de vida de pólizas (`DRAFT` $\to$ `ACTIVE` $\to$ `SUSPENDED` $\to$ `CANCELLED`). | `QuotesModule`, `BillingModule` |
| **`PetsModule`** | LOB Mascotas: razas, especies, caninos de manejo especial (Ley 1801). | `DatabaseModule` |
| **`BillingModule`** | Pasarela de pagos Wompi (PSE, tarjetas tokenizadas) y facturación recurrente. | `PoliciesModule` |
| **`ClaimsModule`** | Máquina de estados de siniestros (FNOL) y motor de auto-aprobación STP ($\le \$500.000$). | `PoliciesModule`, `DocumentsModule` |
| **`ReimbursementsModule`**| Dispersión bancaria interbancaria (ACH Colombia / Transfiya / Nequi). | `ClaimsModule` |
| **`DocumentsModule`** | Bóveda de archivos S3, URLs prefirmadas, validación de Magic Bytes y ClamAV. | `DatabaseModule` |
| **`AiModule`** | Subsistema aislado de visión (mascotas) y OCR (facturas DIAN). | `DocumentsModule` |
| **`NotificationsModule`**| Despacho de notificaciones por email, SMS y WhatsApp. | EventBus |
| **`AuditModule`** | Registro inmutable de auditoría forense (`audit.audit_logs`). | `DatabaseModule` |

---

## 3. Ciclos de Vida Explícitos de Estados

### 3.1 Ciclo de Vida de Pólizas (Policy Lifecycle)
```
[DRAFT] 
   │ (Usuario completa checkout)
   ▼
[PENDING_PAYMENT] 
   │ (Confirmación de pasarela Wompi)
   ▼
[ACTIVE] ◄────────────────────────────────────────┐
   │ (Mora en pago de prima recurrente)            │ (Pago extemporáneo en periodo de gracia)
   ▼                                              │
[SUSPENDED] ──────────────────────────────────────┘
   │ (Mora superior a 30 días o solicitud de usuario)
   ▼
[CANCELLED]
   │ (Término natural de 1 año sin renovación)
   ▼
[EXPIRED]
```

### 3.2 Ciclo de Vida de Siniestros (Claims Lifecycle)
```
[DRAFT] 
   │ (Usuario envía formulario)
   ▼
[SUBMITTED] 
   │ (Escaneo antivirus completado)
   ▼
[PROCESSING] (OCR y validación de reglas)
   ├──▶ [APPROVED] (Auto-aprobado por STP si <= COP $500.000) ──▶ [PAID] (Dispersión ACH)
   ├──▶ [HUMAN_REVIEW] (Supera $500k o alerta de fraude)
   │       ├──▶ [APPROVED] ──▶ [PAID]
   │       ├──▶ [PARTIALLY_APPROVED] ──▶ [PAID]
   │       ├──▶ [REJECTED] (Causal contractual explícita)
   │       └──▶ [ADDITIONAL_INFO_REQUESTED] ──▶ [PROCESSING]
   └──▶ [REJECTED]
```

---

## 4. Trazabilidad Actuarial de Cotizaciones (Quote Traceability)

Cada cotización (`insurance.quotes`) almacena en su registro:
* `input_data`: Snapshot completo de las variables ingresadas por el cliente.
* `product_version`: Versión inmutable del producto (ej. `PET_STANDARD_v1`).
* `rules_version`: Versión del motor de reglas actuariales aplicado.
* `applied_risk_factors`: Objeto JSON con cada multiplicador exacto ($F_{\text{especie}}$, $F_{\text{raza}}$, $F_{\text{edad}}$, $F_{\text{ubicación}}$, $D_{\text{esterilizado}}$).
* `calculated_premium_cop`: Valor exacto calculado.
* `timestamp`: Fecha y hora UTC del cálculo.
Esto garantiza que una cotización pueda ser **reproducida y auditada con exactitud matemática en cualquier momento**.
