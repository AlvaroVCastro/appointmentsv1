import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  // Debug: Verify env vars are loaded (remove after confirming)
  console.log('[auth/callback] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');

  if (!code) {
    console.error('[auth/callback] No code in URL');
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  // Create response to set cookies on
  const response = NextResponse.redirect(`${origin}/dashboard`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  
  if (error || !data.user) {
    console.error('[auth/callback] Exchange error:', error);
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Upsert user profile in appointments_app schema (server-side with service role)
  await ensureAppointmentsProfile(data.user);

  return response;
}

async function ensureAppointmentsProfile(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // CRITICAL: Use .schema('appointments_app') to target our schema
  const { error } = await serviceClient
    .schema('appointments_app')
    .from('user_profiles')
    .upsert(
      {
        id: user.id,
        email: user.email || null,
        full_name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email || 'Unknown',
        avatar_url: (user.user_metadata?.avatar_url as string) || null,
        // role defaults to 'user' via table default
      },
      { onConflict: 'id' }
    );

  if (error) {
    console.error('[auth/callback] Profile upsert error:', error);
    // Non-fatal: user can still proceed, profile may need manual intervention
  } else {
    console.log('[auth/callback] Profile upserted for user:', user.id);
  }
}
