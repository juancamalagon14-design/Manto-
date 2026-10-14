-- Esquema inicial de Manto 2.0.
--
-- Criterio de diseño, y es deliberado:
--
--   · El resultado actuarial (`pricing_result`) y la evaluación de
--     elegibilidad se guardan como `jsonb` VERBATIM. Son documentos
--     congelados: una prima tiene que poder reproducirse años después
--     exactamente como se calculó, y trocearla en columnas invita a que la
--     estructura derive del cálculo original. Nunca se reescriben.
--
--   · Todo lo que se consulta, se lista o se reporta va en columnas
--     indexadas: números de cotización y póliza, estados, fechas, datos de la
--     mascota y del titular, y las primas.
--
--   · Los datos personales van SIEMPRE en columnas, nunca dentro de `jsonb`.
--     Ley 1581 de 2012 da al titular el derecho de supresión, y un dato
--     enterrado en un documento congelado no se puede borrar sin romper el
--     documento. Por eso la llave Bre-B —que es una cédula, un teléfono o un
--     correo— está en dos columnas y no dentro de la factura.
--
--   · Las restricciones que antes eran «lo revisa el servicio» pasan a ser
--     garantías de la base: la unicidad del CUFE, la de una póliza por
--     cotización, los estados admisibles, y el amparo obligatorio de la
--     Ley 1801.

CREATE SCHEMA IF NOT EXISTS insurance;

-- ------------------------------------------------- razas de manejo especial
--
-- La Ley 1801 de 2016 exige RCE de 50 SMLMV para estas razas. La lista vive en
-- el dominio (`SPECIAL_HANDLING_BREED_CODES` en `pricing.constants.ts`) y se
-- replica aquí a propósito: la base no puede depender de que la aplicación esté
-- correcta para hacer cumplir un mínimo legal.
--
-- La divergencia entre las dos copias no queda al azar: la prueba
-- `ley-1801.base.spec.ts` compara esta tabla contra la constante del dominio y
-- se pone roja si alguien añade una raza sin migración. Que el catálogo legal
-- de razas cambie es un hecho regulatorio, y merece una migración.

CREATE TABLE insurance.razas_manejo_especial (
  breed_code text PRIMARY KEY
);

INSERT INTO insurance.razas_manejo_especial (breed_code) VALUES
  ('AMERICAN_PIT_BULL_TERRIER'),
  ('AMERICAN_STAFFORDSHIRE_TERRIER'),
  ('STAFFORDSHIRE_TERRIER'),
  ('BULL_TERRIER'),
  ('BULLMASTIFF'),
  ('DOBERMAN'),
  ('DOGO_ARGENTINO'),
  ('DOGUE_DE_BORDEAUX'),
  ('FILA_BRASILEIRO'),
  ('NEAPOLITAN_MASTIFF'),
  ('PRESA_CANARIO'),
  ('ROTTWEILER'),
  ('TOSA_INU'),
  ('AMERICAN_BULLY'),
  ('CANE_CORSO');

-- ---------------------------------------------------------------- cotizaciones

