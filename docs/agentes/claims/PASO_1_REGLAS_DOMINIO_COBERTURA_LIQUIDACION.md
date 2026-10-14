# Especificación Formal de Dominio: Coberturas, Carencias y Liquidación Actuarial
## Paso 1 del Módulo de Siniestros y Reembolsos — Manto 2.0
**Emisores:** `@claims` (`manto-claims`) y `@pricing-engine` (`manto-pricing`)  
**Supervisión:** `@orchestrator` (Tech Lead & Multi-Agent Orchestrator)  
**Fecha:** 23 de Septiembre de 2026  
**Estado:** VIGENTE Y FORMALIZADO  

---

## 1. Catálogo Actuarial de Amparos, Límites Anuales y Carencias

El motor determinista de liquidación se alimenta exclusivamente del catálogo oficial de coberturas ([`pricing.constants.ts`](file:///e:/Manto%202.0/backend/src/modules/pricing/pricing.constants.ts)):

| Código de Cobertura | Nombre Comercial | Límite Anual Máximo (COP) | Días de Carencia | ¿Aplica Aporte por Evento (Deducible)? |
| :--- | :--- | :---: | :---: | :---: |
| `ACCIDENT_EMERGENCY` | Urgencias y Hospitalización por Accidente | **$3.500.000** | **0 días** | SÍ (10%, 15% o 20% según póliza) |
| `EMERGENCY_CONSULTATIONS` | Consultas Médicas Veterinarias de Urgencia | **$450.000** *(Hasta 3)* | **2 días** | SÍ (10%, 15% o 20% según póliza) |
| `DIAGNOSTIC_IMAGING_LABS` | Exámenes de Diagnóstico por Trauma | **$800.000** | **0 días** | SÍ (10%, 15% o 20% según póliza) |
| `COMMON_ILLNESSES` | Enfermedades Comunes e Infecciosas | **$5.000.000** | **30 días** | SÍ (10%, 15% o 20% según póliza) |
| `PRESCRIPTION_DRUGS` | Medicamentos Recetados Ambulatorios | **$600.000** | **30 días** | SÍ (10%, 15% o 20% según póliza) |
| `PREVENTIVE_WELLNESS` | Pack Manto Bienestar (Vacunas/Desparasitación) | **$350.000** | **0 días** | **NO (100% Cubierto, Deducible $0)** |
| `CIVIL_LIABILITY_1801` | Responsabilidad Civil Canina (Ley 1801) | **$87.545.250** *(50 SMLMV)* | **0 días** | **NO (100% Cubierto, Deducible $0)** |
| `FUNERAL_ASSISTANCE` | Asistencia Exequial y Cremación | **$1.200.000** | **30 días** | **NO (Deducible $0)** |
| `TELEMEDICINE` | Telemedicina Veterinaria 24/7 | **Ilimitado** | **0 días** | **NO (Deducible $0)** |
| `OWNER_HOSPITALIZATION_STAY` | Guardería por Hospitalización del Tomador | **$800.000** | **15 días** | **NO (Deducible $0)** |

---

## 2. Validación de Elegibilidad de la Póliza (Reglas de Suscripción)

Para que una reclamación sea admitida para trámite, debe superar 4 guardas booleanas en el servidor:

```typescript
function validarElegibilidadPoliza(policy: PolicyEntity, incidentDateStr: string): void {
  // 1. Estado activo y al día
  if (policy.status !== 'ACTIVE') {
    throw new BadRequestException(
      `Póliza ${policy.policyNumber} no está activa (Estado: ${policy.status}). Solo pólizas ACTIVE pueden radicar.`,
    );
  }

  // 2. Fecha de incidente no futura
  const incidentDate = new Date(incidentDateStr);
  const now = new Date();
  if (incidentDate.getTime() > now.getTime()) {
    throw new BadRequestException('La fecha del incidente no puede ser futura.');
  }

  // 3. Fecha dentro de la vigencia de la póliza
  const effectiveDate = new Date(policy.effectiveDate);
  const expirationDate = new Date(policy.expirationDate);
  if (incidentDate.getTime() < effectiveDate.getTime() || incidentDate.getTime() > expirationDate.getTime()) {
    throw new BadRequestException(
      `La fecha del siniestro está fuera de la vigencia contractual (${effectiveDate.toISOString()} - ${expirationDate.toISOString()}).`,
    );
  }
}
```

---

## 3. Validación de Periodos de Carencia

La carencia se calcula como la diferencia exacta en días naturales entre la fecha de inicio de vigencia de la póliza y la fecha en que ocurrió el siniestro:

$$\text{diasTranscurridos} = \left\lfloor \frac{\text{incidentDate} - \text{effectiveDate}}{1000 \times 60 \times 60 \times 24} \right\rfloor$$

```typescript
function validarCarencia(coverage: PolicyCoverage, diasTranscurridos: number): void {
  if (diasTranscurridos < coverage.waitingPeriodDays) {
    throw new BadRequestException(
      `El evento ocurrió dentro del periodo de carencia (${coverage.waitingPeriodDays} días requeridos). Días transcurridos: ${diasTranscurridos}. Causal de objeción legal Art. 1077 C.Co.`,
    );
  }
}
```

---

## 4. Algoritmo Determinista de Liquidación

La liquidación se ejecuta de forma estrictamente determinista en el servidor:

```
[ Factura DIAN ] 
       │
       ▼
1. Filtrar partidas cubiertas por el amparo:
   gastoElegibleCop = SUM(items.filter(i => i.isCovered).map(i => i.amountCop))
       │
       ▼
2. Aplicar porcentaje de deducible emitido en la póliza:
   deductibleCop = coverage.copayApplies 
       ? multiplyCop(gastoElegibleCop, coverage.deductiblePercentage)
       : 0 COP
       │
       ▼
3. Reembolso bruto:
   reembolsoBrutoCop = max(0, gastoElegibleCop - deductibleCop)
       │
       ▼
4. Control de saldo anual remanente:
   saldoRemanenteCop = max(0, coverage.annualLimitCop - sumClaimsPagadosAnoCop)
       │
       ▼
5. Reembolso neto final:
   reembolsoNetoCop = min(reembolsoBrutoCop, saldoRemanenteCop)
```

### Manejo Especial del Caso $0 COP Neto:
* Si $\text{gastoElegibleCop} \le \text{deductibleCop}$, el reembolso neto es **$0 COP**.
* **Comportamiento del Sistema:** El siniestro se registra como aprobado administrativamente con neto cero. Se notifica al cliente que el gasto fue absorbido por su aporte por evento contratado y **se inhibe la creación de órdenes en `payout_records`**.

---

## 5. Reglas de Triage: Fast-Track (<$200.000 COP) vs. Auditoría Manual

| Condición de Triage | Fast-Track (Aprobación Instantánea) | Auditoría Manual Requerida |
| :--- | :---: | :---: |
| **Monto Neto Liquidado** | **$0 < \text{Neto} < \$200.000\text{ COP}$** | $\ge \$200.000\text{ COP}$ |
| **CUFE Factura DIAN** | Válido y 0 veces reutilizado | Inexistente, inválido o duplicado |
| **Hash SHA-256 de Archivo** | 0 colisiones históricas | Colisión con factura pagada previa |
| **Total Factura vs Reclamado** | $\text{claimedAmountCop} \le \text{totalFacturaOCR}$ | Reclamado excede la factura |
| **Confianza OCR** | $\ge 0.85$ (85%) | $< 0.85$ (Baja legibilidad) |
| **Score de Riesgo Fraude** | $< 10.00 / 100$ | $\ge 10.00 / 100$ |
| **Estado Clínica Veterinaria** | Habilitada / Red Manto | En lista negra o NIT no verificable |

---

## 6. Integración con el Pipeline Técnico
Estas reglas constituyen la base inmutable para el **PASO 2: Backend Core y Persistencia** (migraciones SQL, servicios de dominio y endpoints NestJS).
