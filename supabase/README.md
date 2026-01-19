# Supabase Edge Functions

This directory contains all Supabase Edge Functions for the Malo Clinic Admin Dashboard.

## Function Structure

```
supabase/
├── current_schema/
│   └── current_full_schema.sql      # Schema reference (auto-generated)
├── functions/
│   └── compute-dashboard-stats/     # Daily stats computation
│       └── index.ts
└── README.md
```

## Functions

### `compute-dashboard-stats`

Computes daily occupation percentages and reschedule counts for all doctors.

**Purpose:**
- Fetches all doctors from `user_profiles` (where `doctor_code` is not null)
- For each doctor, calls Glintt API to get today's schedule
- Calculates occupation percentage (occupied slots / total slots)
- Counts reschedules from the last 30 days
- Stores results in `admin_dashboard_stats` table

**Scheduled:** Daily at 7:00 AM via pg_cron

**Endpoint:**
```
https://your-project.supabase.co/functions/v1/compute-dashboard-stats
```

**Authentication:** Requires `EDGE_FUNCTIONS_API_KEY` header

## Environment Variables

Configure these secrets in Supabase:

```bash
# Supabase (auto-configured)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# Glintt API (already configured by lead)
GLINTT_BASE_URL
GLINTT_CLIENT_ID
GLINTT_CLIENT_SECRET

# Security (you need to add this one)
EDGE_FUNCTION_APPOINTMENTS_KEY
```

### Setting Secrets

```bash
# Only need to add this one (Glintt secrets already exist)
supabase secrets set EDGE_FUNCTION_APPOINTMENTS_KEY="your_api_key"
```

## Deployment

### Automatic (via GitHub Actions)

Push to `master` branch → Auto-deploys to Production

### Manual

```bash
# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy function
supabase functions deploy compute-dashboard-stats --no-verify-jwt
```

## pg_cron Setup

Run this SQL in Supabase Dashboard to schedule the function:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily at 7:00 AM (Portugal time = UTC+0/+1)
SELECT cron.schedule(
    'compute-dashboard-stats-daily',
    '0 7 * * *',
    $$
    SELECT net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/compute-dashboard-stats',
        headers := '{"api-key": "YOUR_EDGE_FUNCTIONS_API_KEY"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);

-- To view scheduled jobs:
SELECT * FROM cron.job;

-- To unschedule:
SELECT cron.unschedule('compute-dashboard-stats-daily');
```

## Local Development

```bash
# Serve function locally
supabase functions serve

# Test locally
curl -X POST http://localhost:54321/functions/v1/compute-dashboard-stats \
  -H "api-key: your_edge_functions_api_key" \
  -H "Content-Type: application/json"
```

## Monitoring

```bash
# View logs
supabase functions logs compute-dashboard-stats

# Follow logs in real-time
supabase functions logs compute-dashboard-stats --follow
```
