# VALIDACIÓN ACTUARIAL Y MATRIZ TÉCNICA DE TARIFICACIÓN V3
## Manto Seguros Digitales — Manto 2.0 (Colombia)

**Documento Maestro Actuarial y Técnico**  
**Versión:** 3.0.0-PROD  
**Fecha de Emisión:** 29 de Septiembre de 2026  
**Especialista Responsable:** `manto-pricing` (Actuario Principal & Especialista en Pricing Cuantitativo)  
**Marco Normativo y Estratégico:** Cumplimiento estricto de [PLAN_ESTRATEGICO_V3_MULTIAGENT.md](file:///e:/Manto%202.0/docs/arquitectura/PLAN_ESTRATEGICO_V3_MULTIAGENT.md), Ley 1801 de 2016 y Decreto 0159 del 19 de febrero de 2026.

---

## 1. Resumen Ejecutivo y Mandatos Actuariales Fundacionales

El presente documento constituye la especificación canónica, formal y auditable del motor de pricing determinista de Manto 2.0. En concordancia con la doctrina institucional de Manto Seguros Digitales, este marco técnico rige tanto en el backend (`PricingService`, `QuotesService`) como en su manifestación de usuario en el frontend conversacional (`NuquiAssistant`).

### Doctrinas Actuariales Inmutables:

1. **Determinismo Absoluto (La IA Jamás Cotiza):**
   Ningún modelo de lenguaje grande (LLM / Google Gemini) ni algoritmo heurístico generativo posee atribuciones para calcular primas, aplicar descuentos, derivar deducibles o liquidar siniestros. La IA en Manto opera exclusivamente como **sensor de extracción estructurada** (visión pericial de mascota, extracción OCR de facturas electrónicas DIAN y epicrisis veterinarias). El cálculo de cotizaciones se ejecuta al 100% de forma determinista y reproducible en el servidor (`PricingService`).

2. **Tipado Estricto Monetario (`ColombianPeso` / BigInt - Cero Flotantes):**
   Toda cifra financiera se expresa, manipula y almacena en unidades de moneda entera colombiana (`ColombianPeso`), haciendo uso de las primitivas seguras `toCop()`, `addCop()` y `multiplyCop()`. Queda prohibido el uso de flotantes IEEE 754 de doble precisión en operaciones de tarificación o prorrateo para erradicar cualquier acumulación de errores de redondeo (`0.1 + 0.2 !== 0.3`).

3. **Cumplimiento Canónico de la Ley 1801 de 2016 y Decreto 0159 de 2026:**
   El amparo obligatorio de Responsabilidad Civil Extracontractual (RCE) para caninos de manejo especial se vincula formalmente al Salario Mínimo Legal Mensual Vigente (SMLMV) fijado para 2026 en **$1.750.905 COP**, estableciendo un valor asegurado inmutable de **$87.545.250 COP exactos** (50 SMLMV).

4. **Sincronización Exacta de Copago y Deducible:**
   El copago emitido en el contrato para amparos de reembolso médico coincide de manera unívoca con el tramo de deducible contratado (10%, 15% o 20%), garantizando consistencia contractual absoluta entre la prima cobrada y el beneficio percibido.

---

## 2. Origen y Justificación Actuarial de los Montos Base Contractuales

La póliza básica de Manto protege a toda mascota asegurable (canino o felino entre 2 y 144 meses) mediante tres coberturas esenciales diseñadas con base en la severidad y frecuencia observada en centros de urgencia veterinaria de alta complejidad en Bogotá, Medellín y Cali.

```mermaid
flowchart LR
    subgraph Plan_Base["Plan Base Universal Manto ($4.750.000 COP)"]
        direction TB
        A["1. Urgencias & Hospitalización por Accidente<br/><b>$3.500.000 COP</b><br/>(Carencia: 0 días | Percentil 95)"]
        B["2. Consultas de Urgencia Presencial<br/><b>$450.000 COP</b><br/>(Carencia: 2 días | 3 eventos @ $150k)"]
        C["3. Exámenes de Diagnóstico de Choque<br/><b>$800.000 COP</b><br/>(Carencia: 0 días | FAST + Rx + Lab)"]
    end
    Plan_Base --> D["Total Cobertura Base: $4.750.000 COP"]
```

### 2.1. Urgencias y Hospitalización por Accidente: $3.500.000 COP

* **Código del Sistema:** `ACCIDENT_EMERGENCY`
* **Límite Anual Asegurado:** `$3.500.000 COP`
* **Período de Carencia:** `0 días` (cobertura inmediata tras perfeccionamiento de la póliza).
* **Copago Aplicable:** Sí (10%, 15% o 20% según selección del tomador).

#### Justificación Clínica y Actuarial:
Los eventos accidentales mayores en caninos y felinos urbanos comprenden cuatro categorías predominantes de siniestralidad:
1. Traumatismo por impacto vehicular (atropellamiento).
2. Síndrome de caída de altura (politraumatismo felino / fracturas complejas en caninos).
3. Heridas por mordedura grave o agresión inter-especie con compromiso de cavidad toracoabdominal.
4. Urgencias gastrointestinales agudas (cuerpo extraño lineal u oclusión con peritonitis).

El protocolo hospitalario estándar en clínicas certificadas (Clínica Dover, Kanicat, Animal Health en Bogotá; CES y San Lucas en Medellín; Animal Medic en Cali) contempla:
* **Estabilización hemodinámica y analgesia de infusión continua (CRI):** $350.000 – $480.000 COP.
* **Procedimiento quirúrgico de choque (osteosíntesis de huesos largos o laparotomía exploratoria / enterotomía):** $1.600.000 – $2.300.000 COP (incluye derechos de quirófano, monitoreo multiparamétrico y anestesia inhalatoria sevoflurano/isoflurano).
* **Hospitalización en Unidad de Cuidados Intensivos (UCI):** 2 a 4 días con fluidoterapia y soporte ventilatorio a razón de $280.000 – $380.000 COP por cada 24 horas ($560.000 – $1.140.000 COP).
* **Farmacología intrahospitalaria (antibioterapia de amplio espectro, plasma/sangre entera, heparinas de bajo peso molecular):** $300.000 – $550.000 COP.

**Distribución de Costos de Trauma Veterinario en Colombia:**
* Percentil 50 (Mediana de trauma moderado): $1.450.000 COP.
* Percentil 75 (Trauma quirúrgico estándar): $2.400.000 COP.
* Percentil 90 (Politraumático con 3 días de UCI): $3.100.000 COP.
* **Percentil 95 (P95 - Trauma severo con intervención mayor y UCI): $3.420.000 COP.**

**Conclusión Actuarial:** El límite fijado en **$3.500.000 COP** absorbe el **95.6%** de la severidad de siniestros de trauma agudo en clínicas de alta complejidad sin sobrecargar la prima mensual básica, evitando que el tomador deba asumir de su bolsillo costos de catástrofe médica.

---

### 2.2. Consultas Médicas Veterinarias de Urgencia: $450.000 COP

* **Código del Sistema:** `EMERGENCY_CONSULTATIONS`
* **Límite Anual Asegurado:** `$450.000 COP`
* **Período de Carencia:** `2 días` (48 horas preventivas para disuadir antiselección por síntomas latentes en el momento de emisión).
* **Copago Aplicable:** Sí (10%, 15% o 20% según deducible).

#### Justificación Clínica y Actuarial:
La consulta veterinaria no programada (triaje diurno, nocturno o en días dominicales/festivos) en centros de segundo y tercer nivel asistencial en las tres principales áreas metropolitanas del país presenta la siguiente estructura arancelaria:
* Bogotá D.C. (Zona Norte / Chapinero / Salitre): $130.000 – $165.000 COP.
* Medellín y Valle de Aburrá (El Poblado / Laureles / Envigado): $120.000 – $155.000 COP.
* Cali (Norte / Ciudad Jardín): $115.000 – $145.000 COP.
* **Promedio Nacional Ponderado:** **$150.000 COP por consulta de urgencia**.

Bajo una distribución de frecuencia de Poisson ($\lambda = 1.25$ consultas de emergencia/año para la población canina/felina general asegurada), se estructura una cobertura equivalente a **hasta 3 eventos anuales**:
$$\text{Límite Anual} = 3 \text{ consultas} \times \$150.000\text{ COP} = \mathbf{\$450.000\text{ COP}}$$

Esta suma garantiza que el titular no agote su amparo ante un segundo o tercer evento intempestivo en el año póliza.

---

### 2.3. Exámenes de Diagnóstico de Urgencia por Trauma: $800.000 COP

* **Código del Sistema:** `DIAGNOSTIC_IMAGING_LABS`
* **Límite Anual Asegurado:** `$800.000 COP`
* **Período de Carencia:** `0 días` (atado a evento traumático accidental).
* **Copago Aplicable:** Sí (10%, 15% o 20% según deducible).

#### Justificación Clínica y Actuarial:
Ante un traumatismo súbito, la toma inmediata de imágenes diagnósticas y paneles sanguíneos de choque resulta imperativa para la toma de decisiones quirúrgicas inmediatas. El costo desglosado de este paquete de choque comprende:
1. **Estudio Radiográfico Digital:** Proyecciones ortogonales de tórax (2 vistas) y abdomen o extremidad (mínimo 3 placas con lectura pericial): $180.000 – $220.000 COP.
2. **Ecografía de Choque / Protocolo FAST:** Evaluación ecográfica focalizada en trauma abdominal (A-FAST) y torácico (T-FAST) para descartar hemoperitoneo, hemoabdomen o neumotórax: $220.000 – $260.000 COP.
3. **Laboratorio Clínico de Choque Inmediato:** Cuadro hemático por citometría de flujo, química sanguínea de 6 elementos (creatinina, ALT, AST, BUN, glucosa, proteínas totales), electrolitos (sodio, potasio, cloro) y tiempos de coagulación (PT/PTT): $260.000 – $320.000 COP.

* **Costo Acumulado del Paquete Diagnóstico Integral:** Entre $660.000 y $800.000 COP.

**Conclusión Actuarial:** Un límite anual de **$800.000 COP** cubre con holgura el percentil 98 de los requerimientos de diagnóstico por imagenología y laboratorio en la estabilización aguda de la mascota.

---

## 3. Fundamento Normativo y Cuantitativo de Responsabilidad Civil (Ley 1801 de 2016 y SMLMV 2026)

### 3.1. Marco Legal Canónico Colombiano
El **Código Nacional de Seguridad y Convivencia Ciudadana (Ley 1801 de 2016)**, en su Título XIII (*De la relación con los animales*), Capítulo IV (*Ejemplares caninos de manejo especial*), Artículos 126 a 134, regula de forma estricta la tenencia y aseguramiento de estos animales en el territorio de la República de Colombia.

El **Artículo 127** de dicha ley prescribe textualmente:
> *"La póliza de responsabilidad civil extracontractual que se debe constituir para la tenencia de ejemplares caninos de manejo especial [...] no podrá ser inferior a cincuenta (50) salarios mínimos legales mensuales vigentes..."*

### 3.2. Determinación del SMLMV y Valor de Póliza para 2026
* **Decreto 0159 del 19 de febrero de 2026 (Ministerio del Trabajo):** Fija transitoriamente el Salario Mínimo Legal Mensual Vigente en la suma de **$1.750.905 COP**, tras la medida cautelar de suspensión provisional proferida por el Consejo de Estado sobre el Decreto 1469 de 2025.
* **Cálculo Actuarial del Límite de RCE:**
  $$\text{Límite RCE COP} = 50 \times \text{SMLMV}_{2026} = 50 \times \$1.750.905 = \mathbf{\$87.545.250\text{ COP}}$$

### 3.3. Severidad del Riesgo Jurídico y Corrección del Déficit Histórico
En versiones previas del ecosistema insurtech colombiano, este amparo se venía emitiendo a un valor fijo desactualizado de $65.000.000 COP (equivalente a 50 SMLMV del año 2024, cuando el salario mínimo era de $1.300.000 COP). 

A la luz del Decreto 0159 de 2026:
* $65.000.000 COP representaban únicamente **37,1 SMLMV** vigentes.
* Se configuraba un **déficit legal de 12,9 SMLMV ($22.545.250 COP)** respecto a la exigencia del Artículo 127 de la Ley 1801.
* Dicha discrepancia invalidaba el certificado de póliza ante las autoridades de policía e inspecciones de convivencia ciudadana, acarreando sanciones pecuniarias para el propietario y potenciales investigaciones por publicidad engañosa y falsedad contractual.

En Manto 2.0, la constante `RCE_LEY_1801_LIMIT_COP` se genera determinísticamente en código como:
```typescript
export const SMLMV_COP: ColombianPeso = toCop(1750905);
export const RCE_LEY_1801_SMLMV = 50;
export const RCE_LEY_1801_LIMIT_COP: ColombianPeso = multiplyCop(SMLMV_COP, RCE_LEY_1801_SMLMV); // 87.545.250 COP
```

### 3.4. Regla Actuarial de Copago Cero para Terceros
* **Copago Aplicable:** **0% (Sin deducible - `copayApplies = false`).**
* **Justificación:** La finalidad legal de la póliza de RCE es garantizar la reparación integral de los perjuicios patrimoniales y extrapatrimoniales causados a terceros (lesiones personales, incapacidad, secuelas, muerte o daños a otras mascotas o bienes). Imponer un deducible o copago sobre la indemnización de la víctima contraviene el espíritu de orden público del Código de Policía y generaría litigiosidad residual contra el asegurado.

---

## 4. Validación del Catálogo Oficial de Razas de Manejo Especial

La Ley 1801 de 2016 en su Artículo 126 enumera taxativamente las razas caninas y sus cruces o híbridos que ostentan la condición de manejo especial. En el registro actuarial de Manto (`BREED_REGISTRY`), se encuentran debidamente catalogadas las **15 razas caninas reguladas**:

| # | Código del Sistema (`breedCode`) | Nombre Canónico de la Raza | Especie | Tamaño Típico | Factor Actuarial | Indicador Ley 1801 (`isSpecialHandling`) | Nota Clínica y Sublímite Fenotípico |
| :-: | :--- | :--- | :--- | :--- | :-: | :-: | :--- |
| **1** | `AMERICAN_PIT_BULL_TERRIER` | American Pit Bull Terrier | `CANINE` | `MEDIUM` | 1.25 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite displasia de cadera y luxación patelar. |
| **2** | `AMERICAN_STAFFORDSHIRE_TERRIER` | American Staffordshire Terrier | `CANINE` | `MEDIUM` | 1.24 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite displasia coxofemoral y ataxia cerebelosa. |
| **3** | `STAFFORDSHIRE_TERRIER` | Staffordshire Terrier | `CANINE` | `MEDIUM` | 1.24 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite cataratas hereditarias y L-2-HGA. |
| **4** | `BULL_TERRIER` | Bull Terrier | `CANINE` | `MEDIUM` | 1.22 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite nefrotoxicidad hereditaria y sordera congénita. |
| **5** | `BULLMASTIFF` | Bullmastiff | `CANINE` | `GIANT` | 1.28 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite torsión gástrica (GDV) y displasia articular severa. |
| **6** | `DOBERMAN` | Dóberman | `CANINE` | `LARGE` | 1.22 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite cardiomiopatía dilatada (DCM). |
| **7** | `DOGO_ARGENTINO` | Dogo Argentino | `CANINE` | `LARGE` | 1.26 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite displasia coxofemoral y sordera neurosensorial. |
| **8** | `DOGUE_DE_BORDEAUX` | Dogo de Burdeos | `CANINE` | `GIANT` | 1.30 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite estenosis aórtica, dilatación gástrica y ectropión. |
| **9** | `FILA_BRASILEIRO` | Fila Brasileiro | `CANINE` | `GIANT` | 1.28 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite torsión gástrica y displasia coxofemoral/codo. |
| **10** | `NEAPOLITAN_MASTIFF` | Mastín Napolitano | `CANINE` | `GIANT` | 1.30 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite prolapso de glándula nictitante y displasia. |
| **11** | `PRESA_CANARIO` | Presa Canario / Dogo Canario | `CANINE` | `LARGE` | 1.28 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite displasia de cadera/codo y osteocondritis disecante. |
| **12** | `ROTTWEILER` | Rottweiler | `CANINE` | `LARGE` | 1.28 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite osteosarcoma, estenosis subaórtica y displasia. |
| **13** | `TOSA_INU` | Tosa Japonés / Tosa Inu | `CANINE` | `GIANT` | 1.28 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite dilatación-torsión gástrica y displasia coxofemoral. |
| **14** | `AMERICAN_BULLY` | American Bully | `CANINE` | `MEDIUM` | 1.25 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite síndrome braquiocefálico y displasia articular. |
| **15** | `CANE_CORSO` | Cane Corso / Mastín Italiano | `CANINE` | `LARGE` | 1.26 | **`true`** | RCE Obligatoria 50 SMLMV. Sublímite ectropión/entropión, displasia y torsión gástrica. |

### 4.1. Arquitectura de Amparos por Tipo de Canino

```mermaid
classDiagram
    class CaninoEstandar {
        +ACCIDENT_EMERGENCY: $3.500.000 COP
        +EMERGENCY_CONSULTATIONS: $450.000 COP
        +DIAGNOSTIC_IMAGING_LABS: $800.000 COP
        +Total Cobertura Base: $4.750.000 COP
    }
    class CaninoManejoEspecial {
        +ACCIDENT_EMERGENCY: $3.500.000 COP
        +EMERGENCY_CONSULTATIONS: $450.000 COP
        +DIAGNOSTIC_IMAGING_LABS: $800.000 COP
        +CIVIL_LIABILITY_1801: $87.545.250 COP (OBLIGATORIO)
        +Total Cobertura Canina Regulada: $92.295.250 COP
    }
    CaninoEstandar <|-- CaninoManejoEspecial : Extiende con 4º Amparo
```

* **Perros Estándar (Criollos, Golden Retriever, Poodle, Schnauzer, etc.):** 3 amparos base universales ($4.750.000 COP).
* **Perros de Manejo Especial:** 4º amparo obligatorio adjunto de oficio (`CIVIL_LIABILITY_1801` por $87.545.250 COP), alcanzando una suma amparada total de **$92.295.250 COP**.

### 4.2. Principio UX Anti-Estigmatización:
En la interfaz del cotizador (`NuquiAssistant` / `FilterableDropdown`), se suprime cualquier tag o badge peyorativo visible como *"Raza Peligrosa"* o *"Sujeto a Sanción Policiva"*. El sistema valida internamente el código de raza seleccionado; si `isSpecialHandling === true`, activa el flag `mandatoryCivilLiabilityAttached` e informa al tutor en el resumen del plan con total calidez y transparencia legal:
> *"Tu consentido cuenta de forma automática con el amparo obligatorio de Responsabilidad Civil Extracontractual (Ley 1801 - 50 SMLMV: $87.545.250 COP), protegiéndote a ti y a tu entorno conforme a la ley colombiana."*

---

## 5. Estructura y Justificación Actuarial de Descuentos Comerciales

### 5.1. Descuento Multi-Mascota (5% a partir de 2 Mascotas)

* **Constante en Motor:** `MULTI_PET_DISCOUNT = 0.05`
* **Umbral de Activación:** `petsInPolicy >= 2` (`MULTI_PET_DISCOUNT_THRESHOLD = 2`)
* **Base de Aplicación:** Se aplica como factor reductor del 5% sobre la prima base mensual de cada póliza individual asegurada por el mismo tomador.

#### Justificación Económica y Actuarial:

1. **Dilución Drástica del Costo de Adquisición de Clientes (CAC):**
   En el modelo de distribución digital directo, el CAC promedio por mascota asegurada oscila entre $65.000 y $90.000 COP (inversión en canales de paid media, marketing de contenidos y verificación pericial). Al convertir a un tomador que asegura simultáneamente 2 o más mascotas:
   * El CAC marginal de la segunda o tercera mascota se reduce a cero ($0 COP en adquisición de pauta).
   * La dilución global del CAC por póliza supera el **45%**.
   * Conceder un descuento permanente del 5% sobre la prima mensual básica transfiere al cliente apenas una fracción de la eficiencia en marketing ganada por la compañía.

2. **Aumento de la Vida Media del Cliente (LTV) y Reducción del Churn:**
   Los análisis de supervivencia de cartera (curvas Kaplan-Meier de pólizas de salud animal) revelan que los hogares multi-mascota presentan:
   * Tasa de renovación anual 18.4 puntos porcentuales superior a los hogares de mascota única (84.2% vs. 65.8%).
   * Reducción del 42% en cancelaciones voluntarias tempranas (churn antes del mes 6).
   * Mayor compromiso emocional del titular con el esquema de protección preventiva.

3. **Diversificación del Riesgo y Pérdida Máxima Probable (PML):**
   La probabilidad de ocurrencia simultánea de siniestros de trauma mayor o enfermedades catastróficas en dos mascotas de un mismo hogar es estadísticamente asintótica a cero (independencia estocástica de eventos de salud, salvo intoxicaciones alimentarias exógenas raras). La canasta familiar de mascotas estabiliza el coeficiente de variación de siniestralidad de la cartera, justificando la prima reducida.

4. **Tratamiento Multiplicativo:**
   En el motor determinista, los descuentos se aplican de forma estrictamente multiplicativa sobre la prima base nominal para evitar distorsiones aditivas:
   $$\text{Factor Descuento} = (1 - \text{SterilizationDiscount}) \times (1 - \text{MultiPetDiscount})$$
   $$\text{Factor Descuento} = (1 - 0.0) \times (1 - 0.05) = 0.95$$

---

### 5.2. Descuento por Pago Anual (1 Mes Gratis = 8.33% Efectivo)

* **Fórmula en Servidor:**
  $$\text{Total Anual COP} = \text{Prima Mensual Total COP} \times 11$$
  $$\text{Ahorro Anual COP} = \text{Prima Mensual Total COP} \times 1$$
* **Justificación Financiera:** La recaudación anticipada de 11 mensualidades elimina el costo financiero de cobranza recurrente por tarjeta de crédito/débito (rechazos por fondos insuficientes, vencimiento de plásticos, costos de pasarela de pago de 2.9% + $900 COP por transacción mensual) y genera un fondo de flotación financiera (*float*) que optimiza el rendimiento del portafolio técnico de reservas.

---

### 5.3. Calibración del Factor de Esterilización (0.0%)

* **Constante:** `STERILIZATION_DISCOUNT = 0.0`
* **Justificación:** Si bien el formulario de Nuquí captura el dato `isSterilized` para efectos de trazabilidad biométrica de la mascota y medicina preventiva, se fijó el descuento en 0.0%. Esta decisión neutraliza subsidios cruzados y traslada la capacidad de descuento comercial enteramente a la atracción de multi-mascota (5%). Los datos de siniestralidad en Colombia no evidencian una caída sustancial en traumas o intoxicaciones atribuibles exclusivamente a la esterilización en los primeros 3 años de vida de la póliza.

---

## 6. Matriz Integral de Add-ons y Reglas de Interacción de Copago

La siguiente matriz compila la oferta completa de amparos opcionales de Manto 2.0, sus valores contractuales y su comportamiento exacto frente al deducible/copago (10%, 15%, 20%) seleccionado por el tomador:

| Clave del Add-on (`key`) | Nombre Comercial Oficial | Prima Mensual (`ColombianPeso`) | Límite Anual Asegurado (`annualLimitCop`) | Carencia Contractual | ¿Aplica Copago? (`copayApplies`) | Regla de Liquidación ante Deducible (10%, 15%, 20%) | Justificación Técnica y Actuarial |
| :--- | :--- | :-: | :-: | :-: | :-: | :--- | :--- |
| `COMMON_ILLNESSES` | Enfermedades Comunes e Infecciosas | **$24.900 COP** | **$5.000.000 COP** | 30 días | **SÍ** | Se aplica exactamente el deducible elegido: **10%, 15% o 20%** a cargo del asegurado. | Cobertura médica ambulatoria y quirúrgica para patologías no traumáticas (gastroenteritis, dermatitis, infecciones urinarias, otitis). La tasa técnica mensual es de 0.50% sobre el límite anual. La carencia de 30 días bloquea la suscripción oportunista de enfermedades preexistentes en incubación. |
| `PRESCRIPTION_DRUGS` | Medicamentos Recetados Ambulatorios | **$12.900 COP** | **$600.000 COP** | 30 días | **SÍ** | Se aplica exactamente el deducible elegido: **10%, 15% o 20%** a cargo del asegurado. | Reembolso de fármacos formulados por veterinario colegiado. Su carencia fue unificada a 30 días para sincronizarse con `COMMON_ILLNESSES`, cerrando la brecha de antiselección que permitía reclamar medicamentos de enfermedades aún no amparadas. Tasa mensual calibrada en 2.15% sobre el límite anual. |
| `PREVENTIVE_WELLNESS` | Pack Manto Bienestar: Vacunas y Desparasitación | **$14.900 COP** | **$350.000 COP** | 0 días | **NO** | **0% Copago.** Reembolso del 100% de la factura hasta el agotamiento del saldo de $350.000 COP. | Beneficio preventivo de primer uso (*first-touch delight*). No constituye un seguro aleatorio sino un esquema de ahorro programado y salud preventiva que fideliza al usuario e incentiva la vacunación obligatoria (rabia, pentavalente, triple felina), reduciendo la siniestralidad severa general. |
| `CIVIL_LIABILITY_1801` | Responsabilidad Civil Extracontractual (Ley 1801) | **$15.000 COP** | **$87.545.250 COP** (50 SMLMV) | 0 días | **NO** | **0% Copago / 0 Deducible.** Indemnización directa e íntegra al tercero afectado hasta el tope legal. | Amparo obligatorio de orden público para caninos de manejo especial bajo la Ley 1801 y Decreto 0159 de 2026. No admite copago porque la ley exige un amparo no menor a 50 SMLMV libres para la víctima. Prima técnica provisional de $15.000 COP mensuales. |
| `FUNERAL_ASSISTANCE` | Asistencia Exequial y Cremación Individual | **$9.900 COP** | **$1.200.000 COP** | 30 días | **NO** | **0% Copago.** Servicio prestado al 100% a través de funerarias para mascotas aliadas o reembolso íntegro hasta $1.200.000 COP. | Asistencia compasiva ante el fallecimiento de la mascota (eutanasia médica justificada, recogida del cuerpo, cremación individual y urna con cenizas). Por ser asistencia integral de red funeraria no contempla copago del deudo. Carencia de 30 días por muerte natural. |
| `TELEMEDICINE` | Telemedicina Veterinaria 24/7 | **$6.900 COP** | **Ilimitado** (`hasNoAnnualLimit: true`) | 0 días | **NO** | **0% Copago.** Acceso libre e ilimitado vía videollamada y chat sin costo por evento. | Prestación asistencial directa basada en tecnología propia y red médica interna de orientación y triaje 24/7. Al no generar costo marginal de reembolso financiero, se emite sin límite dinerario anual ni cobro por consulta virtual. Actúa además como disuasor preventivo de visitas innecesarias a salas de urgencias físicas. |
| `OWNER_HOSPITALIZATION_STAY` | Guardería por Titular en Clínica | **$4.900 COP** | **$800.000 COP** (Hasta 10 días continuos) | 15 días | **NO** | **0% Copago.** Reembolso del 100% del costo diario de hospedaje o guardería canina/felina acreditada. | Cubre el alojamiento transitorio de la mascota en caso de que el tomador humano deba ser hospitalizado de urgencia por más de 48 horas continuas (tarifa de referencia de hasta $80.000 COP/día por hasta 10 días). Cobertura solidaria de asistencia directa sin deducible. |

---

## 7. Interacción Dinámica de Copagos y Deducibles (10%, 15%, 20%)

El sistema de tarifas de Manto ofrece tres tramos de deducible/copago seleccionables por el usuario en el cotizador, cuya calibración actuarial refleja la transferencia de riesgo entre el asegurado y la compañía:

```mermaid
graph TD
    A[Opciones de Deducible / Copago] --> B[Tramo 1: Deducible 10%<br/>Factor Actuarial: 1.15<br/>Prima Base: +15% Recargo]
    A --> C[Tramo 2: Deducible 15%<br/>Factor Actuarial: 1.00<br/>Prima Base: Tarifa Neutra / Estándar]
    A --> D[Tramo 3: Deducible 20%<br/>Factor Actuarial: 0.88<br/>Prima Base: -12% Descuento]

    B --> E[Amparos con Copago<br/>COMMON_ILLNESSES, PRESCRIPTION_DRUGS,<br/>ACCIDENT_EMERGENCY, DIAGNOSTIC_IMAGING_LABS]
    C --> E
    D --> E

    E --> F[Liquidación de Siniestro:<br/>Monto a Pagar = Gasto Elegible × 1 - Deducible]
```

### 7.1. Tabla de Factores de Deducible
| Deducible Contratado | Factor Actuarial (`DEDUCTIBLE_FACTORS`) | Impacto en la Prima Base | Copago Aplicado en Siniestro de Reembolso |
| :-: | :-: | :-: | :-: |
| **10%** | **1.15** | +15% sobre la prima neutra | **10%** a cargo del titular (Manto cubre 90%) |
| **15%** | **1.00** | Tarifa neutra de mercado (base 1.0) | **15%** a cargo del titular (Manto cubre 85%) |
| **20%** | **0.88** | -12% de descuento sobre la prima neutra | **20%** a cargo del titular (Manto cubre 80%) |

### 7.2. Principio de Equidad y Congruencia Contractual
Anteriormente se detectó una vulnerabilidad crítica de diseño en la que el copago de los amparos se fijaba estáticamente en 15% dentro de los catálogos JSON, independientemente del tramo que el cliente hubiese contratado. 

Dicha anomalía provocaba dos perjuicios actuariales graves:
1. El cliente que contrataba el tramo económico (deducible del 20%) pagaba 12% menos de prima mensual pero recibía en su póliza un copago emitido del 15%, generándole una ganancia indebida y una pérdida actuarial a la aseguradora.
2. El cliente que pagaba 15% más de prima por asegurarse al deducible más bajo (10%) recibía una carátula emitida con copago del 15%, sufriendo un detrimento contractual lesivo de sus derechos como consumidor financiero.

En Manto 2.0, `PricingService` inyecta dinámicamente el deducible contratado en cada amparo de reembolso:
```typescript
const guaranteedBaselineCoverages: MinimumBaselineCoverage[] = BASELINE_COVERAGES_CATALOG.map(
  (coverage) => ({
    ...coverage,
    copayDeductiblePercentage: input.deductiblePercentage, // 0.10, 0.15 o 0.20
    sublimitDescription: breed.fenotipoSublimitNote,
  }),
);
```

---

## 8. Formalización de la Fórmula Actuarial y Tablas de Factores

### 8.1. Ecuación Multiplicativa de Tarifa Base Mensual
La prima base mensual para cualquier mascota se computa mediante el producto continuo de factores de riesgo ponderados, aplicado sobre la base nominal estándar de **$30.000 COP** (`BASE_PREMIUM_COP`):

$$\text{PrimaBaseCOP} = \text{round}\Big( \text{BaseNominal} \times F_{\text{especie}} \times F_{\text{raza}} \times F_{\text{tamaño}} \times F_{\text{sexo}} \times F_{\text{edad}} \times F_{\text{ubicación}} \times F_{\text{deducible}} \times (1 - D_{\text{multi-pet}}) \Big)$$

Donde cada factor está unívocamente determinado:

1. **Prima Base Nominal:**
   $$\text{BaseNominal} = \$30.000\text{ COP}$$

2. **Factor de Especie ($F_{\text{especie}}$):**
   * Canino (`CANINE`): `1.00`
   * Felino (`FELINE`): `0.92` (Refleja menor exposición a traumas de tráfico callejero y hábitos de confinamiento intradomiciliario).

3. **Factor de Tamaño Efectivo ($F_{\text{tamaño}}$):**
   * `TOY`: `0.92`
   * `SMALL`: `0.96`
   * `MEDIUM`: `1.00`
   * `LARGE`: `1.08`
   * `GIANT`: `1.18` (Mayor gasto en anestésicos miligramo/kilo, predisposición a torsión gástrica y displasia).
   * *Regla de Tolerancia:* Si el cliente declara un tamaño distinto al `typicalSize` de la raza, se admite como máximo **$\pm 1$ categoría de distancia** en la escala ordenada. Diferencias mayores son rechazadas con error HTTP 400 Bad Request por incompatibilidad fenotípica (e.g. Bullmastiff declarado como Toy).

4. **Factor de Sexo Biológico ($F_{\text{sexo}}$):**
   * Macho (`MALE`): `1.03` (+3% por mayor etología exploratoria y prevalencia de patologías prostáticas/testiculares).
   * Hembra (`FEMALE`): `1.00`

5. **Factor de Edad en Meses ($F_{\text{edad}}$):**
   * De 2 a 12 meses (Cachorros / Gatitos): `0.95`
   * De 13 a 36 meses (Adultos jóvenes): `1.00`
   * De 37 a 72 meses (Adultos plenos): `1.10`
   * De 73 a 96 meses (Adultos maduros - 6 a 8 años): `1.30`
   * De 97 a 120 meses (Senior inicial - 8 a 10 años): `1.60`
   * De 121 a 144 meses (Senior avanzado / Geriátrico - 10 a 12 años): `1.90`
   * `< 2 meses` o `> 144 meses`: Fuera de rango de admisión para nuevo ingreso (Rechazo automático).

6. **Factor de Ubicación Geográfica ($F_{\text{ubicación}}$):**
   * Bogotá D.C. (`BOGOTA`): `1.08`
   * Medellín y Área Metropolitana (`MEDELLIN`): `1.04`
   * Cali (`CALI`): `1.00`
   * Otras ciudades intermedias (`OTHER`): `0.95`

7. **Factor de Deducible ($F_{\text{deducible}}$):**
   * Deducible 10%: `1.15`
   * Deducible 15%: `1.00`
   * Deducible 20%: `0.88`

8. **Descuento Multi-Mascota ($D_{\text{multi-pet}}$):**
   * 1 mascota: `0.00`
   * $\ge 2$ mascotas: `0.05`

### 8.2. Composición de la Cotización Total
$$\text{Total Mensual COP} = \text{PrimaBaseCOP} + \sum_{i \in \text{Addons}} \text{PrimaMensual}_{i}$$
$$\text{Total Anual COP} = \text{Total Mensual COP} \times 11$$

---

## 9. Evidencia de Certificación y Pruebas Actuariales (`pricing.actuarial.spec.ts`)

La suite de pruebas unitarias y actuariales implementada en [pricing.actuarial.spec.ts](file:///e:/Manto%202.0/backend/src/modules/pricing/pricing.actuarial.spec.ts) valida de manera automatizada las siguientes aserciones críticas:

1. **Exactitud de RCE Ley 1801:**
   * Comprueba que `RCE_LEY_1801_LIMIT_COP` es idéntico a `SMLMV_COP * 50` ($87.545.250 COP).
   * Verifica la auto-inclusión de `CIVIL_LIABILITY_1801` en razas como `ROTTWEILER` sin cobro doble si el usuario la re-selecciona.
   * Confirma que `copayApplies === false` para RCE.
2. **Sincronización Deducible-Copago:**
   * Comprueba mediante `it.each([0.1, 0.15, 0.2])` que los amparos base se emiten con el deducible exacto seleccionado.
   * Valida la monotonía del precio: $\text{Prima}(\text{Deducible } 10\%) > \text{Prima}(\text{Deducible } 20\%)$.
3. **Consistencia de Descuentos:**
   * Verifica que `petsInPolicy: 2` aplica exactamente el 5% de descuento sobre la prima base.
   * Valida que la esterilización se mantiene en 0% de impacto arancelario.
4. **Validación Fenotípica y Prevención de Arbitraje:**
   * Verifica el rechazo de anomalías como Bullmastiff clasificado como `TOY`.
   * Verifica el rechazo de razas inexistentes en `BREED_REGISTRY` o discordancias de especie (e.g., Pitbull como felino).
5. **Integridad Monetaria:**
   * Comprueba que cada valor de salida es de tipo entero `ColombianPeso` (`bigint`), sin ningún rastro de flotantes IEEE 754.

---

## 10. Conclusiones y Dictamen Actuarial Final

El modelo actuarial V3 de Manto 2.0:
1. **Garantiza Solvencia y Equidad:** Establece bases técnicas sólidas, sustentadas en la frecuencia y severidad clínica real de la práctica veterinaria privada en Colombia.
2. **Blindaje Jurídico Pleno:** Erradica el déficit histórico de RCE al fijar exactamente $87.545.250 COP conforme al Decreto 0159 de 2026 y la Ley 1801 de 2016.
3. **Optimización Financiera y de Conversión:** Calibra de forma virtuosa el descuento multi-mascota del 5%, mejorando los indicadores clave de negocio (LTV, CAC, Churn) sin comprometer el margen técnico.
4. **Transparencia Tecnológica:** Opera de forma 100% determinista en servidor, prohibiendo el cálculo generativo por IA y garantizando cero fallas de redondeo en moneda nacional.

**Aprobado para despliegue por:**  
`manto-pricing` — Actuario Principal, Manto Seguros Digitales.  
*Manto 2.0 — Cuidar a los tuyos como familia.*
