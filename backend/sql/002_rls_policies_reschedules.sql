-- =============================================================================
-- 002_rls_policies_reschedules.sql
-- 
-- Configures Row Level Security (RLS) policies for the reschedules table.
-- This script is idempotent (safe to run multiple times).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enable RLS on the reschedules table (defensive, even if already enabled)
-- -----------------------------------------------------------------------------
ALTER TABLE appointments_app.reschedules ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Drop existing policies (for idempotency)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS reschedules_select_authenticated ON appointments_app.reschedules;
DROP POLICY IF EXISTS reschedules_insert_authenticated ON appointments_app.reschedules;
DROP POLICY IF EXISTS reschedules_update_authenticated ON appointments_app.reschedules;
DROP POLICY IF EXISTS reschedules_delete_authenticated ON appointments_app.reschedules;

-- -----------------------------------------------------------------------------
-- 3. Create RLS policies for authenticated users
--    These policies allow full access for authenticated users.
--    Adjust as needed for more granular access control.
-- -----------------------------------------------------------------------------

-- SELECT policy: authenticated users can read all rows
CREATE POLICY reschedules_select_authenticated
    ON appointments_app.reschedules
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT policy: authenticated users can insert rows
CREATE POLICY reschedules_insert_authenticated
    ON appointments_app.reschedules
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE policy: authenticated users can update all rows
CREATE POLICY reschedules_update_authenticated
    ON appointments_app.reschedules
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE policy: authenticated users can delete all rows
CREATE POLICY reschedules_delete_authenticated
    ON appointments_app.reschedules
    FOR DELETE
    TO authenticated
    USING (true);

-- -----------------------------------------------------------------------------
-- Done
-- -----------------------------------------------------------------------------

