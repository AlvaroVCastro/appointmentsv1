import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/clinic-stats
 *
 * Returns aggregated stats per clinic from the clinic_stats table.
 *
 * Query params:
 * - clinic (optional): Filter by specific clinic name
 *
 * Returns:
 * - stats: Array of clinic stats (or single clinic if filtered)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clinic = searchParams.get('clinic');

    // Create Supabase client for auth
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Not needed for this request
          },
        },
      }
    );

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service client for queries (bypasses RLS)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Get current user's profile to check if admin
    const { data: profile } = await serviceClient
      .schema('appointments_app')
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build query for clinic stats
    let query = serviceClient
      .schema('appointments_app')
      .from('clinic_stats')
      .select('*')
      .order('computed_at', { ascending: false });

    // Filter by clinic if specified
    if (clinic) {
      query = query.eq('clinic', clinic);
    }

    const { data: stats, error } = await query;

    if (error) {
      console.error('[api/dashboard/clinic-stats] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch clinic stats' },
        { status: 500 }
      );
    }

    // Deduplicate to get only latest per clinic
    const latestByClinic = new Map<string, (typeof stats)[0]>();
    for (const stat of stats || []) {
      if (!latestByClinic.has(stat.clinic)) {
        latestByClinic.set(stat.clinic, stat);
      }
    }

    return NextResponse.json({
      stats: Array.from(latestByClinic.values()),
    });
  } catch (error) {
    console.error('[api/dashboard/clinic-stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