CREATE TABLE insurance.quotes (
  id                          uuid        PRIMARY KEY,
  quote_number                text        NOT NULL UNIQUE,
  status                      text        NOT NULL
    CHECK (status IN ('DRAFT', 'OFFERED', 'BOUND', 'EXPIRED', 'REJECTED')),

  -- Datos de la mascota con los que se tarifó.
  pet_name                    text        NOT NULL,
  species                     text        NOT NULL CHECK (species IN ('CANINE', 'FELINE')),
  breed_code                  text        NOT NULL,
  size_category               text        CHECK (size_category IN ('TOY','SMALL','MEDIUM','LARGE','GIANT')),
  -- Cota absoluta de cordura. El rango asegurable propiamente dicho es 2–144 y
  -- se aplica más abajo, solo a las cotizaciones que se ofrecen.
  age_in_months               integer     NOT NULL CHECK (age_in_months BETWEEN 0 AND 600),
  city                        text        NOT NULL CHECK (city IN ('BOGOTA','MEDELLIN','CALI','OTHER')),
  gender                      text        NOT NULL CHECK (gender IN ('MALE', 'FEMALE')),
  pets_in_policy              integer     CHECK (pets_in_policy BETWEEN 1 AND 10),
  is_sterilized               boolean     NOT NULL,

  -- Condiciones contratadas.
  deductible_percentage       numeric(4,2) NOT NULL CHECK (deductible_percentage IN (0.10, 0.15, 0.20)),
  selected_addon_keys         text[]      NOT NULL DEFAULT '{}',
  billing_frequency           text        NOT NULL CHECK (billing_frequency IN ('MONTHLY', 'ANNUAL')),

  -- Titular. Datos personales: columnas, para que sean suprimibles.
  customer_full_name          text,
  customer_email              text,
  customer_phone              text,

  -- Primas desnormalizadas para reportería. La fuente sigue siendo el snapshot.
  total_monthly_premium_cop   bigint      CHECK (total_monthly_premium_cop >= 0),
  total_annual_premium_cop    bigint      CHECK (total_annual_premium_cop >= 0),

  -- Documentos congelados.
  pricing_result              jsonb,
  eligibility_result          jsonb       NOT NULL,
  rejection_reasons           text[],

  product_version             text        NOT NULL,
  rules_version               text        NOT NULL,

  created_at                  timestamptz NOT NULL,
  expires_at                  timestamptz NOT NULL,
  bound_at                    timestamptz,

  -- Una cotización ofrecida tiene que traer cálculo; una rechazada, no.
  CONSTRAINT ofrecida_con_calculo CHECK (
    (status = 'REJECTED' AND pricing_result IS NULL) OR
    (status <> 'REJECTED' AND pricing_result IS NOT NULL)
  ),

  -- La edad asegurable de nuevo ingreso es 2 a 144 meses, pero la restricción
  -- solo puede aplicar a lo que se OFRECE. `EligibilityService` está diseñado
  -- para producir una cotización REJECTED cuando la mascota excede la edad, y
  -- el servicio la guarda: un CHECK sin esta salvedad convertía esa rama en un
  -- error 500 y dejaba al cliente sin la explicación de por qué no se puede
  -- asegurar a su mascota.
  CONSTRAINT edad_asegurable_si_se_ofrece CHECK (
    status = 'REJECTED' OR age_in_months BETWEEN 2 AND 144
  )
);

CREATE INDEX quotes_expires_at_idx    ON insurance.quotes (expires_at);
CREATE INDEX quotes_status_idx        ON insurance.quotes (status);
CREATE INDEX quotes_customer_email_idx ON insurance.quotes (lower(customer_email))
  WHERE customer_email IS NOT NULL;

-- --------------------------------------------------------------------- pólizas

CREATE TABLE insurance.policies (
  id                          uuid        PRIMARY KEY,
  policy_number               text        UNIQUE,
  quote_id                    uuid        NOT NULL REFERENCES insurance.quotes (id),
  quote_number                text        NOT NULL,
  status                      text        NOT NULL
    CHECK (status IN ('DRAFT','PENDING_PAYMENT','ACTIVE','PENDING_RENEWAL','SUSPENDED','EXPIRED','CANCELLED')),

  -- Titular. La cédula es dato de identificación: va aparte de los de contacto.
  -- Ninguno es NOT NULL a nivel de columna porque el derecho de supresión de la
  -- Ley 1581 tiene que poder vaciarlos; lo que garantiza que estén presentes
  -- mientras la póliza identifica a alguien es `titular_identificado`.
  customer_full_name          text,
  customer_email              text,
  customer_phone              text,
  customer_national_id        text,

  -- Marca de supresión de datos personales (Ley 1581 art. 8 lit. e).
  -- Con fecha, la fila conserva su valor actuarial y contable pero ya no
  -- identifica a una persona.
  pii_suprimida_en            timestamptz,

  pet_data                    jsonb       NOT NULL,
  coverages                   jsonb       NOT NULL,

  monthly_premium_cop         bigint      NOT NULL CHECK (monthly_premium_cop >= 0),
  annual_premium_cop          bigint      NOT NULL CHECK (annual_premium_cop >= 0),
  billing_frequency           text        NOT NULL CHECK (billing_frequency IN ('MONTHLY','ANNUAL')),

  effective_date              timestamptz,
  expiration_date             timestamptz,
  policy_certificate_hash     text,
  rules_version               text        NOT NULL,
  auto_renewal_enabled        boolean     NOT NULL DEFAULT true,

  grace_period_ends_at        timestamptz,
  last_payment_transaction_id text,
  cancellation_reason         text,
  cancelled_at                timestamptz,

  created_at                  timestamptz NOT NULL,
  updated_at                  timestamptz NOT NULL,

  -- Una cotización no puede producir dos pólizas. En memoria esto era una
  -- consulta previa en el servicio, o sea una condición de carrera; aquí es
  -- una garantía de la base.
  CONSTRAINT una_poliza_por_cotizacion UNIQUE (quote_id),

  -- Una póliza activa tiene número, vigencia y certificado. Sin excepción:
  -- la interfaz llegó a anunciar «póliza emitida» sobre un registro que no
  -- tenía ninguno de los tres.
  CONSTRAINT activa_esta_completa CHECK (
    status <> 'ACTIVE' OR (
      policy_number IS NOT NULL AND
      effective_date IS NOT NULL AND
      expiration_date IS NOT NULL AND
      policy_certificate_hash IS NOT NULL
    )
  ),

  -- Mientras no se hayan suprimido los datos del titular, el nombre y el
  -- correo son obligatorios: el correo es la vía por la que se entrega el
  -- certificado de la póliza.
  CONSTRAINT titular_identificado CHECK (
    pii_suprimida_en IS NOT NULL OR (
      customer_full_name IS NOT NULL AND customer_email IS NOT NULL
    )
  )
);

