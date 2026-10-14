# Especificación de APIs REST (API Specification)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Versión de API:** v1  
**Estándar:** OpenAPI 3.1 / RESTful JSON / RFC 7807 Problem Details  
**Fecha:** Septiembre 2026  
**Autor:** CTO / Principal Software Architect  

---

## 1. Convenciones Globales y Protocolos

### 1.1 Esquema de URLs y Versionamiento
Todas las rutas de la API pública están prefijadas por versión semántica principal:
`https://api.manto.co/v1/{recurso}`

### 1.2 Autenticación y Autorización
* **Access Token**: JWT de vida corta (15 minutos) transmitido en el encabezado:
  `Authorization: Bearer <access_token>`
* **Refresh Token**: Token criptográfico opaco transmitido y almacenado exclusivamente en una cookie HTTP-only, `Secure`, `SameSite=Strict` con rotación automática en cada uso.
* **Control de Acceso basado en Roles (RBAC)**:
  * `POLICYHOLDER`: Clientes propietarios de pólizas.
  * `ADJUSTER`: Auditores veterinarios y ajustadores de siniestros.
  * `UNDERWRITER`: Suscriptores técnicos de riesgos y configuración actuarial.
  * `ADMIN`: Administradores de la plataforma.
  * `AUDITOR`: Oficiales de cumplimiento y auditores externos SFC.

### 1.3 Claves de Idempotencia (`Idempotency-Key`)
Para todas las operaciones mutables críticas (cobros, vinculación de pólizas y radicación de siniestros), el cliente debe enviar un encabezado obligatorio:
`Idempotency-Key: <UUIDv4>`
El backend almacena en Redis la respuesta durante 24 horas. Peticiones repetidas con la misma clave devolverán la respuesta en caché con el encabezado `X-Cache-Lookup: HIT`.

### 1.4 Formato Estándar de Errores (RFC 7807 Problem Details)
Todas las respuestas de error ($4xx$ y $5xx$) cumplen con el formato estándar `application/problem+json`:

```json
{
  "type": "https://errors.manto.co/v1/validation-error",
  "title": "Error de Validación de Datos de Entrada",
  "status": 422,
  "detail": "La edad de la mascota supera el límite máximo asegurable para nuevo ingreso.",
  "instance": "/v1/quotes/calculate",
  "invalidParams": [
    {
      "name": "birthDate",
      "reason": "La edad máxima de ingreso es de 8 años (96 meses). La fecha proporcionada corresponde a 108 meses."
    }
  ],
  "timestamp": "2026-09-09T18:25:00Z",
  "traceId": "c8f12a9e-8b92-4911-b949-ff705f0a4b8c"
}
```

---

## 2. Catálogo de Endpoints de la API v1

### 2.1 Autenticación y Consentimiento (`/v1/auth`)

#### `POST /v1/auth/register`
Registra un nuevo usuario capturando el consentimiento explícito de Habeas Data (Ley 1581 de 2012).
* **Payload Request**:
```json
{
  "email": "camila.valencia@gmail.com",
  "password": "PasswordSeguro2026!#",
  "firstName": "Camila",
  "lastName": "Valencia",
  "identificationType": "CC",
  "identificationNumber": "1020304050",
  "phoneNumber": "3101234567",
  "city": "Bogotá",
  "department": "Cundinamarca",
  "habeasDataConsent": {
    "granted": true,
    "policyVersion": "v2026.1",
    "purpose": "INSURANCE_AND_COMMERCIAL"
  }
}
```
* **Response 201 Created**:
```json
{
  "userId": "0191d9b3-4f92-7000-8000-000000000001",
  "accessToken": "eyJhbGciOi...",
  "expiresIn": 900,
  "user": {
    "email": "camila.valencia@gmail.com",
    "fullName": "Camila Valencia",
    "role": "POLICYHOLDER"
  }
}
```

#### `POST /v1/auth/login`
Autentica con email y contraseña. Retorna Access Token en payload y Refresh Token en cookie segura.

---

### 2.2 IA y Visión Computacional (`/v1/ai`)

#### `POST /v1/ai/pet-vision`
Recibe la imagen de la mascota y retorna la clasificación inferida con niveles de confianza y advertencias.
* **Content-Type**: `multipart/form-data`
* **Form-Data Body**: `photo: File` (JPEG, PNG, WebP $\le$ 10MB)
* **Response 200 OK**:
```json
{
  "analysisId": "0191d9b4-1111-7000-8000-000000000002",
  "species": "DOG",
  "speciesConfidence": 0.99,
  "detectedBreeds": [
    {
      "breedId": "0191d9b0-aaaa-7000-8000-000000000010",
      "breedName": "French Bulldog",
      "confidence": 0.94,
      "isSpecialHandlingBreed": false
    },
    {
      "breedId": "0191d9b0-bbbb-7000-8000-000000000011",
      "breedName": "Boston Terrier",
      "confidence": 0.05,
      "isSpecialHandlingBreed": false
    }
  ],
  "estimatedAgeBracket": "ADULT_1_TO_4_YEARS",
  "ageConfidence": 0.82,
  "imageQualityScore": 0.96,
  "photoDocumentId": "0191d9b4-2222-7000-8000-000000000003",
  "userGuidance": "Por favor confirma si tu mascota es un French Bulldog y su edad exacta."
}
```

---

### 2.3 Cotización y Tarificación (`/v1/quotes`)

