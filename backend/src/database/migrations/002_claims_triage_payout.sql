-- =============================================================================
-- MIGRACIÓN DDL: RADICACIÓN, TRIAGE Y PAGO DE SINIESTROS (V1.1.0)
-- Esquema: claims
-- Motor: PostgreSQL 16+
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS claims;
CREATE SCHEMA IF NOT EXISTS core;

-- -----------------------------------------------------------------------------
-- 0. TABLA DE SOPORTE CORE: core.users (Para integridad referencial y aislamiento)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.users (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    national_id TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 1. ENUMS CANÓNICOS
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE claims.claim_status_enum AS ENUM (
        'DRAFT',
        'SUBMITTED',
        'ANALYZING_DOCUMENTS',
        'FAST_TRACK_APPROVED',
        'MANUAL_AUDIT_REQUIRED',
        'APPROVED_BY_ADJUSTER',
        'REJECTED',
        'INFO_REQUESTED',
        'PAYMENT_PENDING',
        'PAID',
        'DISPUTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE claims.triage_route_enum AS ENUM (
        'FAST_TRACK',
        'MANUAL_AUDIT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE claims.incident_type_enum AS ENUM (
        'ACCIDENT',
        'COMMON_ILLNESS',
        'EMERGENCY_CONSULTATION',
        'CIVIL_LIABILITY_1801',
        'PREVENTIVE_WELLNESS'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE claims.document_type_enum AS ENUM (
        'DIAN_INVOICE',
        'MEDICAL_HISTORY_EPICRISIS',
        'LAB_RESULTS',
        'PRESCRIPTION',
        'INCIDENT_PHOTO'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE claims.payout_channel_enum AS ENUM (
        'NEQUI',
        'DAVIPLATA',
        'BRE_B',
        'BANK_TRANSFER_ACH'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE claims.payout_status_enum AS ENUM (
        'SCHEDULED',
        'PROCESSING',
        'SETTLED',
        'FAILED',
        'REVERSED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE claims.audit_actor_type_enum AS ENUM (
        'POLICYHOLDER',
        'SYSTEM_AI',
        'TRIAGE_ENGINE',
        'VET_ADJUSTER',
        'FINANCE_OPERATOR',
        'ADMIN'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. TABLA: claims.claims (Radicación principal del siniestro)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claims.claims (
    id UUID PRIMARY KEY,
    claim_number VARCHAR(32) NOT NULL UNIQUE,
    policy_id UUID NOT NULL REFERENCES insurance.policies(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    incident_type claims.incident_type_enum NOT NULL,
    incident_date TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    vet_clinic_nit VARCHAR(20) NOT NULL,
    vet_clinic_name VARCHAR(150) NOT NULL,
    
    -- Montos en ColombianPeso (Enteros BIGINT sin decimales)
    claimed_amount_cop BIGINT NOT NULL CHECK (claimed_amount_cop > 0),
    approved_amount_cop BIGINT NOT NULL DEFAULT 0 CHECK (approved_amount_cop >= 0),
    deductible_cop BIGINT NOT NULL DEFAULT 0 CHECK (deductible_cop >= 0),
    copay_cop BIGINT NOT NULL DEFAULT 0 CHECK (copay_cop >= 0),
    net_payable_amount_cop BIGINT NOT NULL DEFAULT 0 CHECK (net_payable_amount_cop >= 0),
    
    -- Restricciones de Integridad Actuarial y Financiera
    CONSTRAINT chk_claims_approved_le_claimed CHECK (approved_amount_cop <= claimed_amount_cop),
    CONSTRAINT chk_claims_net_payable_le_approved CHECK (net_payable_amount_cop <= approved_amount_cop),
    
    -- Estados y Triage
    status claims.claim_status_enum NOT NULL DEFAULT 'SUBMITTED',
    triage_route claims.triage_route_enum NULL,
    triage_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    fraud_risk_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (fraud_risk_score >= 0 AND fraud_risk_score <= 100),
    
    -- Datos DIAN y Prevención Antifraude
    dian_cufe VARCHAR(255) NULL,
    invoice_number VARCHAR(50) NULL,
    invoice_sha256_hash CHAR(64) NULL,
    
    -- Adjudicación Manual
    adjuster_id UUID NULL REFERENCES core.users(id) ON DELETE SET NULL,
    rejection_reason TEXT NULL,
    internal_notes TEXT NULL,
    
    -- Garantías de Concurrencia e Idempotencia
    version INTEGER NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    
    -- Trazabilidad Temporal
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de claims
CREATE INDEX IF NOT EXISTS idx_claims_policy_id ON claims.claims (policy_id);
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims.claims (user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims.claims (status);
CREATE INDEX IF NOT EXISTS idx_claims_created_at_desc ON claims.claims (created_at DESC);

-- Blindaje BUG-CRIT-02: Unicidad global de CUFE DIAN (excluyendo siniestros rechazados/disputados)
CREATE UNIQUE INDEX IF NOT EXISTS uq_claims_dian_cufe_global 
ON claims.claims (dian_cufe) 
WHERE dian_cufe IS NOT NULL AND status NOT IN ('REJECTED', 'DISPUTED');

-- Blindaje Antifraude: Hash único de archivo permitiendo reintentos en siniestros rechazados
CREATE UNIQUE INDEX IF NOT EXISTS uq_claims_invoice_hash 
ON claims.claims (invoice_sha256_hash) 
WHERE invoice_sha256_hash IS NOT NULL AND status NOT IN ('REJECTED', 'DISPUTED');

-- -----------------------------------------------------------------------------
-- 3. TABLA: claims.claim_documents (Bóveda de soportes y facturas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claims.claim_documents (
    id UUID PRIMARY KEY,
    claim_id UUID NULL REFERENCES claims.claims(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    session_id VARCHAR(64) NULL,
    document_type claims.document_type_enum NOT NULL,
    
    -- Ubicación en Almacenamiento Seguro (Cloudflare R2 / AWS S3)
    s3_bucket VARCHAR(100) NOT NULL,
    s3_key VARCHAR(500) NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400), -- Máx 25MB
    sha256_checksum CHAR(64) NOT NULL,
    upload_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (upload_status IN ('PENDING', 'UPLOADED', 'REJECTED')),
    
    -- Resultado del Escaneo OCR / AI
    ocr_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (ocr_status IN ('PENDING', 'PROCESSING', 'EXTRACTED', 'FAILED')),
    ocr_confidence NUMERIC(4, 3) NULL CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
    ocr_extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Seguridad y Aislamiento
    is_quarantined BOOLEAN NOT NULL DEFAULT FALSE,
    antivirus_scan_passed BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_docs_claim_id ON claims.claim_documents (claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_docs_user_id ON claims.claim_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_claim_docs_session_id ON claims.claim_documents (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claim_docs_sha256 ON claims.claim_documents (sha256_checksum);

-- -----------------------------------------------------------------------------
-- 4. TABLA: claims.claim_audit_logs (Trazabilidad Inmutable Append-Only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claims.claim_audit_logs (
    id UUID PRIMARY KEY,
    claim_id UUID NOT NULL REFERENCES claims.claims(id) ON DELETE RESTRICT,
    actor_type claims.audit_actor_type_enum NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    action VARCHAR(50) NOT NULL,
    previous_status claims.claim_status_enum NULL,
    new_status claims.claim_status_enum NULL,
    reason TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_audit_claim_id ON claims.claim_audit_logs (claim_id, created_at ASC);

-- Trigger de Inmutabilidad para Auditoría: Prohíbe UPDATE y DELETE
CREATE OR REPLACE FUNCTION claims.trg_enforce_audit_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación denegada: Los registros de claim_audit_logs son inmutables (Append-Only)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_claim_audit_logs ON claims.claim_audit_logs;
CREATE TRIGGER trg_protect_claim_audit_logs
BEFORE UPDATE OR DELETE ON claims.claim_audit_logs
FOR EACH ROW EXECUTE FUNCTION claims.trg_enforce_audit_immutability();

-- Blindaje SFC: Prohibición de vaciado masivo vía TRUNCATE
DROP TRIGGER IF EXISTS trg_protect_claim_audit_logs_truncate ON claims.claim_audit_logs;
CREATE TRIGGER trg_protect_claim_audit_logs_truncate
BEFORE TRUNCATE ON claims.claim_audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION claims.trg_enforce_audit_immutability();

-- -----------------------------------------------------------------------------
-- 5. TABLA: claims.payout_records (Dispersión financiera e indemnizaciones)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claims.payout_records (
    id UUID PRIMARY KEY,
    claim_id UUID NOT NULL UNIQUE REFERENCES claims.claims(id) ON DELETE RESTRICT,
    policy_id UUID NOT NULL REFERENCES insurance.policies(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    
    amount_cop BIGINT NOT NULL CHECK (amount_cop > 0),
    channel claims.payout_channel_enum NOT NULL,
    
    -- Datos de destino: Encriptado para dispersión y enmascarado para UI (Habeas Data)
    account_identifier_encrypted TEXT NOT NULL,
    account_identifier_masked VARCHAR(50) NOT NULL,
    account_holder_national_id VARCHAR(50) NOT NULL,
    bank_code VARCHAR(20) NULL,
    account_type VARCHAR(20) NULL CHECK (account_type IN ('SAVINGS', 'CHECKING', 'WALLET', 'BRE_B_KEY')),
    
    -- Integración con Pasarela de Dispersión
    provider_transaction_id VARCHAR(128) NULL UNIQUE,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    status claims.payout_status_enum NOT NULL DEFAULT 'SCHEDULED',
    
    settled_at TIMESTAMPTZ NULL,
    failure_code VARCHAR(50) NULL,
    failure_reason TEXT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 5),
    
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_records_status ON claims.payout_records (status);
CREATE INDEX IF NOT EXISTS idx_payout_records_claim_id ON claims.payout_records (claim_id);

-- Trigger de Actualización Automática de updated_at
CREATE OR REPLACE FUNCTION claims.trg_auto_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_claims_updated_at ON claims.claims;
CREATE TRIGGER trg_claims_updated_at
BEFORE UPDATE ON claims.claims
FOR EACH ROW EXECUTE FUNCTION claims.trg_auto_update_timestamp();

DROP TRIGGER IF EXISTS trg_payout_records_updated_at ON claims.payout_records;
CREATE TRIGGER trg_payout_records_updated_at
BEFORE UPDATE ON claims.payout_records
FOR EACH ROW EXECUTE FUNCTION claims.trg_auto_update_timestamp();
