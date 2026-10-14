# Informe de Seguridad y Auditoría de Vulnerabilidades (Security & Threat Assessment)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Agente:** Agente 7 - Principal QA + Security Engineer  
**Estándar:** OWASP Top 10 API Security / STRIDE / SFC Circular Básica Jurídica  
**Fecha:** Septiembre 2026  
**Estado:** Directrices y Defensas Obligatorias  

---

## 1. Evaluación contra OWASP API Security Top 10 (2023)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MATRIZ DE DEFENSA OWASP API                           │
└─────────────────────────────────────────────────────────────────────────────┘
  API1: BOLA (IDOR)                 ──▶ Verificación de Tenencia en Servicio
  API2: Broken Authentication       ──▶ JWT 15 min + Refresh Token HttpOnly
  API3: Broken Property Level Auth  ──▶ DTOs con Whitelist Estricta (No Mass Assign)
  API4: Unrestricted Resource Cons. ──▶ Throttler Redis (10 req/min en Cotizador)
  API5: Broken Function Level Auth  ──▶ RolesGuard RBAC en Endpoints Admin
  API6: Unrestricted Business Flows ──▶ Idempotencia y Captcha en Checkout
  API7: Server-Side Request Forgery ──▶ Validación de Webhooks Wompi con Firma SHA
  API8: Security Misconfiguration   ──▶ Helmet, CORS Cerrado, HSTS, CSP Estricto
  API9: Improper Inventory Mgmt     ──▶ Versionamiento Obligatorio /v1/
  API10: Unsafe Consumption of APIs──▶ Validación Zod en Respuestas de IA y Bancos
```

---

## 2. Auditoría Detallada por Vector de Amenaza

### 2.1 Prevención de BOLA / IDOR (Broken Object Level Authorization)
* **Vector**: Un usuario autenticado con ID `usr-111` consulta `GET /v1/claims/clm-999` que pertenece a `usr-222`.
* **Control Defensivo**:
  * La consulta a nivel de base de datos **siempre** incluye la condición del titular:
    ```sql
    SELECT * FROM claims.claims WHERE id = :claimId AND user_id = :currentUserId;
    ```
  * Si la entidad no existe para ese usuario, se retorna `404 Not Found` en lugar de `403 Forbidden` para evitar la enumeración de identificadores ajenos.

### 2.2 Protección de Carga de Archivos (Malware y Decompression Bombs)
* **Vectores de Ataque**:
  1. *Camuflaje de extensiones*: Subir un binario malicioso renombrado a `.jpg`.
  2. *Bomba de Píxeles (Pixel Flood)*: Una imagen de pocos kilobytes que al descomprimirse en memoria consume 8 GB de RAM causando DoS.
  3. *Inyección SVG (Stored XSS)*: Archivos `.svg` con scripts JavaScript incrustados.
* **Mitigaciones Implementadas**:
  * **Prohibición Total de Archivos SVG**: Únicamente se admiten binarios rasterizados: `image/jpeg`, `image/png`, `image/webp` y `application/pdf`.
  * **Inspección de Magic Bytes**: Verificación de firmas binarias en memoria antes de cualquier procesamiento.
  * **Límites de Dimensiones**: Dimensiones máximas de $4096 \times 4096 \text{ px}$.
  * **Aislamiento en Cuarentena**: Los archivos se suben a una ruta efímera `/quarantine/` y solo un worker con **ClamAV** los traslada a `/clean/` tras certificar que están libres de firmas de virus o exploits.

### 2.3 Seguridad Financiera y Alcance PCI-DSS
* **Principio de Descope**: La plataforma Manto 2.0 califica estrictamente bajo **PCI-DSS SAQ A**:
  * El frontend tokeniza las tarjetas directamente contra los servidores seguros de **Wompi (Bancolombia)**.
  * Los servidores de backend y bases de datos **jamás ven, procesan ni almacenan números de tarjeta de crédito (PAN), códigos CVV ni fechas de vencimiento**.
  * Solo se almacenan tokens criptográficos opacos provistos por la pasarela.

### 2.4 Control de Consumo de Recursos (Rate Limiting & Anti-Scraping)
Para proteger los modelos de IA y evitar el abuso del motor de cotizaciones por competidores o bots:

| Endpoint | Límite por IP / Token | Ventana Temporal | Mecanismo |
| :--- | :---: | :---: | :--- |
| `POST /v1/auth/login` | 5 intentos | 15 minutos | Bloqueo por IP y correo |
| `POST /v1/ai/pet-vision` | 6 solicitudes | 1 hora | Throttler Redis |
| `POST /v1/quotes/calculate` | 15 solicitudes | 1 hora | Throttler Redis |
| `POST /v1/claims` | 3 radicaciones | 24 horas | Límite por póliza |

---

## 3. Cumplimiento Regulatorio y Privacidad (Habeas Data en Colombia)

1. **Ley Estatutaria 1581 de 2012**:
   * Cero almacenamiento de datos personales sin registro explícito en `core.habeas_data_consents` (almacenando IP, User-Agent, versión del aviso y timestamp UTC).
   * Los datos sensibles (fotos de mascotas, diagnósticos veterinarios) se cifran en reposo con **AES-256**.
2. **SARLAFT 4.0 (Superintendencia Financiera de Colombia)**:
   * Consulta asíncrona de listas restrictivas (OFAC, Lista Clinton, Contraloría, Procuraduría) antes de autorizar la emisión de la póliza (`Quote -> Policy`).
   * Alertas automáticas para Oficial de Cumplimiento si se detecta homonimia o coincidencia mayor al $85\%$.
