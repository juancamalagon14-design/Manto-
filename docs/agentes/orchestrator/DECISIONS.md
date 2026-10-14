# Registro de Decisiones de Arquitectura (Architecture Decision Records - ADRs)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Versión:** 1.0.0  
**Fecha:** Septiembre 2026  
**Estado:** Aprobado para Implementación  
**Autor:** CTO / Principal Software Architect  

---

## Índice de Decisiones Arquitectónicas

* [ADR-001: Adopción de Monolito Modular en NestJS en lugar de Microservicios Prematuros](#adr-001-adopción-de-monolito-modular-en-nestjs-en-lugar-de-microservicios-prematuros)
* [ADR-002: PostgreSQL Relacional con JSONB para Atributos Específicos de Ramo (LOB)](#adr-002-postgresql-relacional-con-jsonb-para-atributos-específicos-de-ramo-lob)
* [ADR-003: Motor de Reglas Determinista para Tarifas y Coberturas con Límite Estricto a la IA](#adr-003-motor-de-reglas-determinista-para-tarifas-y-coberturas-con-límite-estricto-a-la-ia)
* [ADR-004: Modelo Operativo MGA con Adaptador Desacoplado para Aseguradora Aliada](#adr-004-modelo-operativo-mga-con-adaptador-desacoplado-para-aseguradora-aliada)
* [ADR-005: Procesamiento Asíncrono con Redis y BullMQ para Tareas de Cómputo Pesado](#adr-005-procesamiento-asíncrono-con-redis-y-bullmq-para-tareas-de-cómputo-pesado)
* [ADR-006: Tokenización con Wompi (Bancolombia) y Descope Total de PCI-DSS](#adr-006-tokenización-con-wompi-bancolombia-y-descope-total-de-pci-dss)
* [ADR-007: Carga Directa a S3 con URLs Prefirmadas y Cuarentena de Archivos](#adr-007-carga-directa-a-s3-con-urls-prefirmadas-y-cuarentena-de-archivos)
* [ADR-008: Arquitectura de Liquidación de Siniestros en Doble Capa (STP Heurístico + Auditoría Humana)](#adr-008-arquitectura-de-liquidación-de-siniestros-en-doble-capa-stp-heurístico--auditoría-humana)

---

### ADR-001: Adopción de Monolito Modular en NestJS en lugar de Microservicios Prematuros
* **Estado:** Aprobado.
* **Contexto:**
  La plataforma requiere velocidad extrema de desarrollo, coherencia transaccional ACID estricta para pólizas y dinero, y facilidad de despliegue para un equipo de ingeniería en etapa de lanzamiento. Un enfoque inicial basado en microservicios introduciría latencia de red, complejidad de observabilidad distribuida, transacciones distribuidas (Sagas) y sobrecarga operativa injustificada.
* **Decisión:**
  Construir un **Monolito Modular** utilizando TypeScript y NestJS. Los módulos (Auth, Users, Quotes, Policies, Claims, Billing, LOB-Pet) tienen límites de dominio estrictos (DDD). Comparten un mismo repositorio y una misma base de datos PostgreSQL, pero con esquemas y tablas aisladas.
* **Consecuencias:**
  * **Positivas:** Desarrollo ágil, tipos compartidos de extremo a extremo, transacciones de base de datos locales atómicas, despliegue simple en un solo contenedor Docker.
  * **Negativas:** Si un módulo consume memoria excesiva (ej. generación de reportes), podría afectar el proceso del servidor.
  * **Mitigación:** Tareas pesadas (OCR, visión, PDFs) se delegan a workers asíncronos en colas BullMQ.

---

### ADR-002: PostgreSQL Relacional con JSONB para Atributos Específicos de Ramo (LOB)
* **Estado:** Aprobado.
* **Contexto:**
  El núcleo debe asegurar transacciones de seguros con integridad referencial relacional, pero debe permitir que diferentes ramos (Mascotas, Hogar, Autos) almacenen atributos altamente dispares (ej. `breed_id` en mascotas vs. `catastro_number` en hogar o `placa` en autos) sin requerir alteraciones continuas a tablas centrales.
* **Decisión:**
  Utilizar **PostgreSQL 16** estructurado:
  1. Tablas relacionales con tipado estricto para entidades universales (`policies`, `claims`, `invoices`, `users`).
  2. Tablas especializadas en esquemas dedicados (`lob_pet.pets`, `lob_pet.breeds`).
  3. Columnas **`JSONB` indexadas con GIN** para metadatos actuariales variables y resultados de visión computacional.
* **Consecuencias:**
  * **Positivas:** Máxima integridad relacional, velocidad de consulta B-Tree y flexibilidad NoSQL cuando sea necesario sin añadir bases de datos secundarias como MongoDB.

---

### ADR-003: Motor de Reglas Determinista para Tarifas y Coberturas con Límite Estricto a la IA
* **Estado:** Aprobado.
* **Contexto:**
  Existe el riesgo de que modelos de lenguaje o visión generativa produzcan alucinaciones o variaciones arbitrarias en precios de seguros o resoluciones de siniestros, violando la regulación de la Superintendencia Financiera de Colombia (SFC) y generando pérdidas financieras directas.
* **Decisión:**
  Establecer por diseño que **la IA jamás sea fuente de verdad financiera o legal**. La IA solo asiste en la extracción de datos (OCR de facturas) y clasificación visual sugerida. Todo cálculo de primas, deducibles, copagos, elegibilidad y desembolsos se programa en **motores deterministas puros de TypeScript**, con pruebas unitarias exhaustivas con cobertura del $100\%$.
* **Consecuencias:**
  * **Positivas:** Cumplimiento regulatorio total, auditoría reproducible, cero alucinaciones en dinero.
  * **Negativas:** Requiere mantenimiento manual y versionado de matrices de reglas actuariales en el código o tablas de base de datos.

---

### ADR-004: Modelo Operativo MGA con Adaptador Desacoplado para Aseguradora Aliada
* **Estado:** Aprobado.
* **Contexto:**
  Constituir una compañía de seguros formal en Colombia exige un capital de solvencia multimillonario y un proceso regulatorio de varios años ante la SFC. Manto 2.0 requiere salir al mercado rápidamente respaldado por una aseguradora aliada legalmente constituida (modelo MGA / Agencia Vinculada).
* **Decisión:**
  Diseñar la capa de emisión y siniestros con un patrón **Adapter (`CarrierAdapter`)**. Manto gestiona la experiencia de usuario, suscripción y liquidación delegada, y exporta periódicamente los estados contables y de reservas (Bordereaux diarios y mensuales) a la aseguradora aliada vía SFTP/API.
* **Consecuencias:**
  * **Positivas:** Lanzamiento ágil en Colombia, cumplimiento regulatorio inmediato y posibilidad de cambiar o sumar aseguradoras aliadas sin rediseñar el frontend ni el core.

---

### ADR-005: Procesamiento Asíncrono con Redis y BullMQ para Tareas de Cómputo Pesado
* **Estado:** Aprobado.
* **Contexto:**
  El análisis de fotos de mascotas por redes neuronales, el OCR de facturas electrónicas de clínicas veterinarias, la generación de PDFs de pólizas con Puppeteer y el despacho de notificaciones generan picos de CPU y latencia que bloquearían los endpoints de la API HTTP.
* **Decisión:**
  Implementar **BullMQ sobre Redis 7** como el sistema estándar de colas asíncronas de la plataforma. La API REST responde de inmediato al cliente con `202 Accepted` y un `jobId` / estado, mientras los workers procesan las tareas en segundo plano con reintentos exponenciales automáticos y colas de descarte (DLQ).
* **Consecuencias:**
  * **Positivas:** Tiempos de respuesta HTTP inferiores a 100 ms para los usuarios, tolerancia a fallos y auto-recuperación de trabajos caídos.

---

### ADR-006: Tokenización con Wompi (Bancolombia) y Descope Total de PCI-DSS
* **Estado:** Aprobado.
* **Contexto:**
  Almacenar o procesar números de tarjetas de crédito (PAN) y códigos de seguridad (CVV) en nuestros servidores exigiría una certificación PCI-DSS nivel 1 costosa, auditorías externas continuas y un alto riesgo de ciberseguridad.
* **Decisión:**
  Integrar **Wompi (Bancolombia)** mediante su SDK web de frontend para tokenización directa cliente-a-pasarela. El backend de Manto 2.0 solo recibe y almacena el token opaco y los últimos 4 dígitos. Además, Wompi ofrece el mejor soporte nativo para **PSE (Pagos Seguros en Línea)** en Colombia.
* **Consecuencias:**
  * **Positivas:** Alcance de cumplimiento reducido a PCI-DSS SAQ A, cero riesgo de robo de tarjetas en nuestra base de datos y máxima confianza de los usuarios colombianos con el respaldo de Bancolombia.

---

### ADR-007: Carga Directa a S3 con URLs Prefirmadas y Cuarentena de Archivos
* **Estado:** Aprobado.
* **Contexto:**
  Subir imágenes de mascotas e historias clínicas directamente a través de los servidores de la API de Node.js saturaría el ancho de banda y la memoria de las instancias de backend. Además, archivos maliciosos podrían intentar ejecutar ataques en el servidor.
* **Decisión:**
  Implementar carga directa al almacenamiento de objetos (S3 / MinIO) mediante **URLs prefirmadas (Presigned URLs)** con caducidad de 5 minutos. Los archivos se depositan inicialmente en una carpeta de **`/quarantine/`**. Un worker con **ClamAV** valida la integridad y los *magic bytes* del archivo antes de moverlo a la carpeta definitiva **`/clean/`** y asociarlo a la póliza o siniestro.
* **Consecuencias:**
  * **Positivas:** Latencia mínima en el backend, escalabilidad ilimitada de ancho de banda y protección activa contra malware y formatos fraudulentos.

---

### ADR-008: Arquitectura de Liquidación de Siniestros en Doble Capa (STP Heurístico + Auditoría Humana)
* **Estado:** Aprobado.
* **Contexto:**
  Los clientes esperan reembolsos instantáneos, pero la aseguradora debe evitar fugas de capital por fraudes o pagos indebidos de tratamientos preexistentes o cosméticos no cubiertos.
* **Decisión:**
  Implementar un modelo de liquidación en dos velocidades:
  1. **Capa 1 - STP Automático**: Siniestros de bajo monto ($\le$ COP $500,000$), sin anomalías de fraude (FraudScore $< 20$), con carencias cumplidas y factura DIAN de alta confianza ($\ge 90\%$) son aprobados y pagados de forma inmediata.
  2. **Capa 2 - Auditoría Veterinaria Humana**: Reclamos superiores a COP $500,000$, con dudas diagnósticas o discrepancias en la factura se asignan automáticamente a la consola de los médicos auditores.
* **Consecuencias:**
  * **Positivas:** Más del 35% de los siniestros se resuelven en minutos aumentando drásticamente la satisfacción (NPS), mientras se mantiene el control riguroso de la siniestralidad en los eventos de alto costo.
