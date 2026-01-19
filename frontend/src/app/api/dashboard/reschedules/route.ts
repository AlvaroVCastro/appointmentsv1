import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/reschedules
 * 
 * Fetches reschedule history from reschedules table.
 * 
 * Query params:
 * - doctorCode (optional): Filter by specific doctor code
 * - limit (optional): Number of records to return (default: 10)
 * - top (optional): If "true", returns TOP doctors by reschedule count (admin only)
 * - days (optional): Number of days to look back (default: 30)
 * 
 * Returns:
 * - Recent reschedules for a specific doctor
 * - OR top doctors by reschedule count
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const doctorCode = searchParams.get('doctorCode');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const fetchTop = searchParams.get('top') === 'true';
    const days = parseInt(searchParams.get('days') || '30', 10);

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

    // Use service client for queries
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Get current user's profile
    const { data: profile } = await serviceClient
      .schema('appointments_app')
      .from('user_profiles')
      .select('role, doctor_code')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const userDoctorCode = profile?.doctor_code;

    // Calculate date range
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Handle TOP request (admin only)
    if (fetchTop) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Admin access required for top doctors' },
          { status: 403 }
        );
      }

      // Get reschedules grouped by doctor, count them, and return top N
      const { data: reschedules, error } = await serviceClient
        .schema('appointments_app')
        .from('reschedules')
        .select('doctor_code')
        .gte('new_datetime', fromDate.toISOString())
        .eq('status', 'completed');

      if (error) {
        console.error('[api/dashboard/reschedules] Query error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch reschedules' },
          { status: 500 }
        );
      }

      // Count by doctor
      const countByDoctor = new Map<string, number>();
      for (const r of reschedules || []) {
        const count = countByDoctor.get(r.doctor_code) || 0;
        countByDoctor.set(r.doctor_code, count + 1);
      }

      // Sort by count and take top N
      const sorted = Array.from(countByDoctor.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      // Get doctor names from user_profiles
      const doctorCodes = sorted.map(([code]) => code);
      const { data: doctors } = await serviceClient
        .schema('appointments_app')
        .from('user_profiles')
        .select('doctor_code, full_name')
        .in('doctor_code', doctorCodes);

      const doctorNames = new Map<string, string>();
      for (const d of doctors || []) {
        if (d.doctor_code) {
          doctorNames.set(d.doctor_code, d.full_name || 'Unknown');
        }
      }

      const topDoctors = sorted.map(([code, count]) => ({
        doctor_code: code,
        doctor_name: doctorNames.get(code) || 'Unknown',
        reschedule_count: count,
      }));

      return NextResponse.json({
        topDoctors,
        days,
        isAdmin,
      });
    }

    // Handle specific doctor request
    let targetDoctorCode: string | null = null;

    if (doctorCode) {
      // Specific doctor requested
      if (!isAdmin && doctorCode !== userDoctorCode) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot view other doctors\' reschedules' },
          { status: 403 }
        );
      }
      targetDoctorCode = doctorCode;
    } else {
      // No specific doctor - return current user's reschedules (if they're a doctor)
      if (!userDoctorCode) {
        return NextResponse.json(
          { error: 'No doctor code associated with this user' },
          { status: 400 }
        );
      }
      targetDoctorCode = userDoctorCode;
    }

    // Fetch reschedules for the doctor
    const { data: reschedules, error } = await serviceClient
      .schema('appointments_app')
      .from('reschedules')
      .select('*')
      .eq('doctor_code', targetDoctorCode)
      .eq('status', 'completed')
      .order('new_datetime', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[api/dashboard/reschedules] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reschedules' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reschedules: reschedules || [],
      doctorCode: targetDoctorCode,
      isAdmin,
    });
  } catch (error) {
    console.error('[api/dashboard/reschedules] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