CREATE INDEX policies_status_idx          ON insurance.policies (status);
CREATE INDEX policies_expiration_date_idx ON insurance.policies (expiration_date);
CREATE INDEX policies_customer_email_idx  ON insurance.policies (lower(customer_email))
  WHERE customer_email IS NOT NULL;

-- ------------------------------------------- Ley 1801: el amparo inevadible
--
-- `CLAUDE.md` dice que la RCE de las razas de manejo especial la fuerza el
-- motor de cálculo y que es «inevadible por diseño». Lo era en el motor, pero
-- no en la base: una actualización de `coverages` podía dejar a un Rottweiler
-- sin el amparo obligatorio, y el esquema lo aceptaba sin protestar.
--
-- No se verifica el MONTO, y es a propósito: 50 SMLMV cambian cada enero y una
-- cifra escrita en SQL quedaría desactualizada en silencio, que es peor que no
-- tenerla. Lo que la base garantiza es estructural y no expira: que el amparo
-- esté, que tenga tope positivo, y que no lleve copago —un mínimo legal no se
-- le cobra en parte al titular—. El monto exacto es responsabilidad del motor,
-- que sí conoce el SMLMV vigente.

CREATE FUNCTION insurance.exigir_rce_ley_1801() RETURNS trigger AS $$
DECLARE
  raza    text;
  amparo  jsonb;
  copago  numeric;
BEGIN
  raza := NEW.pet_data->>'breedCode';

  IF NOT EXISTS (
    SELECT 1 FROM insurance.razas_manejo_especial WHERE breed_code = raza
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c INTO amparo
    FROM jsonb_array_elements(NEW.coverages) AS c
   WHERE c->>'code' = 'CIVIL_LIABILITY_1801'
   LIMIT 1;

  IF amparo IS NULL THEN
    RAISE EXCEPTION
      'La mascota es de raza de manejo especial (%) y la póliza no lleva el amparo CIVIL_LIABILITY_1801 que exige la Ley 1801 de 2016.',
      raza
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE((amparo->>'annualLimitCop')::numeric, 0) <= 0 THEN
    RAISE EXCEPTION
      'El amparo obligatorio de Ley 1801 de la raza % quedó con tope %, y un mínimo legal no puede ser cero.',
      raza, COALESCE(amparo->>'annualLimitCop', 'nulo')
      USING ERRCODE = 'check_violation';
  END IF;

  copago := COALESCE((amparo->>'deductiblePercentage')::numeric, 0);
  IF copago <> 0 THEN
    RAISE EXCEPTION
      'El amparo obligatorio de Ley 1801 de la raza % quedó con copago %, y un mínimo legal no se le cobra en parte al titular.',
      raza, copago
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER policies_exigir_rce_ley_1801
  BEFORE INSERT OR UPDATE ON insurance.policies
  FOR EACH ROW EXECUTE FUNCTION insurance.exigir_rce_ley_1801();

-- El mismo mínimo, sobre la oferta. Una cotización ofrecida a un Rottweiler sin
-- el amparo es un defecto por sí sola, aunque nunca llegue a emitirse: es lo
-- que el cliente vio y el precio que se le prometió.
CREATE FUNCTION insurance.exigir_rce_ley_1801_en_oferta() RETURNS trigger AS $$
DECLARE
  amparo jsonb;
BEGIN
  IF NEW.pricing_result IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM insurance.razas_manejo_especial WHERE breed_code = NEW.breed_code
  ) THEN
    RETURN NEW;
  END IF;

  SELECT a INTO amparo
    FROM jsonb_array_elements(NEW.pricing_result->'activeAddons') AS a
   WHERE a->>'key' = 'CIVIL_LIABILITY_1801'
   LIMIT 1;

  IF amparo IS NULL THEN
    RAISE EXCEPTION
      'La cotización es de raza de manejo especial (%) y su cálculo no incluye el amparo CIVIL_LIABILITY_1801 que exige la Ley 1801 de 2016.',
      NEW.breed_code
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_exigir_rce_ley_1801
  BEFORE INSERT OR UPDATE ON insurance.quotes
  FOR EACH ROW EXECUTE FUNCTION insurance.exigir_rce_ley_1801_en_oferta();

