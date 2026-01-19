-- =============================================================================
-- 004_add_doctor_code_to_user_profiles.sql
-- 
-- Adds doctor_code column to user_profiles table.
-- This links app users (doctors) to their Glintt human resource codes.
-- 
-- NOTE: This migration may already be applied manually. Run with IF NOT EXISTS
-- to make it idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add doctor_code column if it doesn't exist
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'appointments_app' 
        AND table_name = 'user_profiles' 
        AND column_name = 'doctor_code'
    ) THEN
        ALTER TABLE appointments_app.user_profiles 
        ADD COLUMN doctor_code text UNIQUE;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Create index for fast lookups (if not exists)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_profiles_doctor_code 
    ON appointments_app.user_profiles (doctor_code);

-- -----------------------------------------------------------------------------
-- Done
-- -----------------------------------------------------------------------------
