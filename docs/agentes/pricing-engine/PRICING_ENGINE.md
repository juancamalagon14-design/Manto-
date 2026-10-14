# Motor de Tarificación Actuarial Dinámica y Reglas Deterministas (Pricing Engine)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Agente:** Agente 4 - Insurance Product + Pricing Engineer  
**Versión de Reglas:** `PET_RULES_v2.0.0` (Modelo de Tarifa Base Dinámica a la Medida)  
**Moneda Base:** Pesos Colombianos (COP)  
**Fecha:** Septiembre 2026  
**Estado:** Aprobado para Implementación  

---

## 1. Doctrina de Tarificación a la Medida (Tailored Baseline Paradigm)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 NUEVA FILOSOFÍA DE TARIFICACIÓN DINÁMICA                    │
│                                                                             │
│ En lugar de planes rígidos empaquetados (Bronce/Plata/Oro), el sistema:     │
│ 1. Recibe el análisis de la IA validado: Especie + Raza + Tamaño + Edad.    │
│ 2. El actuario calcula una TARIFA BASE PERSONALIZADA con COBERTURAS MÍNIMAS │
│    esenciales adaptadas al perfil biológico y geográfico de esa mascota.    │
│ 3. A partir de esa base, el cliente expande modularmente con ADD-ONS.       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Contratos de TypeScript del Motor de Tarifas Dinámicas

```typescript
export type ColombianPeso = number & { readonly __brand: unique symbol };

export type SizeCategory = 'TOY' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT';

export interface PricingEngineInput {
  readonly productId: string;               // e.g. 'PET_HEALTH'
  readonly productVersion: string;         // e.g. 'PET_STANDARD_v2'
  readonly species: 'DOG' | 'CAT';
  readonly breedId: string;                 // ID en catálogo actuarial
  readonly sizeCategory: SizeCategory;      // Talla / Peso de la mascota
  readonly ageInMonths: number;            // Edad en meses
  readonly gender?: 'MALE' | 'FEMALE';
  readonly locationCity: string;           // 'BOGOTA', 'MEDELLIN', 'CALI', 'OTHER'
  readonly isSterilized: boolean;          // Descuento del 5%
  readonly selectedDeductiblePercentage: 10 | 15 | 20;
  readonly billingFrequency: 'MONTHLY' | 'ANNUAL';
  readonly selectedAddonCodes?: string[];  // Add-ons modulares elegidos por el usuario
}

export interface MinimumBaselineCoverage {
  readonly code: string;
  readonly name: string;
  readonly annualLimitCop: ColombianPeso;
  readonly eventLimitCop?: ColombianPeso;
  readonly waitingPeriodDays: number;
  readonly isMandatoryLegal: boolean;       // true si es Ley 1801 RCE
  readonly rationale: string;              // Justificación médica/actuarial
}

export interface PricingEngineOutput {
  readonly isEligible: boolean;
  readonly ineligibilityReason?: string;
  readonly currency: 'COP';
  readonly tailoredBaseMonthlyPremiumCop: ColombianPeso; // Tarifa base pura calculada
  readonly totalMonthlyPremiumCop: ColombianPeso;        // Base + Add-ons activos
  readonly totalAnnualPremiumCop: ColombianPeso;
  readonly appliedDeductiblePercentage: number;
  readonly minDeductibleCop: ColombianPeso;
  readonly baselineAnnualCoverageLimitCop: ColombianPeso;
  readonly minimumBaselineCoverages: MinimumBaselineCoverage[];
  readonly selectedAddons: Array<{
    readonly code: string;
    readonly name: string;
    readonly monthlyPriceCop: ColombianPeso;
    readonly isMandatory: boolean;
  }>;
  readonly availableAddonsForExpansion: Array<{
    readonly code: string;
    readonly name: string;
    readonly monthlyPriceCop: ColombianPeso;
    readonly description: string;
  }>;
  readonly explicitExclusionsReference: string[];
  readonly productVersion: string;
  readonly rulesVersion: string;
  readonly calculationMetadata: {
    readonly pureBaseRateCop: number;
    readonly speciesFactor: number;
    readonly breedFactor: number;
    readonly sizeFactor: number;
    readonly ageFactor: number;
    readonly locationFactor: number;
    readonly sterilizationDiscount: number;
    readonly deductibleFactor: number;
    readonly timestampUtc: string;
  };
}
```

