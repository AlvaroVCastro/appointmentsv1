-- =============================================================================
-- 007_admin_dashboard_filters.sql
--
-- Adiciona suporte a filtros por clínica na admin dashboard:
-- 1. Colunas clinics e service_codes na admin_dashboard_stats
-- 2. Nova tabela clinic_stats para stats agregadas por clínica
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Adicionar colunas à tabela admin_dashboard_stats
-- -----------------------------------------------------------------------------

-- Clínicas associadas ao médico (ex: {'Lisboa', 'Porto'})
ALTER TABLE appointments_app.admin_dashboard_stats
ADD COLUMN IF NOT EXISTS clinics text[];

-- Service codes associados ao médico (ex: {'436', '440', '500'})
ALTER TABLE appointments_app.admin_dashboard_stats
ADD COLUMN IF NOT EXISTS service_codes text[];

-- Índice GIN para queries eficientes em arrays
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_stats_clinics
ON appointments_app.admin_dashboard_stats USING GIN (clinics);

CREATE INDEX IF NOT EXISTS idx_admin_dashboard_stats_service_codes
ON appointments_app.admin_dashboard_stats USING GIN (service_codes);

-- -----------------------------------------------------------------------------
-- 2. Criar tabela clinic_stats para stats agregadas por clínica
-- Mesmas métricas da admin dashboard, mas por clínica
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS appointments_app.clinic_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic text NOT NULL,

    -- Mesmas métricas da admin dashboard
    total_doctors integer DEFAULT 0,                    -- Total de Médicos
    avg_occupation_percentage numeric(5,2),             -- Ocupação Média (hoje)
    total_reschedules_30d integer DEFAULT 0,            -- Reagendamentos (30d)
    monthly_occupation_percentage numeric(5,2),         -- Ocupação Mensal

    -- Dados adicionais para cálculos
    total_slots integer DEFAULT 0,
    total_occupied_slots integer DEFAULT 0,
    monthly_total_slots integer DEFAULT 0,
    monthly_occupied_slots integer DEFAULT 0,
    days_counted integer DEFAULT 0,                     -- Dias úteis contados no mês

    computed_at timestamp NOT NULL DEFAULT now()
);

-- Índice único: uma linha por clínica por dia
CREATE UNIQUE INDEX IF NOT EXISTS clinic_stats_clinic_date_idx
ON appointments_app.clinic_stats (clinic, (computed_at::date));

-- Índice para queries por data
CREATE INDEX IF NOT EXISTS idx_clinic_stats_computed_at
ON appointments_app.clinic_stats (computed_at DESC);

-- Índice para queries por clínica
CREATE INDEX IF NOT EXISTS idx_clinic_stats_clinic
ON appointments_app.clinic_stats (clinic);

-- -----------------------------------------------------------------------------
-- 3. Permissões
-- -----------------------------------------------------------------------------

GRANT ALL ON appointments_app.clinic_stats TO service_role;
GRANT SELECT ON appointments_app.clinic_stats TO authenticated;

-- -----------------------------------------------------------------------------
-- Queries úteis (para referência):
-- -----------------------------------------------------------------------------
--
-- Médicos que trabalham em Lisboa:
-- SELECT * FROM appointments_app.admin_dashboard_stats
-- WHERE 'Lisboa' = ANY(clinics);
--
-- Stats da clínica de Lisboa (mais recente):
-- SELECT * FROM appointments_app.clinic_stats
-- WHERE clinic = 'Lisboa'
-- ORDER BY computed_at DESC
-- LIMIT 1;
--
-- Top 10 melhores médicos:
-- SELECT * FROM appointments_app.admin_dashboard_stats
-- ORDER BY occupation_percentage DESC
-- LIMIT 10;
--
-- Top 10 piores médicos:
-- SELECT * FROM appointments_app.admin_dashboard_stats
-- ORDER BY occupation_percentage ASC
-- LIMIT 10;
--
-- =============================================================================
