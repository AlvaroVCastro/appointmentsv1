// Server-only Supabase client. Do not import this file in client components.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase client for use in API routes and server components.
 * 
 * Uses the 'appointments_app' schema for the reschedules table.
 * 
 * Uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS for trusted server-side operations.
 * IMPORTANT: Never expose this key to the client.
 */
export function getSupabaseServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('[getSupabaseServerClient] NEXT_PUBLIC_SUPABASE_URL is not set!');
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseKey) {
    console.error('[getSupabaseServerClient] SUPABASE_SERVICE_ROLE_KEY is not set!');
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    db: { schema: 'appointments_app' }, // Use appointments_app schema for reschedules table
  }) as unknown as SupabaseClient;
}


