import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

/**
 * PATCH /api/users/role
 * 
 * Updates a user's role, doctor_code, or manages additional doctor codes. Admin only.
 * 
 * Body:
 * - userId: string (required)
 * - newRole?: 'admin' | 'user' (optional)
 * - doctorCode?: string | null (optional) - Primary doctor code in user_profiles
 * - addDoctorCode?: string (optional) - Add an additional doctor code
 * - removeDoctorCode?: string (optional) - Remove an additional doctor code
 */
export async function PATCH(request: NextRequest) {
  try {
    // Get the current user's session to verify they're an admin
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

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if current user is admin using service client
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: currentProfile } = await serviceClient
      .schema('appointments_app')
      .from('user_profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (currentProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { userId, newRole, doctorCode, addDoctorCode, removeDoctorCode } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Handle adding additional doctor code
    if (addDoctorCode) {
      const { error: insertError } = await serviceClient
        .schema('appointments_app')
        .from('user_doctor_codes')
        .insert({ user_id: userId, doctor_code: addDoctorCode });

      if (insertError) {
        console.error('[api/users/role] Insert doctor code error:', insertError);
        if (insertError.code === '23505') {
          return NextResponse.json(
            { error: 'Este código já está associado a este utilizador' },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: 'Failed to add doctor code' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        userId, 
        addedDoctorCode: addDoctorCode,
      });
    }

    // Handle removing additional doctor code
    if (removeDoctorCode) {
      const { error: deleteError } = await serviceClient
        .schema('appointments_app')
        .from('user_doctor_codes')
        .delete()
        .eq('user_id', userId)
        .eq('doctor_code', removeDoctorCode);

      if (deleteError) {
        console.error('[api/users/role] Delete doctor code error:', deleteError);
        return NextResponse.json({ error: 'Failed to remove doctor code' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        userId, 
        removedDoctorCode: removeDoctorCode,
      });
    }

    // Build update object for user_profiles
    const updateData: { role?: string; doctor_code?: string | null } = {};

    // Handle role update
    if (newRole !== undefined) {
      if (!['admin', 'user'].includes(newRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      // Prevent admin from removing their own admin role
      if (userId === currentUser.id && newRole !== 'admin') {
        return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 });
      }

      updateData.role = newRole;
    }

    // Handle doctor_code update (primary code in user_profiles)
    if (doctorCode !== undefined) {
      // doctorCode can be a string or null (to remove)
      updateData.doctor_code = doctorCode || null;
    }

    // Ensure there's something to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Update the user's profile using service client (bypasses RLS)
    const { error: updateError } = await serviceClient
      .schema('appointments_app')
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error('[api/users/role] Update error:', updateError);
      
      // Check for unique constraint violation on doctor_code
      if (updateError.code === '23505' && updateError.message?.includes('doctor_code')) {
        return NextResponse.json(
          { error: 'Este código de médico já está associado a outro utilizador' },
          { status: 400 }
        );
      }
      
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      userId, 
      ...(newRole !== undefined && { newRole }),
      ...(doctorCode !== undefined && { doctorCode }),
    });
  } catch (error) {
    console.error('[api/users/role] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
