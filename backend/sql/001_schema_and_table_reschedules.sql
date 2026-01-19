-- =============================================================================
-- 001_schema_and_table_reschedules.sql
-- 
-- Creates the appointments_app schema and reschedules table.
-- This script is idempotent (safe to run multiple times).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create schema if it does not exist
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS appointments_app;

-- -----------------------------------------------------------------------------
-- 2. Create reschedules table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments_app.reschedules (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_code               text NOT NULL,
    patient_id                text NOT NULL,
    patient_name              text,
    original_datetime         timestamp NOT NULL,
    original_duration_min     integer NOT NULL,
    original_service_code     text,
    original_medical_act_code text,
    new_datetime              timestamp NOT NULL,
    new_duration_min          integer NOT NULL,
    anticipation_days         integer NOT NULL,
    status                    text NOT NULL DEFAULT 'completed',
    impact                    text,
    notes                     text,
    created_at                timestamp NOT NULL DEFAULT now(),
    updated_at                timestamp NOT NULL DEFAULT now(),
    
    -- Check constraint for valid status values
    CONSTRAINT reschedules_status_check CHECK (
        status IN ('pending', 'completed', 'failed', 'cancelled')
    )
);

-- -----------------------------------------------------------------------------
-- 3. Create indexes for common query patterns
-- -----------------------------------------------------------------------------

-- Index for querying by doctor and new datetime
CREATE INDEX IF NOT EXISTS idx_reschedules_doctor_new
    ON appointments_app.reschedules (doctor_code, new_datetime);

-- Index for querying by doctor and original datetime
CREATE INDEX IF NOT EXISTS idx_reschedules_doctor_original
    ON appointments_app.reschedules (doctor_code, original_datetime);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_reschedules_status
    ON appointments_app.reschedules (status);

-- Index for ordering by creation date (most recent first)
CREATE INDEX IF NOT EXISTS idx_reschedules_created_at_desc
    ON appointments_app.reschedules (created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Create function for auto-updating updated_at timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION appointments_app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 5. Create trigger for updated_at (drop first if exists for idempotency)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_reschedules_updated_at ON appointments_app.reschedules;

CREATE TRIGGER trigger_reschedules_updated_at
    BEFORE UPDATE ON appointments_app.reschedules
    FOR EACH ROW
    EXECUTE FUNCTION appointments_app.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 6. Grant permissions to service_role and authenticated
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA appointments_app TO service_role, authenticated;
GRANT ALL ON appointments_app.reschedules TO service_role;
GRANT SELECT ON appointments_app.reschedules TO authenticated;

-- -----------------------------------------------------------------------------
-- Done
-- -----------------------------------------------------------------------------

