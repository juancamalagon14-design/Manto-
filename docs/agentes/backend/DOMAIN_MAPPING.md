# Mapeo de Módulos de Dominio en NestJS (Backend Domain Modules Mapping)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Agente:** Agente 3 - Senior Backend Engineer  
**Versión:** 1.0.0  
**Fecha:** Septiembre 2026  
**Estado:** Aprobado para Implementación Arquitectónica  

---

## 1. Mapeo de los 19 Módulos en el Monolito Modular NestJS

Cada uno de los 19 dominios especificados por el Orquestador cuenta con su módulo NestJS dedicado, sus servicios de aplicación, controladores REST (si expone API pública o administrativa), repositorios y DTOs fuertemente tipados.

```
backend/src/modules/
├── auth/                 # 1. Authentication (JWT, Argon2id, Sessions)
├── users/                # 2. Users (User Entity, Habeas Data Ley 1581)
├── lobs/
│   └── pet/              # 3. Pets (LOB Pet Risk Unit, Breeds, Vet Clinics)
├── products/             # 4. Insurance Products (Multi-LOB Catalog)
├── plans/                # 5. Plans (Commercial Tiers: Essential, Tranquility, Total)
├── coverages/            # 6. Coverages (Limits, Sublimits, Waiting Periods)
├── addons/               # 7. Add-ons (Modular Optional Coverages, Ley 1801 RCE)
├── eligibility/          # 8. Eligibility (Deterministic Underwriting Rules)
├── pricing/              # 9. Pricing (Actuarial Calculation Engine, No AI)
├── quotes/               # 10. Quotes (Traceable Quote Snapshots, 15-day Expiration)
├── policies/             # 11. Policies (Contract Lifecycle, State Machine, Versioning)
├── payments/             # 12. Payments (Wompi PSE / Cards Gateway Abstraction)
├── claims/               # 13. Claims (FNOL, Adjudication, STP <= $500k)
├── reimbursements/       # 14. Reimbursements (ACH / Transfiya Bank Payout Rails)
├── documents/            # 15. Documents (S3 Vault, Presigned URLs, ClamAV Quarantine)
├── ai/                   # 16. AI Processing (Isolated Vision & OCR Adapters)
├── notifications/        # 17. Notifications (Async Email, WhatsApp, Push via BullMQ)
├── admin/                # 18. Administration (Backoffice Console for Adjusters & Underwriters)
└── audit/                # 19. Audit Logs (Append-Only Tamper-Evident Ledger)
```

---

## 2. Definición Estructural por Módulo

| Módulo | Entidad Principal TypeORM | Servicios Exportados | Endpoints Expuestos |
| :--- | :--- | :--- | :--- |
| **`AuthModule`** | `AuthSession` | `AuthService`, `JwtStrategy` | `POST /v1/auth/login`, `POST /v1/auth/refresh` |
| **`UsersModule`** | `User`, `HabeasDataConsent` | `UsersService` | `POST /v1/auth/register`, `GET /v1/users/me` |
| **`PetsModule`** | `Pet`, `Breed`, `VetClinic` | `PetsService` | `POST /v1/pets`, `GET /v1/pets/{id}` |
| **`ProductsModule`** | `Product` | `ProductsService` | `GET /v1/products` |
| **`PlansModule`** | `Plan` | `PlansService` | `GET /v1/products/{id}/plans` |
| **`CoveragesModule`** | `Coverage`, `PlanCoverage`| `CoveragesService` | Interno / Admin |
| **`AddonsModule`** | `Addon` | `AddonsService` | `GET /v1/plans/{id}/addons` |
| **`EligibilityModule`** | No persiste (Motor puro) | `EligibilityService` | Invocado por Quotes |
| **`PricingModule`** | No persiste (Motor puro) | `PricingService` | Invocado por Quotes |
| **`QuotesModule`** | `Quote` | `QuotesService` | `POST /v1/quotes/calculate`, `POST /v1/quotes/{id}/bind` |
| **`PoliciesModule`** | `Policy` | `PoliciesService` | `GET /v1/policies/{id}`, `GET /v1/policies/my-policies` |
| **`PaymentsModule`** | `PaymentTransaction`, `PaymentMethod` | `PaymentsService` | `POST /v1/payments/intent`, `POST /v1/webhooks/wompi` |
| **`ClaimsModule`** | `Claim`, `ClaimItem` | `ClaimsService`, `StpEngine` | `POST /v1/claims`, `GET /v1/claims/{id}` |
| **`ReimbursementsModule`**| `Reimbursement` | `ReimbursementsService` | Dispersión interna |
| **`DocumentsModule`** | `DocumentVaultItem` | `DocumentsService`, `S3Service` | `POST /v1/documents/request-upload-url` |
| **`AiModule`** | `AiJob` | `AiVisionService`, `AiOcrService` | `POST /v1/ai/pet-vision` |
| **`NotificationsModule`**| No persiste estado crítico| `NotificationsService` | Invocado por eventos |
| **`AdminModule`** | No entidad propia | `AdminService` | `GET /v1/admin/claims`, `POST /v1/admin/adjudicate` |
| **`AuditModule`** | `AuditLog` (Append-Only) | `AuditService` | `GET /v1/admin/audit-logs` |

---

## 3. Principio de Cero Código sin Aprobación

Queda formalmente establecido que **no se generará ni escribirá código fuente de aplicación** hasta que la arquitectura completa, los modelos de dominio y las matrices de interacción hayan sido formalmente aprobados por el Product Owner y el equipo directivo.
