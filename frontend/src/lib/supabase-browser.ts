import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a browser-side Supabase client for use in client components.
 * 
 * Uses the ANON key which is safe for browser exposure.
 * This client is used for authentication flows (signIn, signOut, etc.)
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