-- ------------------------------------------------------------------ siniestros

CREATE TABLE insurance.claims (
  id                          uuid        PRIMARY KEY,
  claim_number                text        NOT NULL UNIQUE,
  policy_id                   uuid        NOT NULL REFERENCES insurance.policies (id),
  policy_number               text        NOT NULL,
  status                      text        NOT NULL
    CHECK (status IN ('SUBMITTED','STP_APPROVED','HUMAN_REVIEW','APPROVED_BY_ADJUSTER','REJECTED','PAID')),

  incident_type               text        NOT NULL
    CHECK (incident_type IN ('ACCIDENT','COMMON_ILLNESS','EMERGENCY_CONSULTATION','CIVIL_LIABILITY')),
  incident_date               timestamptz NOT NULL,
  description                 text        NOT NULL,

  -- CUFE de la factura electrónica de la DIAN.
  -- UNIQUE es un control antifraude: la misma factura no se reembolsa dos
  -- veces. `findByCufe` lo revisaba con una consulta previa, que dos
  -- radicaciones simultáneas podían burlar.
  dian_cufe                   text        NOT NULL UNIQUE,
  dian_invoice                jsonb       NOT NULL,

  -- La llave Bre-B en columnas, no en `jsonb`.
  -- Su valor es una cédula, un teléfono o un correo del titular: es dato
  -- personal y además un identificador financiero. Dentro de un documento
  -- congelado no se podría suprimir sin romper el documento.
  bre_b_key_type              text
    CHECK (bre_b_key_type IN ('PHONE_NUMBER','NATIONAL_ID','EMAIL','ALPHANUMERIC')),
  bre_b_key_value             text,
  pii_suprimida_en            timestamptz,

  eligible_expenses_cop       bigint      NOT NULL CHECK (eligible_expenses_cop > 0),
  deductible_cop              bigint      NOT NULL CHECK (deductible_cop >= 0),
  net_reimbursement_cop       bigint      NOT NULL CHECK (net_reimbursement_cop >= 0),

  -- Decisión del motor STP, congelada: es la justificación de por qué se pagó
  -- o no se pagó, y tiene que poder releerse tal como se tomó.
  stp_evaluation              jsonb       NOT NULL,

  disbursement_id             text,
  disbursement_tracking_code  text,
  financial_institution       text,

  submitted_at                timestamptz NOT NULL,
  adjudicated_at              timestamptz,
  adjudicated_by              text,
  rejection_reason            text,
  audit_notes                 text,

  -- El reembolso neto nunca puede exceder el gasto elegible.
  CONSTRAINT reembolso_no_excede_gasto CHECK (net_reimbursement_cop <= eligible_expenses_cop),

  -- Mientras no se supriman los datos, la llave de dispersión tiene que estar
  -- completa: es por donde sale el dinero.
  CONSTRAINT llave_bre_b_completa CHECK (
    pii_suprimida_en IS NOT NULL OR (
      bre_b_key_type IS NOT NULL AND bre_b_key_value IS NOT NULL
    )
  )
);

CREATE INDEX claims_policy_id_idx     ON insurance.claims (policy_id);
CREATE INDEX claims_status_idx        ON insurance.claims (status);
CREATE INDEX claims_incident_date_idx ON insurance.claims (incident_date);
CREATE INDEX claims_submitted_at_idx  ON insurance.claims (submitted_at);
