# Manto 2.0 — Diferenciación Estratégica, Benchmark y Ventaja Competitiva
## Análisis Comparativo: Lemonade, Tuio y el Mercado Asegurador de Mascotas en Colombia

**Fecha:** Septiembre 2026  
**Documento Estratégico y de Producto**  
**Versión:** 1.0.0  

---

## 1. Resumen Ejecutivo: La Tesis de Manto 2.0

El mercado de seguros en Colombia y América Latina está estructuralmente fracturado: la penetración de seguros formales para mascotas es inferior al **3%**, a pesar de que más del **60% de los hogares urbanos** tienen perros o gatos. 

Las familias colombianas enfrentan gastos imprevistos de urgencias veterinarias entre **$600.000 y $4.500.000 COP**, quedando desprotegidas o atrapadas entre dos opciones deficientes:
1. **Asistencias comerciales de bajo valor** vendidas por bancos y grandes superficies que no cubren hospitalizaciones ni cirugías mayores.
2. **Pólizas tradicionales engorrosas** con tiempos de liquidación de hasta 30 días hábiles, redes cerradas y lenguaje hostil.

**Manto 2.0** nace como una plataforma insurtech digital nativa (MGA / Delegated Underwriting) que combina:
* La **experiencia de usuario fluida y sin fricción** de las neoseguradoras globales (Lemonade, Tuio).
* Una **arquitectura de pagos y liquidación adaptada a la infraestructura colombiana** (Facturación Electrónica DIAN / CUFE, pagos Bre-B / Nequi / Daviplata, STP $\le \$500.000$ COP).
* **Cumplimiento legal estricto e inclusivo** de la **Ley 1801 de 2016** (50 SMLMV obligatorios para razas de manejo especial).
* **Determinismo actuarial absoluto** del lado servidor (la IA asiste en la visión y OCR, pero jamás calcula precios ni niega siniestros arbitrariamente).

---

## 2. Benchmark Internacional: ¿Qué Hizo Exitosos a Lemonade y Tuio?

### 2.1 Lemonade (Estados Unidos y Europa)
Lemonade transformó una industria de 300 años cuestionando sus incentivos fundamentales:

1. **Eliminación del conflicto de interés (Giveback Model & B-Corp):**
   * En las aseguradoras convencionales, cada siniestro rechazado o demorado engrosa directamente el margen de ganancias de la empresa.
   * Lemonade cobra una **tarifa plana fija** (aprox. 25-30%) para gastos operativos y reaseguro. El resto se reserva para pagar siniestros. Si al final del ciclo sobra dinero en el fondo común, se dona a causas benéficas elegidas por los asegurados (*Giveback*). Esto alinea los intereses de la empresa con el cliente.
2. **IA Conversacional y Autoservicio Instantáneo (AI Maya & AI Jim):**
   * **AI Maya:** Permite cotizar y contratar un seguro en menos de 90 segundos mediante un chat amigable, sin formularios infinitos.
   * **AI Jim:** Resuelve y desembolsa siniestros sencillos en tan solo 3 segundos mediante algoritmos antifraude y análisis de video pericial.
3. **Estrategia Multi-Ramo (Land & Expand):**
   * Capturan al usuario joven con coberturas accesibles (Inquilinos / *Renters* y Mascotas / *Pet*), y acompañan su maduración financiera hacia Hogar (*Homeowners*), Vida (*Life*) y Automóvil (*Car*).

### 2.2 Tuio (España / Sur de Europa)
Tuio adaptó la filosofía neoseguradora al contexto hispanohablante europeo, inicialmente con Hogar y posteriormente con Mascotas:

1. **Suscripción Mensual sin Permanencia (Modelo Netflix):**
   * Erradicó el contrato anual obligatorio y las renovaciones automáticas opacas. El usuario puede pausar, modificar o cancelar su póliza en cualquier momento con un clic.
2. **Desintermediación y Cero Comisiones Infladas:**
   * Al eliminar la cadena tradicional de corredores y comisionistas físicos, ofrece primas netas entre un 20% y 30% más económicas con coberturas superiores.
3. **Claridad Contractual:**
   * Pólizas redactadas en lenguaje llano, con desglose transparente de coberturas y exclusiones en tarjetas interactivas.

---

## 3. Radiografía del Mercado Colombiano: Por Qué las Pólizas Actuales Están Rotas

