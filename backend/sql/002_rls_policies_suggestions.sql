-- =============================================================================
-- 002_rls_policies_suggestions.sql
-- 
-- Configures Row Level Security (RLS) policies for the suggestions table.
-- This script is idempotent (safe to run multiple times).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enable RLS on the suggestions table (defensive, even if already enabled)
-- -----------------------------------------------------------------------------
ALTER TABLE appointments_app.suggestions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Drop existing policies (for idempotency)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS suggestions_select_authenticated ON appointments_app.suggestions;
DROP POLICY IF EXISTS suggestions_insert_authenticated ON appointments_app.suggestions;
DROP POLICY IF EXISTS suggestions_update_authenticated ON appointments_app.suggestions;
DROP POLICY IF EXISTS suggestions_delete_authenticated ON appointments_app.suggestions;

-- -----------------------------------------------------------------------------
-- 3. Create RLS policies for authenticated users
--    These policies allow full access for authenticated users.
--    Adjust as needed for more granular access control.
-- -----------------------------------------------------------------------------

-- SELECT policy: authenticated users can read all rows
CREATE POLICY suggestions_select_authenticated
    ON appointments_app.suggestions
    FOR SELECT
    TO authenticated
    USING (true);

-- INSERT policy: authenticated users can insert rows
CREATE POLICY suggestions_insert_authenticated
    ON appointments_app.suggestions
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE policy: authenticated users can update all rows
CREATE POLICY suggestions_update_authenticated
    ON appointments_app.suggestions
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE policy: authenticated users can delete all rows
CREATE POLICY suggestions_delete_authenticated
    ON appointments_app.suggestions
    FOR DELETE
    TO authenticated
    USING (true);

-- -----------------------------------------------------------------------------
-- Done
-- -----------------------------------------------------------------------------

