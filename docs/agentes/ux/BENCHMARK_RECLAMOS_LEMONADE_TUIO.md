# Benchmark UX y Análisis Competitivo de Reclamos: Lemonade vs. Tuio vs. Manto 2.0

## 1. Resumen Ejecutivo y Matriz Comparativa

La gestión de siniestros y reclamos (First Notice of Loss - FNOL) es el momento de la verdad para cualquier producto insurtech. Este informe presenta un análisis exhaustivo del flujo de reclamaciones de los líderes globales (Lemonade y Tuio) para extraer aprendizajes y perfilar cómo **Manto 2.0**, con su Agente Sué ⚡ y ecosistema de pagos instantáneos Bre-B, puede ofrecer una experiencia superior en Colombia.

| Característica / Plataforma | 🍋 Lemonade (EE.UU/Global) | 🐶 Tuio (España) | ⚡ Manto 2.0 (Colombia) |
| :--- | :--- | :--- | :--- |
| **Canal de Ingreso (FNOL)** | App Móvil (Chatbot AI Jim) | App Móvil / Web (Formulario guiado) | App / Web (Agente Sué ⚡) |
| **Narrativa de Siniestro** | Video Statement (Obligatorio) | Texto descriptivo y tipificación | Texto / Audio + OCR Automático |
| **Soporte Documental** | Fotos/PDF de Facturas médicas | Factura desglosada + Informe clínico | DIAN CUFE vía OCR Automático |
| **Tiempos de Resolución** | STP (Segundos) a días (manual) | Horas a días (Tramitador asignado) | Instantáneo (Validación determinista) |
| **Canal de Desembolso** | Transferencia ACH | Transferencia Bancaria IBAN | Dispersión Bre-B / Nequi / DaviPlata |
| **Atención Humana** | Hand-off a ajustadores | WhatsApp, Email, Teléfono | Consola Pericial SCR-14 |
| **Privacidad y Datos** | Escándalo por biometría/cues | Cumplimiento RGPD (España) | Cumplimiento Ley 1581 (Habeas Data) |

---

## 2. Desglose del Journey de Reclamo Paso a Paso

### 🍋 Lemonade: "Get Paid in Seconds"
El flujo de Lemonade está diseñado para evitar la fricción de los formularios estáticos mediante una interfaz conversacional:
1. **Punto de Entrada:** El usuario pulsa "Claim" en la app. No hay concepto de "siniestro", todo está enfocado en "reclamar mi dinero".
2. **Captura de Datos:** AI Jim realiza preguntas secuenciales (fecha, incidente, veterinario).
3. **Soportes:** Se suben las facturas y notas SOAP (notas médicas) mediante fotos o archivos.
4. **Fricción Intencional (Video Statement):** El usuario *debe* grabar un video mirando a la cámara explicando qué pasó. Lemonade usa esto como un "pledge of honesty" y herramienta antifraude (inicialmente escaneando señales no verbales, lo cual causó controversia).
5. **Decisión:** 18 algoritmos antifraude procesan la solicitud. Si es STP (Straight-Through Processing), AI Jim aprueba el pago en ~3 segundos. De lo contrario, lo envía a un humano.

### 🐶 Tuio: "Dar un Parte" vs "Reclamar"
Tuio adapta el lenguaje tradicional asegurador (dar un parte) a una experiencia neoaseguradora digital:
1. **Punto de Entrada:** Desde la App, el usuario selecciona la póliza y pulsa "Dar parte".
2. **Plazos:** Fuerte énfasis en notificar dentro del plazo legal de 7 días.
3. **Documentación Exigente:** El flujo online requiere factura desglosada y el informe clínico con la firma del veterinario. Si falta, la plataforma detiene el proceso (fricción de validación temprana).
4. **Tramitación:** A diferencia de AI Jim, Tuio prioriza la asignación rápida a un tramitador humano. Mantienen contacto por WhatsApp y Correo, ofreciendo alta transparencia pero menor velocidad STP.

### 🚀 Vanguardia Adicional: ManyPets y Trupanion
- **ManyPets ("Claims without forms"):** Usa integraciones directas con sistemas veterinarios.
- **Trupanion ("VetDirect Pay"):** Pagan directamente al veterinario en el momento del checkout. Elimina el concepto de reembolso para el cliente.

---

## 3. Análisis Crítico: IA y Anti-fraude

