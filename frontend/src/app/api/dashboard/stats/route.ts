import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getDoctorSchedule, getHumanResource } from '@/lib/glintt-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/stats
 *
 * Fetches dashboard statistics - calculates occupation in real-time from Glintt.
 *
 * Query params:
 * - doctorCode (optional): Filter by specific doctor code
 * - all (optional): If "true", returns stats from pre-computed table (admin only)
 * - clinic (optional): Filter by clinic name (only works with all=true)
 *
 * Returns:
 * - Real-time occupation stats if doctorCode is provided
 * - Pre-computed stats if all=true (admin only, from admin_dashboard_stats table)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const doctorCode = searchParams.get('doctorCode');
    const fetchAll = searchParams.get('all') === 'true';
    const clinicFilter = searchParams.get('clinic');

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

    // Get current user's profile
    const { data: profile } = await serviceClient
      .schema('appointments_app')
      .from('user_profiles')
      .select('role, doctor_code')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const userDoctorCode = profile?.doctor_code;

    // If requesting all stats (admin dashboard overview)
    if (fetchAll && isAdmin) {
      // Return pre-computed stats from admin_dashboard_stats table
      let query = serviceClient
        .schema('appointments_app')
        .from('admin_dashboard_stats')
        .select('*')
        .order('computed_at', { ascending: false });

      // Filter by clinic if specified (clinics is an array, use 'contains')
      if (clinicFilter) {
        query = query.contains('clinics', [clinicFilter]);
      }

      const { data: stats, error } = await query;

      if (error) {
        console.error('[api/dashboard/stats] Query error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch stats' },
          { status: 500 }
        );
      }

      // Deduplicate to get only latest per doctor
      const latestByDoctor = new Map<string, typeof stats[0]>();
      for (const stat of stats || []) {
        if (!latestByDoctor.has(stat.doctor_code)) {
          latestByDoctor.set(stat.doctor_code, stat);
        }
      }

      return NextResponse.json({
        stats: Array.from(latestByDoctor.values()),
        isAdmin,
        filters: { clinic: clinicFilter },
      });
    }

    // Determine which doctor code to query for real-time stats
    let targetDoctorCode: string | null = null;

    if (doctorCode) {
      // Specific doctor requested
      if (!isAdmin && doctorCode !== userDoctorCode) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot view other doctors\' stats' },
          { status: 403 }
        );
      }
      targetDoctorCode = doctorCode;
    } else {
      // No specific doctor - return current user's stats (if they're a doctor)
      if (!userDoctorCode) {
        return NextResponse.json(
          { error: 'No doctor code associated with this user' },
          { status: 400 }
        );
      }
      targetDoctorCode = userDoctorCode;
    }

    // At this point targetDoctorCode is guaranteed to be non-null due to the checks above
    if (!targetDoctorCode) {
      return NextResponse.json({ error: 'No doctor code specified' }, { status: 400 });
    }

    // Calculate occupation in REAL-TIME from Glintt
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`[api/dashboard/stats] Fetching real-time stats for doctor ${targetDoctorCode} on ${today}`);

    // Get doctor name from Glintt
    const doctorInfo = await getHumanResource(targetDoctorCode);
    const doctorName = doctorInfo?.HumanResourceName || null;

    // Fetch today's schedule
    const { slots } = await getDoctorSchedule(targetDoctorCode, today, today);

    // Calculate occupation stats
    const totalSlots = slots.length;
    const occupiedSlots = slots.filter(s => s.isOccupied).length;
    const occupationPercentage = totalSlots > 0 
      ? (occupiedSlots / totalSlots) * 100 
      : 0;

    // Get reschedules count from database (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: rescheduleCount } = await serviceClient
      .schema('appointments_app')
      .from('reschedules')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_code', targetDoctorCode)
      .gte('new_datetime', thirtyDaysAgo.toISOString());

    const stats = {
      id: `realtime-${targetDoctorCode}`,
      doctor_code: targetDoctorCode,
      doctor_name: doctorName,
      occupation_percentage: Math.round(occupationPercentage * 100) / 100,
      total_slots: totalSlots,
      occupied_slots: occupiedSlots,
      total_reschedules_30d: rescheduleCount || 0,
      computed_at: new Date().toISOString(),
    };

    console.log(`[api/dashboard/stats] Real-time stats for ${targetDoctorCode}:`, stats);

    return NextResponse.json({
      stats,
      isAdmin,
    });
  } catch (error) {
    console.error('[api/dashboard/stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
