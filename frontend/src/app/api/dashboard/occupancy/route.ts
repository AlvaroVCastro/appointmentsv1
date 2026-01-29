import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getDoctorSchedule, getHumanResource } from '@/lib/glintt-api';

export const dynamic = 'force-dynamic';

/**
 * Helper function to get the Monday of the current week
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // If Sunday (0), go back 6 days; otherwise go back (day - 1) days
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Helper function to get the Friday of the current week
 */
function getWeekEnd(date: Date): Date {
  const monday = getWeekStart(date);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4); // Monday + 4 = Friday
  friday.setHours(23, 59, 59, 999);
  return friday;
}

/**
 * Helper function to check if a date is a weekend (Saturday or Sunday)
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Helper function to format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper function to get business days between two dates (excluding weekends)
 * Also excludes today if excludeToday is true
 */
function getBusinessDays(startDate: Date, endDate: Date, excludeToday: boolean = true): string[] {
  const dates: string[] = [];
  const today = formatDate(new Date());
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = formatDate(current);
    const isWeekendDay = isWeekend(current);
    const isToday = dateStr === today;

    if (!isWeekendDay && (!excludeToday || !isToday)) {
      dates.push(dateStr);
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * GET /api/dashboard/occupancy
 *
 * Calculates occupancy percentage for different time periods.
 *
 * Query params:
 * - doctorCode (required for user dashboard, optional for admin)
 * - period: "weekly" | "monthly"
 *   - weekly: Current week (Mon-Fri), excluding today
 *   - monthly: Last month (same day last month to yesterday), excluding weekends
 * - all (optional): If "true", returns aggregated stats for all doctors (admin only)
 *
 * Returns:
 * - occupancy_percentage: Ratio of occupied slots / (occupied + empty), ignoring blocked
 * - period_start: Start date of the period
 * - period_end: End date of the period
 * - total_slots: Total non-blocked slots in the period
 * - occupied_slots: Total occupied slots in the period
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const doctorCode = searchParams.get('doctorCode');
    const period = searchParams.get('period') || 'weekly';
    const fetchAll = searchParams.get('all') === 'true';

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

    // Calculate date range based on period
    const today = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (period === 'monthly') {
      // Monthly: from same day last month to yesterday
      periodEnd = new Date(today);
      periodEnd.setDate(periodEnd.getDate() - 1); // Yesterday

      periodStart = new Date(today);
      periodStart.setMonth(periodStart.getMonth() - 1); // Same day last month
    } else {
      // Weekly: current week Monday to Friday (full week, including today and future days)
      periodStart = getWeekStart(today);
      periodEnd = getWeekEnd(today);
    }

    // Get business days (excluding weekends only, include today and future days)
    const businessDays = getBusinessDays(periodStart, periodEnd, false);

    console.log(`[api/dashboard/occupancy] Period: ${period}, Days: ${businessDays.length}, Range: ${formatDate(periodStart)} to ${formatDate(periodEnd)}`);

    // If requesting all stats (admin dashboard)
    if (fetchAll && isAdmin) {
      // For admin monthly stats, we need to aggregate across all doctors
      // Get list of all doctor codes from the admin_dashboard_stats table
      const { data: allStats } = await serviceClient
        .schema('appointments_app')
        .from('admin_dashboard_stats')
        .select('doctor_code')
        .order('computed_at', { ascending: false });

      if (!allStats || allStats.length === 0) {
        return NextResponse.json({
          occupancy: {
            occupancy_percentage: 0,
            period_start: formatDate(periodStart),
            period_end: formatDate(periodEnd),
            total_slots: 0,
            occupied_slots: 0,
            days_counted: 0,
          },
          isAdmin,
        });
      }

      // Get unique doctor codes
      const uniqueDoctorCodes = [...new Set(allStats.map(s => s.doctor_code))];

      console.log(`[api/dashboard/occupancy] Calculating ${period} occupancy for ${uniqueDoctorCodes.length} doctors`);

      // Calculate aggregate occupancy across all doctors and all business days
      let totalOccupied = 0;
      let totalSlots = 0;

      // Process each day
      for (const day of businessDays) {
        // Process each doctor (in parallel batches to avoid overwhelming the API)
        const batchSize = 5;
        for (let i = 0; i < uniqueDoctorCodes.length; i += batchSize) {
          const batch = uniqueDoctorCodes.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (code) => {
              try {
                const { slots } = await getDoctorSchedule(code, day, day);
                // slots already have blocked slots filtered out by getDoctorSchedule
                const occupied = slots.filter(s => s.isOccupied).length;
                return { total: slots.length, occupied };
              } catch (err) {
                console.warn(`[api/dashboard/occupancy] Error fetching slots for doctor ${code} on ${day}:`, err);
                return { total: 0, occupied: 0 };
              }
            })
          );

          for (const result of results) {
            totalSlots += result.total;
            totalOccupied += result.occupied;
          }
        }
      }

      const occupancyPercentage = totalSlots > 0
        ? (totalOccupied / totalSlots) * 100
        : 0;

      return NextResponse.json({
        occupancy: {
          occupancy_percentage: Math.round(occupancyPercentage * 100) / 100,
          period_start: formatDate(periodStart),
          period_end: formatDate(periodEnd),
          total_slots: totalSlots,
          occupied_slots: totalOccupied,
          days_counted: businessDays.length,
        },
        isAdmin,
      });
    }

    // Individual doctor occupancy calculation
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

    if (!targetDoctorCode) {
      return NextResponse.json({ error: 'No doctor code specified' }, { status: 400 });
    }

    console.log(`[api/dashboard/occupancy] Calculating ${period} occupancy for doctor ${targetDoctorCode}`);

    // Get doctor name from Glintt
    const doctorInfo = await getHumanResource(targetDoctorCode);
    const doctorName = doctorInfo?.HumanResourceName || null;

    // Calculate occupancy across all business days in the period
    let totalOccupied = 0;
    let totalSlots = 0;

    for (const day of businessDays) {
      try {
        const { slots } = await getDoctorSchedule(targetDoctorCode, day, day);
        // slots already have blocked slots filtered out by getDoctorSchedule
        totalSlots += slots.length;
        totalOccupied += slots.filter(s => s.isOccupied).length;
      } catch (err) {
        console.warn(`[api/dashboard/occupancy] Error fetching slots for ${day}:`, err);
      }
    }

    const occupancyPercentage = totalSlots > 0
      ? (totalOccupied / totalSlots) * 100
      : 0;

    return NextResponse.json({
      occupancy: {
        doctor_code: targetDoctorCode,
        doctor_name: doctorName,
        occupancy_percentage: Math.round(occupancyPercentage * 100) / 100,
        period_start: formatDate(periodStart),
        period_end: formatDate(periodEnd),
        total_slots: totalSlots,
        occupied_slots: totalOccupied,
        days_counted: businessDays.length,
      },
      isAdmin,
    });
  } catch (error) {
    console.error('[api/dashboard/occupancy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