### El Caso Lemonade: Biometría vs. Ética
Lemonade enfrentó un fuerte revés de RR.PP. cuando reveló que AI Jim analizaba "non-verbal cues" (microexpresiones) en los videos de los usuarios para detectar fraude. Esto fue percibido como pseudociencia, discriminatorio y un riesgo a la privacidad. Tuvieron que retractarse públicamente.

### La Ventaja de Manto 2.0: Determinismo y Ética
En contraste, Manto 2.0 evita la caja negra biométrica al usar **validación determinista** basada en la infraestructura digital de Colombia:
1. **OCR y DIAN CUFE:** El Agente Sué ⚡ extrae el Código Único de Facturación Electrónica (CUFE) de la factura de la clínica.
2. **Validación Inmutable:** En lugar de "adivinar" si el usuario miente, Manto consulta el CUFE directamente con la DIAN, validando emisor, montos e ítems sin sesgos.
3. **Cumplimiento y Habeas Data:** Toda recolección de información clínica en Colombia respeta la Ley 1581. La captura de audio/texto es solo para el contexto del ajustador en la Consola Pericial SCR-14, no para análisis de comportamiento algorítmico.

---

## 4. Canales y Tiempos de Desembolso

La promesa de valor en un reclamo es la recuperación del dinero.
- **Lemonade:** Usa la red ACH en EE.UU. Aunque la aprobación toma segundos, el dinero en cuenta puede tardar de 1 a 2 días hábiles dependiendo del banco.
- **Tuio:** Transferencias SEPA / IBAN, lo que típicamente toma entre 24h y 48h desde que el tramitador aprueba el expediente.
- **Manto 2.0 (El "Game Changer"):** A través de **Bre-B (Banco de la República)**, junto con integraciones a Nequi y DaviPlata, Manto puede ejecutar dispersión de fondos **inmediata y 24/7**. Una vez que Sué ⚡ y el modelo aprueban el CUFE, el dinero impacta la cuenta del usuario en menos de 20 segundos.

---

## 5. Matriz de Oportunidades y Recomendaciones Frontend/UX para Manto 2.0

Para superar a los competidores, la UI/UX de Manto 2.0 debe implementar las siguientes directrices:

### 1. Reemplazar "Siniestros" por "Asistencia Inmediata"
- **Micro-copia:** Evitar la jerga aseguradora de Tuio ("Siniestro", "Parte"). Usar el acercamiento de Lemonade: *"¿En qué te podemos ayudar?"* o *"Reembolsar gastos médicos"*.

### 2. Interfaz Stepper Dinámico con Sué ⚡
- **Diseño:** Un stepper horizontal (Progreso: Qué pasó -> Factura DIAN -> Datos Médicos -> Reembolso).
- **Interacción:** El Agente Sué no debe ser un simple chatbot. Debe actuar como un **copiloto de llenado de formularios**. Cuando el usuario sube la factura, Sué debe extraer y autocompletar la vista: *"Veo que fuiste a la Clínica VetSanitas y gastaste $150.000. Validado con la DIAN ✅"*.

### 3. Fricción Transparente (Trust Signals)
- Durante la carga y validación OCR/CUFE, usar *skeletons* y mensajes que generen confianza: *"Validando factura electrónica de forma segura..."*
- Esto tranquiliza al usuario demostrando que el sistema es robusto sin la invasión a la privacidad del *video statement* de Lemonade.

### 4. Flujo de Pagos Bre-B Integrado
- Mostrar selector visual de billeteras de destino (Bre-B, Nequi, DaviPlata, Transfiya) con badges de "Pago Inmediato ⚡".
- **UX de Celebración:** Cuando el pago es STP, mostrar una animación de transferencia completada (tipo confetti de Nequi o transferencia exitosa) en la misma pantalla de finalización.

### 5. Consola Pericial SCR-14 (Para Ajustadores)
- Cuando el siniestro cae fuera de STP (factura dudosa, montos altos, exclusiones), el flujo para el usuario debe terminar con: *"Sué ha enviado tu caso a nuestro equipo médico especialista. Te notificaremos en X horas"*.
- En la consola interna SCR-14, el ajustador debe ver un "Semáforo de Fraude" basado netamente en reglas documentales (Validación DIAN, consistencia de raza/edad), no en cajas negras.

---
**Elaborado por:** manto-ux-research (Agente UX Research & Competitive Experience)