#### `POST /v1/quotes/calculate`
Calcula determinísticamente la elegibilidad y los valores de primas para una mascota.
* **Payload Request**:
```json
{
  "lobType": "PET",
  "petData": {
    "name": "Milo",
    "species": "DOG",
    "breedId": "0191d9b0-aaaa-7000-8000-000000000010",
    "birthDate": "2024-04-15",
    "gender": "MALE",
    "isSterilized": true,
    "city": "Bogotá",
    "photoDocumentId": "0191d9b4-2222-7000-8000-000000000003"
  }
}
```
* **Response 200 OK**:
```json
{
  "quoteId": "0191d9b5-3333-7000-8000-000000000004",
  "expiresAt": "2026-09-24T18:25:00Z",
  "isEligible": true,
  "subjectSummary": {
    "name": "Milo",
    "species": "DOG",
    "breedName": "French Bulldog",
    "ageMonths": 29,
    "isSpecialHandlingBreed": false
  },
  "availablePlans": [
    {
      "planId": "0191d9af-1111-7000-8000-000000000001",
      "planCode": "PET_ESSENTIAL",
      "name": "Plan Esencial (Accidentes)",
      "monthlyPremiumCop": 34900,
      "annualPremiumCop": 383900,
      "deductiblePercentage": 20,
      "annualCoverageLimitCop": 2500000
    },
    {
      "planId": "0191d9af-2222-7000-8000-000000000002",
      "planCode": "PET_TRANQUILITY",
      "name": "Plan Tranquilidad",
      "monthlyPremiumCop": 68900,
      "annualPremiumCop": 757900,
      "deductiblePercentage": 15,
      "annualCoverageLimitCop": 5000000
    },
    {
      "planId": "0191d9af-3333-7000-8000-000000000003",
      "planCode": "PET_TOTAL",
      "name": "Plan Total",
      "monthlyPremiumCop": 114900,
      "annualPremiumCop": 1263900,
      "deductiblePercentage": 10,
      "annualCoverageLimitCop": 10000000
    }
  ],
  "availableAddons": [
    {
      "addonId": "0191d9af-4444-7000-8000-000000000004",
      "code": "RCE_LEY_1801",
      "name": "Responsabilidad Civil Extracontractual (50 SMLMV)",
      "monthlyCostCop": 15000,
      "isMandatory": false
    },
    {
      "addonId": "0191d9af-5555-7000-8000-000000000005",
      "code": "EXEQUIAL_PET",
      "name": "Asistencia Exequial y Cremación",
      "monthlyCostCop": 9900,
      "isMandatory": false
    }
  ]
}
```

---

### 2.4 Emisión y Pagos (`/v1/policies` & `/v1/billing`)

#### `POST /v1/quotes/{id}/bind`
Bloquea la cotización y genera la intención de pago hacia la pasarela (Wompi).
* **Headers**: `Idempotency-Key: 7b0a7d5a-67b1-4c12-a1f9-01c9a62341e1`
* **Payload Request**:
```json
{
  "selectedPlanId": "0191d9af-3333-7000-8000-000000000003",
  "billingFrequency": "MONTHLY",
  "selectedAddonIds": [
    "0191d9af-5555-7000-8000-000000000005"
  ],
  "paymentMethodType": "WOMPI_TOKENIZED_CARD",
  "cardToken": "tok_prod_9921_abc123"
}
```
* **Response 200 OK**:
```json
{
  "policyId": "0191d9b6-4444-7000-8000-000000000005",
  "policyNumber": "MTO-PET-2026-000842",
  "status": "ACTIVE",
  "startDate": "2026-09-10T00:00:00Z",
  "endDate": "2027-09-09T23:59:59Z",
  "chargedAmountCop": 124800,
  "transactionReference": "TX-WMP-20260909-8812",
  "digitalCertificateUrl": "https://api.manto.co/v1/policies/0191d9b6-4444-7000-8000-000000000005/certificate"
}
```

---

### 2.5 Radicación y Consulta de Siniestros (`/v1/claims`)

#### `POST /v1/claims`
Radica una reclamación de reembolso (FNOL).
* **Headers**: `Idempotency-Key: e4b2d398-31aa-4b8b-821f-c0c1b7148ef2`
* **Payload Request**:
```json
{
  "policyId": "0191d9b6-4444-7000-8000-000000000005",
  "incidentType": "ILLNESS",
  "incidentDate": "2026-09-08T14:30:00Z",
  "description": "Milo presentó gastroenteritis aguda con vómito y deshidratación severa.",
  "claimedAmountCop": 420000,
  "documentVaultIds": [
    "0191d9b7-1111-7000-8000-000000000006",
    "0191d9b7-2222-7000-8000-000000000007"
  ],
  "reimbursementAccount": {
    "bankCode": "1007",
    "accountType": "AHORROS",
    "accountNumber": "24500012345"
  }
}
```
* **Response 202 Accepted**:
```json
{
  "claimId": "0191d9b8-5555-7000-8000-000000000008",
  "claimNumber": "CLM-2026-000142",
  "status": "ANALYZING_DOCUMENTS",
  "estimatedResolutionHours": 6,
  "trackingUrl": "https://api.manto.co/v1/claims/0191d9b8-5555-7000-8000-000000000008"
}
```

#### `GET /v1/claims/{id}`
Consulta el estado de liquidación del siniestro en tiempo real.

---

### 2.6 Portal de Administración y Auditoría (`/v1/admin`)
* `GET /v1/admin/claims/review-queue`: Lista de siniestros pendientes de revisión manual por auditores veterinarios.
* `POST /v1/admin/claims/{id}/adjudicate`: Aprobación o rechazo formal de siniestro con justificación y registro en auditoría.
* `GET /v1/admin/audit-logs`: Consulta de eventos inmutables filtrados por fecha, usuario, actor o entidad.
