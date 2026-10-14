# Guía Maestra de Redacción de UX y Micro-Copia (UX Copy & Tone of Voice)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Rol:** Senior Product Designer + UX Architect  
**Idioma:** Español (Colombia)  
**Versión:** 1.0.0  
**Fecha:** Septiembre 2026  

---

## 1. Tono de Voz y Personalidad de Marca

Manto se comunica como un **médico veterinario empático y honesto** que además domina la tecnología digital. No hablamos como una corporación de seguros fría, ni como un folleto legal amenazante, ni tampoco caemos en un tono excesivamente infantil.

### Los 4 Atributos de Nuestra Voz
1. **Cálida y Empática**: Reconocemos que las mascotas son parte central de la familia colombiana ("hijos de cuatro patas", consentidos).
2. **Directa y Sin Rodeos**: Vamos al grano. No ocultamos los límites ni los costos. Decimos claramente lo que cubrimos y lo que no.
3. **Optimista y Serena**: En los momentos de urgencia médica veterinaria, transmitimos calma, orden y rapidez de resolución.
4. **Respetuosa de la Norma**: Explicamos los mandatos de ley en Colombia (Ley 1801, Habeas Data) de forma constructiva, no como una imposición burocrática.

---

## 2. Diccionario de Desmitificación del Lenguaje de Seguros

| Concepto Técnico Tradicional | Cómo lo decimos en Manto | Por qué lo decimos así |
| :--- | :--- | :--- |
| **Deducible** | **Tu aporte por evento** | "Deducible" confunde al 80% de los usuarios. "Tu aporte" comunica que compartimos el gasto de manera justa. |
| **Copago** | **Porcentaje compartido** | Más claro y visual al asociarlo a un cálculo sencillo (ej. 10%). |
| **Periodo de Carencia** | **Días para activación de cobertura** | Evita la sensación de que el seguro "no sirve al inicio"; explica que es una protección para mantener precios justos para todos. |
| **Siniestro** | **Reembolso veterinario** | La palabra "siniestro" suena trágica y legalista. El cliente solo quiere que le devuelvan el dinero gastado en la clínica. |
| **Exclusiones** | **Lo que sí y lo que no cubre tu plan** | Transparencia total. Muestra buena fe y elimina la sospecha de letra menuda. |
| **Asegurado / Tomador** | **Tú y tu mascota** | Pone a los seres vivos en el centro, no a las figuras jurídicas. |
| **Prima Mensual** | **Cuota mensual** | Término común y familiar en la economía doméstica colombiana. |

---

## 3. Micro-Copia Exacta Pantalla por Pantalla

### 3.1 `SCR-01: Landing Page`
* **Titular Principal (Hero)**:
  `El seguro que tu mejor amigo merece. Sin enredos y en 60 segundos.`
* **Subtítulo**:
  `Atención médica de urgencia, cirugías y medicamentos con reembolso directo a tu cuenta bancaria o Nequi. Pruébalo subiendo una foto.`
* **Botón de Llamado a la Acción (CTA)**:
  `[Cotizar con una foto →]`
* **Mensaje de Confianza**:
  `🔒 Respaldado por aseguradoras vigiladas por la Superintendencia Financiera de Colombia.`

---

### 3.2 `SCR-02 & SCR-03: Subida de Foto y Análisis de IA`
* **Título de la Pantalla**:
  `Muéstranos a tu consentido`
* **Texto de Instrucción**:
  `Sube una foto donde se le vea bien su carita. Nuestra tecnología identificará su raza y edad aproximada para darte el precio exacto en segundos.`
* **Micro-copia de Carga (Ciclo dinámico)**:
  * `Analizando carita...`
  * `Identificando si es perro o gato...`
  * `Reconociendo raza y rasgos...`
* **Confirmación de IA (Ejemplo Perro Mestizo / Criollo)**:
  * Titular: `¡Qué hermosura! Parece un Criollo / Mestizo de unos 2 a 3 años.`
  * Micro-nota: `Los perritos mestizos tienen un descuento especial por su gran salud natural.`
  * Botón 1: `[¡Sí, es correcto!]`
  * Botón 2: `[Corregir raza o edad]`
