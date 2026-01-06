# Database SQL Scripts

This folder contains versioned SQL scripts that define the database schema for the Malo Clinic appointments application.

## Purpose

These SQL files serve as the **source of truth** for the database structure. They document and track the Supabase database schema in version control, ensuring:

- Database changes are reviewed and tracked in git
- New environments can be set up consistently
- The schema is documented alongside the application code

## Current Setup

- **Database**: Supabase (PostgreSQL)
- **Schema**: `appointments_app`
- **RLS**: Row Level Security is enabled on all tables

## Files

| File | Description |
|------|-------------|
| `001_schema_and_table_suggestions.sql` | Creates the schema, `suggestions` table, indexes, and triggers |
| `002_rls_policies_suggestions.sql` | Configures Row Level Security policies for authenticated users |

## How to Apply

These scripts are designed to be run manually via the Supabase SQL Editor:

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each SQL file
4. Run them in numerical order (001, 002, ...)

### Notes

- All scripts are **idempotent** — safe to run multiple times without causing errors
- Scripts use `IF NOT EXISTS`, `CREATE OR REPLACE`, and `DROP ... IF EXISTS` patterns
- Always run scripts in order when setting up a new environment

## Adding New Migrations

When adding new database changes:

1. Create a new file with the next number prefix (e.g., `003_add_new_column.sql`)
2. Use idempotent patterns (IF NOT EXISTS, etc.)
3. Document the change in this README
4. Test in a development environment before applying to production

