# GitHub Actions Setup

## Required GitHub Secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

### Required Secrets:

| Secret | Description |
|--------|-------------|
| `SUPABASE_ACCESS_TOKEN` | Your Supabase personal access token |
| `SUPABASE_PROJECT_REF` | Your Supabase project reference ID |
| `SUPABASE_DB_PASSWORD` | Your Supabase database password |

## How to Get These Values

### 1. Supabase Access Token

```bash
# Login to Supabase CLI
supabase login

# Copy the token from the output
```

Or generate from: https://supabase.com/dashboard/account/tokens

### 2. Project Reference

```bash
# List your projects
supabase projects list

# Copy the project ref ID
```

Or find it in your Supabase Dashboard URL: `https://supabase.com/dashboard/project/[PROJECT_REF]`

### 3. Database Password

Get from: Supabase Dashboard → Project Settings → Database → Connection string

## Workflow Behavior

### Automatic Deployment:
- `master` or `main` branch → Auto-deploys to Production

### Manual Deployment:
1. Go to GitHub Actions tab
2. Select "Deploy to Supabase" workflow
3. Click "Run workflow"
4. Choose environment
5. Click "Run workflow"

## What Gets Deployed

- ✅ Edge Functions - All functions in `supabase/functions/`
- ✅ Database Migrations - All pending migrations
- ✅ Schema Reference - Updates `current_full_schema.sql`

## Adding New Functions

1. Create a new folder in `supabase/functions/[function-name]/`
2. Add your `index.ts` file
3. Add the deploy command to `.github/workflows/deploy.yml`:

```yaml
supabase functions deploy [function-name] --no-verify-jwt
```

4. Push to master → Automatic deployment
