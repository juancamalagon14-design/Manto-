-- =============================================================================
-- MIGRACIÓN 003: HISTORIA CLÍNICA OBLIGATORIA, SLAS DINÁMICOS Y COBERTURA RCE 1801
-- =============================================================================

ALTER TABLE insurance.claims
  ADD COLUMN IF NOT EXISTS clinical_record jsonb,
  ADD COLUMN IF NOT EXISTS sla_category text,
  ADD COLUMN IF NOT EXISTS sla_resolution_estimated_time text;

ALTER TABLE insurance.claims DROP CONSTRAINT IF EXISTS claims_incident_type_check;
ALTER TABLE insurance.claims ADD CONSTRAINT claims_incident_type_check
  CHECK (incident_type IN ('ACCIDENT','COMMON_ILLNESS','EMERGENCY_CONSULTATION','CIVIL_LIABILITY','CIVIL_LIABILITY_1801','PREVENTIVE_WELLNESS'));