* **Confirmación de IA (Raza de Manejo Especial - Ley 1801 de 2016)**:
  * Titular: `Detectamos un American Pit Bull Terrier de aproximadamente 3 años.`
  * Cuadro informativo:
    > ⚠️ **Información legal importante para Colombia**  
    > Por disposición del Código Nacional de Policía (Ley 1801), los ejemplares de esta raza deben contar obligatoriamente con una póliza de Responsabilidad Civil Extracontractual de mínimo 50 SMLMV.  
    > **No te preocupes:** la hemos incluido automáticamente en tu cotización para que obtengas tu certificado oficial sin trámites extra.

---

### 3.3 `SCR-04: Preguntas Mínimas de Ajuste Actuarial`
* **Título**:
  `Solo cuatro daticos clave:`
* **Pregunta 1**: `¿Cómo se llama tu consentido?`  
  * *Placeholder*: `Ej. Milo, Luna, Ramón...`
* **Pregunta 2**: `¿Cuál es su tamaño aproximado?`  
  * *Micro-guía*: `Nuestra IA sugirió una opción según su raza, confírmala o cámbiala:`
  * *Chips*: `[Toy (≤5kg)]` `[Pequeño (5-10kg)]` `[Mediano (10-25kg)]` `[Grande (25-45kg)]` `[Gigante (>45kg)]`
* **Pregunta 3**: `¿En qué ciudad viven?`  
  * *Chips*: `[Bogotá D.C.]` `[Medellín]` `[Cali]` `[Otras ciudades]`
* **Pregunta 4**: `¿Está esterilizado/a?`  
  * *Opciones*: `[Sí (Ahorras un 5% en tu cuota)]` `[Aún no]`
* **Botón CTA**:
  `[Calcular mi Tarifa Base Personalizada →]`

---

### 3.4 `SCR-05: Protección Base a la Medida y Expansión Modular`
* **Título**:
  `Protección Base calculada para Milo`
* **Subtítulo Dinámico Transparente**:
  `Tarifa calibrada para un Perro Labrador Retriever de tamaño Grande (~2 años) en Bogotá.`
* **Explicación del Deducible (Tu aporte por evento)**:
  * Titular del Slider: `¿Cuánto prefieres aportar en caso de urgencia?`
  * Explicación interactiva:
    * Al seleccionar 10%: *"Tú aportas solo el 10% de la cuenta veterinaria; Manto cubre el 90% restante."*
    * Al seleccionar 15%: *"Opción equilibrada: tú aportas el 15% y mantienes una cuota mensual moderada."*
    * Al seleccionar 20%: *"Tu cuota mensual baja al mínimo; tú asumes el 20% en cada urgencia."*
* **Micro-copia de la Tarifa Base**:
  * Titular de Tarjeta: `Tu Protección Base Garantizada`
  * Mensaje de Confianza: *"Cubre lo vital que toda mascota necesita: urgencias, estabilización médica y cirugías por accidente, sin pagar por cosas que no usas."*
  * Viñetas explicadas:
    * `✔ Urgencias y hospitalización por accidentes (Hasta COP $3.5M/año)`
    * `✔ 3 consultas médicas de urgencia al año`
    * `✔ Cirugías y exámenes diagnósticos derivados de trauma o accidente`
    * `✔ Sublímite especializado para la complexión de su raza`
* **Insignia Legal Automática (si aplica Ley 1801 de 2016)**:
  * `⚖️ RCE Obligatoria (50 SMLMV) incluida por ley para razas de manejo especial.`

---

### 3.5 `SCR-06: Catálogo de Coberturas Opcionales (Add-ons)`
* **Título**:
  `Personaliza tu tranquilidad: añade lo que Milo necesite`
