import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/profile
 * 
 * Fetches the current user's profile including role and doctor_code.
 * Used by frontend components to determine what to show.
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

    // Use service client for queries
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Get current user's profile
    const { data: profile, error } = await serviceClient
      .schema('appointments_app')
      .from('user_profiles')
      .select('id, full_name, email, role, doctor_code, avatar_url')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[api/dashboard/profile] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    // Get additional doctor codes from user_doctor_codes table
    const { data: additionalCodes } = await serviceClient
      .schema('appointments_app')
      .from('user_doctor_codes')
      .select('doctor_code')
      .eq('user_id', user.id);

    // Combine primary doctor code with additional codes
    const allDoctorCodes: string[] = [];
    if (profile.doctor_code) {
      allDoctorCodes.push(profile.doctor_code);
    }
    if (additionalCodes && additionalCodes.length > 0) {
      for (const row of additionalCodes) {
        if (row.doctor_code && !allDoctorCodes.includes(row.doctor_code)) {
          allDoctorCodes.push(row.doctor_code);
        }
      }
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
        doctorCode: profile.doctor_code, // Primary code (backwards compat)
        doctorCodes: allDoctorCodes,     // All codes (primary + additional)
        avatarUrl: profile.avatar_url,
        isAdmin: profile.role === 'admin',
        isDoctor: allDoctorCodes.length > 0,
        hasMultipleDoctorCodes: allDoctorCodes.length > 1,
      },
    });
  } catch (error) {
    console.error('[api/dashboard/profile] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