El mercado colombiano para mascotas presenta dos categorías dominantes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OFERTA ACTUAL EN COLOMBIA                             │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ A. ASISTENCIAS COMERCIALES           │ B. PÓLIZAS TRADICIONALES             │
│ (Bancos, Falabella, Éxito, Telcos)   │ (Sura, Bolívar, Mapfre, Allianz/SBS) │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Primas bajas: $15.000 - $25.000 COP│ • Primas: $60.000 - $180.000 COP/mes │
│ • NO es un seguro de salud real      │ • Burocracia extrema y papel físico  │
│ • "2 consultas, 1 baño, 1 corte uñas"│ • Reembolsos tardan 15 a 30 días     │
│ • Tope de urgencia: $200k - $300k COP│ • Red cerrada (clínicas obligadas)   │
│ • No cubre cirugías ni hospitalización│ • Exclusión/traba a Ley 1801 (RCE)  │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### El Engaño de las Asistencias
La mayoría de los usuarios cree tener su perro "asegurado" porque paga una cuota en su tarjeta de crédito bancaria o factura celular. Ante un atropellamiento, una torsión gástrica o una infección por parvovirus (costos de \$1.500.000 a \$4.000.000 COP), descubren que el plan solo cubre orientaciones telefónicas o subsidios ínfimos.

### La Hostilidad de las Aseguradoras Tradicionales
* **Tiempos de Liquidación Asfixiantes:** Los reembolsos tardan hasta **30 días calendario** (amparados en el plazo del artículo 1080 del Código de Comercio), forzando a las familias a endeudarse con tarjetas de crédito de alta tasa mientras esperan.
* **Red Cerrada Impuesta:** Imponen clínicas veterinarias con convenios prenegociados de baja compensación, limitando la libre elección de los mejores especialistas para la mascota.
* **El Problema de la Ley 1801 de 2016 (Razas de Manejo Especial):**
  * La norma exige póliza de Responsabilidad Civil Extracontractual de mínimo **50 SMLMV** ($87.545.250 COP en 2026).
  * Las aseguradoras tradicionales discriminan a estas 15 razas (Pitbull, Rottweiler, Dóberman, etc.), niegan la suscripción médica o exigen trámites presenciales para radicar certificados en la Alcaldía.

---

## 4. Matriz Comparativa: Tradicional vs. Asistencias vs. Lemonade vs. Manto 2.0

| Dimensión | Póliza Tradicional (Sura / Bolívar) | Asistencia (Banco / Retail) | Lemonade (EE.UU. / EU) | Manto 2.0 (Colombia) |
| :--- | :--- | :--- | :--- | :--- |
| **Tiempo de Cotización** | 15 a 45 minutos (o días) | Minutos (venta telefónica fría) | $\le 90$ segundos (AI Maya) | **$\le 60$ segundos con foto (Nuquí 🐾)** |
| **Captura de Datos** | Cédula, historia médica previa, formularios | Venta atada al producto bancario | Chatbot móvil progresivo | **Foto de la carita; precio antes de pedir cédula** |
| **Libertad de Elección** | Red preferente o reembolso engorroso | Estricta red de bajo costo | 100% Libre elección veterinaria | **100% Libre elección en toda Colombia** |
| **Tiempo de Reembolso** | 15 a 30 días hábiles | N/A (solo prestación directa) | Minutos (AI Jim) / 24-48 horas | **$\le 6$ horas en STP ($\le \$500k$) / $\le 48$h auditoría** |
| **Soporte Fiscal / Fraude**| Papeles físicos / facturas manuales | Cupones de red | Recibo digital y video testimonial | **Validación OCR de Factura Electrónica DIAN con CUFE** |
| **Dispersión de Fondos** | Cheque o transferencia diferida | N/A | Transferencia bancaria ACH | **Bre-B, Nequi, Daviplata, ACH interbancario** |
| **Razas Ley 1801 (RCE)** | Excluidas, recargadas o trámite manual | No aplica | N/A (Regulación foránea) | **Amparo 50 SMLMV ($87.545.250 COP) nativo y digital** |
| **Lenguaje y UX** | Hostil ("carencia", "coaseguro", "deducible")| Confuso / engañoso | Empático y moderno | **Micro-copia cercana ("tu aporte", "reembolso")** |
| **Modelo de Suscripción** | Anual forzoso con renovación tácita | Cargo recurrente automático | Mensual flexible | **Mensual sin permanencia o anual con 1 mes gratis** |

---

## 5. Los 6 Pilares Diferenciadores de Manto 2.0

### 1. Onboarding Visual Asistido por Visión Artificial (**Nuquí 🐾**)
* En vez de exigir raza técnica, certificados de pedigree o peso exacto, el tomador sube una fotografía casual de su mascota.
* El pipeline multimodal infiere especie, raza, tamaño fenotípico y edad aproximada con banderas de confianza.
* **Valor antes de datos:** El usuario ve su precio exacto en pesos colombianos **antes de que le pidan cédula, teléfono o historial clínico**, disparando la conversión arriba del 12%.

### 2. Liquidación Express con STP y Validación Fiscal DIAN (**Sué ⚡**)
* En Colombia, la factura electrónica con **CUFE (Código Único de Facturación Electrónica)** es el soporte legal infalsificable ante la DIAN.
* **Sué ⚡** procesa la factura en menos de 10 segundos, coteja el CUFE y la epicrisis veterinaria, e identifica los gastos elegibles.
* **Straight-Through Processing (STP):** Los eventos de hasta **$500.000 COP** (que representan el 70% de las consultas de urgencia y curaciones) se liquidan y dispersan automáticamente en horas a través de **Bre-B / ACH / billeteras digitales**.