---

## 3. Algoritmo Actuarial de Tarificación

$$\text{TarifaBaseNeta} = \text{TasaPura} \times F_{\text{especie}} \times F_{\text{raza}} \times F_{\text{tamaño}} \times F_{\text{edad}} \times F_{\text{ubicación}} \times (1 - D_{\text{esterilizado}}) \times F_{\text{deducible}}$$
$$\text{PrimaMensualFinalCOP} = \text{round}(\text{TarifaBaseNeta}) + \sum \text{AddonsMensuales}$$
$$\text{PrimaAnualFinalCOP} = \text{round}(\text{PrimaMensualFinalCOP} \times 11) \quad \text{(11 meses por pago anual)}$$

### 3.1 Matrices Actuariales (Valores de Calibración Técnica MVP)
* **Tasa Pura Base**: COP $28.000$ / mes.
* **1. Factor Especie ($F_{\text{especie}}$)**: Perro: $1.00$ | Gato: $0.90$.
* **2. Factor Raza ($F_{\text{raza}}$)**:
  * Criollo / Mestizo: $0.95$
  * Labrador / Golden / Schnauzer: $1.00$
  * Braquicéfalo (Bulldog Francés, Pug, Persa): $1.35$
  * Razas Gigantes (Gran Danés, San Bernardo): $1.40$
* **3. Factor Tamaño / Peso ($F_{\text{tamaño}}$)**:
  * `TOY` ($\le 5\text{ kg}$): $0.95$
  * `SMALL` ($5-10\text{ kg}$): $1.00$
  * `MEDIUM` ($10-25\text{ kg}$): $1.05$
  * `LARGE` ($25-45\text{ kg}$): $1.15$
  * `GIANT` ($>45\text{ kg}$): $1.30$
* **4. Factor Edad ($F_{\text{edad}}$)**:
  * $2 \text{ a } 11 \text{ meses}$ (Cachorro/Gatito): $1.08$
  * $12 \text{ a } 48 \text{ meses}$ (Adulto Joven): $1.00$
  * $49 \text{ a } 84 \text{ meses}$ (Adulto Maduro): $1.25$
  * $85 \text{ a } 107 \text{ meses}$ (Senior): $1.65$
* **5. Factor Ubicación ($F_{\text{ubicación}}$)**: Bogotá: $1.05$ | Medellín/Cali: $1.00$ | Otras: $0.95$.
* **6. Descuento Esterilización**: $5\%$ ($0.05$).
* **7. Factor Deducible**: 10% ($1.15$) | 15% ($1.00$) | 20% ($0.88$).

---

## 4. Asignación de Coberturas Mínimas y Expansión Modular

### 4.1 Coberturas Mínimas Deterministas (Paquete Base)
1. **Accidentes y Traumas de Urgencia**: Hasta COP $3.500.000$ / año.
2. **Consultas de Urgencia**: 3 consultas al año.
3. **Cirugías y Hospitalización por Accidente**: Incluido en límite de accidentes.
4. **Sublímite Braquicéfalo / Tamaño**: Sublímites específicos activados automáticamente según fenotipo.
5. **RCE Ley 1801 (50 SMLMV)**: Anexada forzosamente si la raza es de manejo especial.

### 4.2 Catálogo de Expansión de Add-ons (Opcionales)
* **Asistencia Exequial y Cremación**: +$9.900 / mes.
* **Telemedicina Veterinaria 24/7**: +$6.900 / mes.
* **Ampliación a Enfermedades Comunes e Infecciosas**: +$24.900 / mes.
* **Medicamentos Recetados Ambulatorios**: +$12.900 / mes.
* **Guardería Canina por Hospitalización del Dueño**: +$4.900 / mes.
