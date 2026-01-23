-- =============================================================================
-- 005_user_doctor_codes.sql
-- 
-- Creates the user_doctor_codes table for associating multiple doctor codes
-- to a single user (e.g., assistants managing multiple doctors).
-- 
-- NOTE: The primary doctor_code in user_profiles is kept as the "main" code.
-- This table stores ADDITIONAL codes only.
-- =============================================================================

-- 1. Create table for additional doctor codes
CREATE TABLE appointments_app.user_doctor_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES appointments_app.user_profiles(id) ON DELETE CASCADE,
    doctor_code text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, doctor_code)
);

-- 2. Create indexes for fast lookups
CREATE INDEX idx_user_doctor_codes_user_id ON appointments_app.user_doctor_codes(user_id);
CREATE INDEX idx_user_doctor_codes_doctor_code ON appointments_app.user_doctor_codes(doctor_code);

-- 3. Enable RLS
ALTER TABLE appointments_app.user_doctor_codes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Admins can manage all doctor codes
CREATE POLICY "admins_can_manage_all_doctor_codes" ON appointments_app.user_doctor_codes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM appointments_app.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM appointments_app.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 5. RLS Policy: Users can view their own additional codes
CREATE POLICY "users_can_view_own_doctor_codes" ON appointments_app.user_doctor_codes
    FOR SELECT
    USING (user_id = auth.uid());

-- =============================================================================
-- Done
-- =============================================================================
