import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/stats
 * 
 * Fetches dashboard statistics from admin_dashboard_stats table.
 * 
 * Query params:
 * - doctorCode (optional): Filter by specific doctor code
 * - all (optional): If "true", returns all doctors' stats (admin only)
 * 
 * Returns:
 * - Single doctor stats if doctorCode is provided
 * - All doctors' stats if all=true (admin only)
 * - Current user's stats if user is a doctor
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const doctorCode = searchParams.get('doctorCode');
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

    // Determine which doctor code to query
    let targetDoctorCode: string | null = null;

    if (fetchAll && isAdmin) {
      // Admin requesting all stats - don't filter by doctor
      targetDoctorCode = null;
    } else if (doctorCode) {
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

    // Build query - get latest stats (most recent computed_at)
    let query = serviceClient
      .schema('appointments_app')
      .from('admin_dashboard_stats')
      .select('*')
      .order('computed_at', { ascending: false });

    if (targetDoctorCode) {
      query = query.eq('doctor_code', targetDoctorCode);
    }

    // For individual doctor, get just the latest; for all, get latest for each doctor
    if (targetDoctorCode) {
      query = query.limit(1);
    }

    const { data: stats, error } = await query;

    if (error) {
      console.error('[api/dashboard/stats] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: 500 }
      );
    }

    // If fetching all, deduplicate to get only latest per doctor
    let result = stats || [];
    if (!targetDoctorCode && stats && stats.length > 0) {
      const latestByDoctor = new Map<string, typeof stats[0]>();
      for (const stat of stats) {
        if (!latestByDoctor.has(stat.doctor_code)) {
          latestByDoctor.set(stat.doctor_code, stat);
        }
      }
      result = Array.from(latestByDoctor.values());
    }

    return NextResponse.json({
      stats: targetDoctorCode ? (result[0] || null) : result,
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

/**
 * POST /api/dashboard/stats/refresh
 * 
 * Manually triggers stats computation for a specific doctor or all doctors.
 * Admin only.
 */
export async function POST(request: NextRequest) {
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

    // Use service client
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Check if user is admin
    const { data: profile } = await serviceClient
      .schema('appointments_app')
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Call the Edge Function to refresh stats
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/compute-dashboard-stats`;
    const edgeFunctionApiKey = process.env.EDGE_FUNCTION_APPOINTMENTS_KEY;

    if (!edgeFunctionApiKey) {
      return NextResponse.json(
        { error: 'Edge function API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': edgeFunctionApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[api/dashboard/stats/refresh] Edge function error:', errorText);
      return NextResponse.json(
        { error: 'Failed to refresh stats' },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/dashboard/stats/refresh] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
