// Server-only Supabase client. Do not import this file in client components.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase client for use in API routes and server components.
 * 
 * Uses the 'appointments_app' schema for the suggestions table.
 * 
 * Currently uses NEXT_PUBLIC_SUPABASE_ANON_KEY because RLS is disabled in the test project.
 * TODO: Switch to SUPABASE_SERVICE_ROLE_KEY for production with RLS enabled.
 */
export function getSupabaseServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Debug: Log env var status (not the values for security)
  console.log('[getSupabaseServerClient] env check:', {
    hasUrl: !!supabaseUrl,
    urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
    hasKey: !!supabaseKey,
    keyPrefix: supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'MISSING',
  });

  if (!supabaseUrl) {
    console.error('[getSupabaseServerClient] NEXT_PUBLIC_SUPABASE_URL is not set!');
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseKey) {
    console.error('[getSupabaseServerClient] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set!');
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    db: { schema: 'appointments_app' }, // Use appointments_app schema for suggestions table
  });
}


