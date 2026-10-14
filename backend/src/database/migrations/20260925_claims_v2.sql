-- =============================================================================
-- MIGRACIÓN 20260925: SINIESTROS V2 — PERSISTENCIA INTEGRAL, TRIAGE Y BÓVEDA
-- =============================================================================
-- Plataforma: Manto 2.0 (Insurtech Colombia)
-- Autor: manto-software-architect
-- Cumplimiento: Ley 1581 de 2012 (Habeas Data), Ley 1801 de 2016 (RCE 50 SMLMV)
-- Motor de Base de Datos: PostgreSQL 16
-- =============================================================================

-- 1. EXTENSIÓN DE LA TABLA PRINCIPAL DE SINIESTROS (insurance.claims)
-- -----------------------------------------------------------------------------

-- Agregar columnas de enrutamiento de triage y reportería financiera
ALTER TABLE insurance.claims
  ADD COLUMN IF NOT EXISTS triage_route text,
  ADD COLUMN IF NOT EXISTS triage_reasons text[],
  ADD COLUMN IF NOT EXISTS claimed_amount_cop bigint,
  ADD COLUMN IF NOT EXISTS approved_amount_cop bigint;

-- Restricción de verificación para triage_route
ALTER TABLE insurance.claims DROP CONSTRAINT IF EXISTS claims_triage_route_check;
ALTER TABLE insurance.claims ADD CONSTRAINT claims_triage_route_check
  CHECK (triage_route IS NULL OR triage_route IN ('FAST_TRACK', 'MANUAL_AUDIT'));

-- Restricciones de integridad monetaria estricta (enteros no negativos)
ALTER TABLE insurance.claims DROP CONSTRAINT IF EXISTS claims_claimed_amount_check;
ALTER TABLE insurance.claims ADD CONSTRAINT claims_claimed_amount_check
  CHECK (claimed_amount_cop IS NULL OR claimed_amount_cop >= 0);

ALTER TABLE insurance.claims DROP CONSTRAINT IF EXISTS claims_approved_amount_check;
ALTER TABLE insurance.claims ADD CONSTRAINT claims_approved_amount_check
  CHECK (approved_amount_cop IS NULL OR approved_amount_cop >= 0);

-- Garantizar no nulidad en clinical_record (Historia Clínica obligatoria)
UPDATE insurance.claims
   SET clinical_record = '{}'::jsonb
 WHERE clinical_record IS NULL;

ALTER TABLE insurance.claims ALTER COLUMN clinical_record SET NOT NULL;

-- Actualizar la máquina de estados en base de datos: Check constraint integral
ALTER TABLE insurance.claims DROP CONSTRAINT IF EXISTS claims_status_check;
ALTER TABLE insurance.claims ADD CONSTRAINT claims_status_check
  CHECK (status IN (
    'DRAFT',
    'SUBMITTED',
    'ANALYZING_DOCUMENTS',
    'FAST_TRACK_APPROVED',
    'MANUAL_AUDIT_REQUIRED',
    'STP_APPROVED',
    'HUMAN_REVIEW',
    'APPROVED_BY_ADJUSTER',
    'REJECTED',
    'INFO_REQUESTED',
    'PAYMENT_PENDING',
    'PAID',
    'DISPUTED'
  ));

-- Índices btree de rendimiento y antifraude en insurance.claims
CREATE INDEX IF NOT EXISTS idx_claims_triage_route
  ON insurance.claims (triage_route);

CREATE INDEX IF NOT EXISTS idx_claims_sla_category
  ON insurance.claims (sla_category);

CREATE INDEX IF NOT EXISTS idx_claims_dian_cufe_btree
  ON insurance.claims ((dian_invoice->>'dianCufe'));

CREATE INDEX IF NOT EXISTS idx_claims_clinical_symptoms
  ON insurance.claims ((clinical_record->>'symptomsOnsetDate'));

CREATE INDEX IF NOT EXISTS idx_claims_clinical_microchip
  ON insurance.claims ((clinical_record->>'microchipNumber'))
  WHERE (clinical_record->>'microchipNumber') IS NOT NULL;


-- 2. BÓVEDA DE DOCUMENTOS Y EVIDENCIAS PERICIALES (insurance.claim_documents)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS insurance.claim_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES insurance.claims(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  session_id TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'DIAN_INVOICE',
    'MEDICAL_HISTORY_EPICRISIS',
    'LAB_RESULTS',
    'PRESCRIPTION',
    'INCIDENT_PHOTO',
    'DAMAGE_EVIDENCE',
    'INCIDENT_PHOTOGRAPH',
    'OTHER'
  )),
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),
  sha256_checksum VARCHAR(64) NOT NULL CHECK (length(sha256_checksum) = 64),
  upload_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (upload_status IN ('PENDING', 'UPLOADED', 'REJECTED')),
  ocr_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (ocr_status IN ('PENDING', 'PROCESSING', 'EXTRACTED', 'FAILED')),
  ocr_confidence NUMERIC(4,3) CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)),
  ocr_extracted_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_documents_claim_id
  ON insurance.claim_documents(claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_documents_checksum
  ON insurance.claim_documents(sha256_checksum);

CREATE INDEX IF NOT EXISTS idx_claim_documents_user_id
  ON insurance.claim_documents(user_id);


-- 3. BITÁCORA APPEND-ONLY DE AUDITORÍA Y TRAZABILIDAD (insurance.claim_audit_logs)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS insurance.claim_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES insurance.claims(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN (
    'POLICYHOLDER',
    'SYSTEM_AI',
    'TRIAGE_ENGINE',
    'STP_ENGINE',
    'VET_ADJUSTER',
    'FINANCE_OPERATOR',
    'ADMIN'
  )),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_audit_logs_claim_id
  ON insurance.claim_audit_logs(claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_audit_logs_created_at
  ON insurance.claim_audit_logs(created_at);

-- Inmutabilidad garantizada por base de datos: Prohibido UPDATE o DELETE sobre auditoría
CREATE OR REPLACE FUNCTION insurance.bloquear_modificacion_audit_logs()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Operación denegada: insurance.claim_audit_logs es estrictamente inmutable (append-only).'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proteger_claim_audit_logs ON insurance.claim_audit_logs;
CREATE TRIGGER trg_proteger_claim_audit_logs
  BEFORE UPDATE OR DELETE ON insurance.claim_audit_logs
  FOR EACH ROW EXECUTE FUNCTION insurance.bloquear_modificacion_audit_logs();