### 3. Inclusión Automática y Sin Prejuicios de la Ley 1801 de 2016
* Si el sistema detecta o el usuario selecciona una de las 15 razas de manejo especial, el motor inyecta de forma obligatoria e inmutable el amparo de **50 SMLMV ($87.545.250 COP exactos en 2026)**.
* Tras el pago, se genera de inmediato el **Carnet Digital y Certificado Oficial con Hash SHA-256** (Ley 527 de 1999) para radicación ante la Alcaldía Local y la Policía Nacional sin tener que pisar una oficina física.

### 4. Humanización Radical del Lenguaje Asegurador
Manto elimina la terminología jurídica diseñada históricamente para intimidar al usuario:
* **Deducible** $\to$ *Tu aporte por evento* (ej. 10%, 15% o 20%).
* **Copago** $\to$ *Porcentaje compartido*.
* **Periodo de Carencia** $\to$ *Días para activación de cobertura*.
* **Siniestro** $\to$ *Reembolso veterinario*.
* **Prima Mensual** $\to$ *Cuota mensual*.
* **Exclusiones** $\to$ *Lo que sí y lo que no cubre tu plan*.

### 5. Determinismo Actuarial Ético (Cero Alucinaciones con el Dinero)
* **La IA captura y normaliza; el servidor calcula:** Ningún LLM decide primas, deducibles ni coberturas. El cálculo reside en un motor actuarial puro y auditable (`PricingService`).
* **Moneda Tipada `ColombianPeso`:** Cero redondeos de punto flotante de JavaScript (`0.1 + 0.2`). Todo valor monetario es entero (`bigint` / unidades COP), garantizando precisión actuarial al centavo.
* **Habeas Data (Ley 1581 de 2012):** Almacenamiento seguro, soporte de supresión de datos personales (`suprimirDatosPersonales`) y fotos usadas exclusivamente para clasificación biomédica.

### 6. Coberturas Reales de Alto Impacto
A diferencia de las asistencias comerciales, la base de Manto cubre:
* **Accidentes y Traumatismos:** Hasta $3.500.000 COP/año (percentil 95 de cirugías ortopédicas y traumatológicas).
* **Consultas de Urgencia Presencial:** 3 eventos al año ($450.000 COP).
* **Exámenes Diagnósticos de Choque:** Rayos X, ecografía FAST, cuadros hemáticos ($800.000 COP).
* **Expansión Modular:** Cobertura de enfermedades comunes, medicamentos recetados, telemedicina 24/7 y asistencia exequial/cremación.

---

## 6. Directorio de Referencia y Ubicaciones de Tarificación de Precios

Para auditar las tablas actuariales, constantes, fórmulas y validaciones del motor de tarificación de Manto 2.0:

1. **Documento Maestro Actuarial y Matriz V3:**  
   [`docs/actuarial/VALIDACION_ACTUARIAL_MATRIZ_V3.md`](file:///e:/Manto%202.0/docs/actuarial/VALIDACION_ACTUARIAL_MATRIZ_V3.md)  
   *(Contiene la memoria de cálculo completa, calibración de factores por especie, raza, edad, ciudad y justificación de coberturas).*

2. **Especificación del Motor de Precios (Pricing Engine Spec):**  
   [`docs/agentes/pricing-engine/PRICING_ENGINE.md`](file:///e:/Manto%202.0/docs/agentes/pricing-engine/PRICING_ENGINE.md)  
   *(Contratos TypeScript, tipos de datos, algoritmos y estructura de Add-ons).*

3. **Código Fuente de Constantes y Factores Actuariales (Backend):**  
   [`backend/src/modules/pricing/pricing.constants.ts`](file:///e:/Manto%202.0/backend/src/modules/pricing/pricing.constants.ts)  
   *(Contiene el SMLMV 2026 de $1.750.905, el cálculo de los 50 SMLMV = $87.545.250, factores por ciudad, edad, sexo, especies y razas).*

4. **Lógica de Ejecución y Cálculo de Primas (Backend Service):**  
   [`backend/src/modules/pricing/pricing.service.ts`](file:///e:/Manto%202.0/backend/src/modules/pricing/pricing.service.ts)  
   *(Servicio NestJS que implementa la fórmula determinista y las validaciones de elegibilidad).*

5. **Catálogo Oficial de Razas Asegurables y Factores de Riesgo:**  
   [`docs/CATALOGO_RAZAS_ASEGURABLES.md`](file:///e:/Manto%202.0/docs/CATALOGO_RAZAS_ASEGURABLES.md)  
   *(Catálogo detallado de caninos y felinos con tipificación de manejo especial Ley 1801).*
