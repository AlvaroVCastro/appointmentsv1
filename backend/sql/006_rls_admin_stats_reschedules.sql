-- =============================================================================
-- 006_rls_admin_stats_reschedules.sql
-- 
-- Adds RLS policies for admin_dashboard_stats and reschedules tables.
-- Without these policies, the tables return no data via the Data API.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RLS for admin_dashboard_stats
-- -----------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE appointments_app.admin_dashboard_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all stats
CREATE POLICY "admins_can_view_all_stats" ON appointments_app.admin_dashboard_stats
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM appointments_app.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Service role can manage stats (used by Edge Function)
CREATE POLICY "service_role_can_manage_stats" ON appointments_app.admin_dashboard_stats
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 2. RLS for reschedules
-- -----------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE appointments_app.reschedules ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all reschedules
CREATE POLICY "admins_can_view_all_reschedules" ON appointments_app.reschedules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM appointments_app.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Doctors can view their own reschedules (from user_profiles or user_doctor_codes)
CREATE POLICY "doctors_can_view_own_reschedules" ON appointments_app.reschedules
    FOR SELECT
    USING (
        doctor_code IN (
            SELECT doctor_code FROM appointments_app.user_profiles
            WHERE id = auth.uid() AND doctor_code IS NOT NULL
        )
        OR
        doctor_code IN (
            SELECT doctor_code FROM appointments_app.user_doctor_codes
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Authenticated users can insert reschedules
CREATE POLICY "authenticated_can_insert_reschedules" ON appointments_app.reschedules
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- Done
-- =============================================================================
