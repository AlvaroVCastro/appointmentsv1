-- =============================================================================
-- 003_admin_dashboard_stats.sql
-- 
-- Creates the admin_dashboard_stats table for storing pre-computed daily
-- occupation percentages and reschedule counts for doctors.
-- This table is populated by the compute-dashboard-stats Edge Function
-- which runs daily at 7:00 AM.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create admin_dashboard_stats table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments_app.admin_dashboard_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_code text NOT NULL,
    doctor_name text,
    occupation_percentage numeric(5,2),
    total_slots integer,
    occupied_slots integer,
    total_reschedules_30d integer DEFAULT 0,
    computed_at timestamp NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Create unique index on (doctor_code, computed_at::date)
-- This ensures only one record per doctor per day
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS admin_dashboard_stats_doctor_code_computed_date_idx
    ON appointments_app.admin_dashboard_stats (doctor_code, (computed_at::date));

-- -----------------------------------------------------------------------------
-- 3. Create indexes for common query patterns
-- -----------------------------------------------------------------------------

-- Index for querying latest stats
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_stats_computed_at
    ON appointments_app.admin_dashboard_stats (computed_at DESC);

-- Index for querying by doctor
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_stats_doctor_code
    ON appointments_app.admin_dashboard_stats (doctor_code);

-- -----------------------------------------------------------------------------
-- 4. Grant permissions
-- -----------------------------------------------------------------------------
GRANT ALL ON appointments_app.admin_dashboard_stats TO service_role;
GRANT SELECT ON appointments_app.admin_dashboard_stats TO authenticated;

-- -----------------------------------------------------------------------------
-- Done
-- -----------------------------------------------------------------------------
