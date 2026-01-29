import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/filters
 *
 * Returns available filter options for the admin dashboard.
 *
 * Returns:
 * - clinics: List of unique clinics from admin_dashboard_stats
 * - doctors: List of unique doctors with code and name
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get all stats to extract unique clinics and doctors
    const { data: stats, error } = await serviceClient
      .schema('appointments_app')
      .from('admin_dashboard_stats')
      .select('doctor_code, doctor_name, clinics')
      .order('doctor_name', { ascending: true });

    if (error) {
      console.error('[api/dashboard/filters] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch filters' },
        { status: 500 }
      );
    }

    // Extract unique clinics from the clinics arrays
    const clinicsSet = new Set<string>();
    for (const stat of stats || []) {
      if (stat.clinics && Array.isArray(stat.clinics)) {
        for (const clinic of stat.clinics) {
          if (clinic) {
            clinicsSet.add(clinic);
          }
        }
      }
    }

    // Sort clinics alphabetically
    const clinics = Array.from(clinicsSet).sort((a, b) => a.localeCompare(b));

    // Extract unique doctors (deduplicate by doctor_code)
    const doctorsMap = new Map<string, { code: string; name: string }>();
    for (const stat of stats || []) {
      if (stat.doctor_code && !doctorsMap.has(stat.doctor_code)) {
        doctorsMap.set(stat.doctor_code, {
          code: stat.doctor_code,
          name: stat.doctor_name || `Dr. ${stat.doctor_code}`,
        });
      }
    }

    // Sort doctors by name
    const doctors = Array.from(doctorsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      clinics,
      doctors,
    });
  } catch (error) {
    console.error('[api/dashboard/filters] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