* **Add-on 1: Cobertura de Enfermedades Comunes e Infecciosas**:
  * `Salud médica integral por patologías | +$24.900/mes`
  * *Detalle*: *"Cubre gastroenteritis, problemas respiratorios, dermatitis, infecciones y cirugías derivadas de enfermedades no preexistentes."*
* **Add-on 2: Medicamentos Recetados Ambulatorios**:
  * `Reembolso de fármacos y antibióticos | +$12.900/mes`
  * *Detalle*: *"Para que las fórmulas médicas tras una consulta no salgan de tu bolsillo."*
* **Add-on 3: Responsabilidad Civil Extracontractual (Ley 1801)**:
  * `Protección ante daños o lesiones a terceros (Hasta 50 SMLMV) | +$15.000/mes`
  * *Detalle*: *"Cubre gastos médicos o indemnizaciones si tu mascota causa un accidente a otra persona o animalito."*
* **Add-on 4: Asistencia Exequial y Cremación**:
  * `Despedida digna y cremación individual con cenizas | +$9.900/mes`
  * *Detalle*: *"Acompañamiento integral, eutanasia compasiva y entrega de urna en tu hogar."*
* **Add-on 5: Telemedicina Veterinaria 24/7**:
  * `Videoconsultas ilimitadas desde tu celular | +$6.900/mes`
  * *Detalle*: *"Resuelve dudas de vómito, diarrea o comportamiento a cualquier hora de la noche sin salir de casa."*
* **Add-on 6: Guardería por Hospitalización del Dueño**:
  * `Cuidado asegurado si tú te enfermas | +$4.900/mes`
  * *Detalle*: *"Hospedaje de hasta 10 días para tu mascota si sufres un evento médico imprevisto."*

---

### 3.6 `SCR-07 & SCR-08: Checkout y Pasarela Wompi`
* **Título**:
  `Activa la protección de Milo`
* **Texto de Autorización de Datos (Habeas Data - Ley 1581)**:
  `☑️ Autorizo de manera previa, expresa e informada el tratamiento de mis datos personales de acuerdo con la Política de Privacidad de Manto y para la emisión del contrato de seguro con nuestra aseguradora aliada.`
* **Texto de Confianza en el Pago**:
  `🔒 Tus datos viajan cifrados. Pagos procesados de forma segura mediante Wompi (Bancolombia). Puedes cancelar tu suscripción en cualquier momento desde tu panel.`

---

### 3.7 `SCR-09: Celebración y Emisión de Póliza`
* **Titular**:
  `🎉 ¡Milo ya está protegido con Manto!`
* **Cuerpo del Mensaje**:
  `Hemos emitido tu póliza digital número MTO-PET-2026-000842. Te enviamos la carátula y el contrato formal a tu correo.`
* **Llamados a la Acción**:
  * `[📲 Guardar carnet en mi celular]`
  * `[📄 Descargar carátula oficial (PDF)]`
  * `[Ir a mi panel de mascota →]`

---

### 3.8 `SCR-12 & SCR-13: Radicación de Siniestros (FNOL)`
* **Título**:
  `¿Qué le ocurrió a Milo?`
* **Subtítulo**:
  `Cuéntanos qué pasó y sube la factura de la veterinaria para tramitar tu reembolso.`
* **Instrucción de Carga de Factura**:
  `Sube una foto o PDF de la factura electrónica. Asegúrate de que se vea clarito el NIT de la clínica y el valor total.`
* **Micro-copia de Éxito en Radicación**:
  `¡Recibimos tu solicitud! Nuestro sistema está validando la factura. Si todo está en orden, recibirás el dinero en tu cuenta en cuestión de horas.`
* **Seguimiento (Claim Tracker)**:
  * `Paso 1: Solicitud recibida` (Completado)
  * `Paso 2: Factura validada con la DIAN` (Completado)
  * `Paso 3: Liquidación aprobada: Te transferiremos COP $357.000` (En curso)
  * `Paso 4: Plata en tu cuenta Bancolombia terminada en *4501` (Listo)
