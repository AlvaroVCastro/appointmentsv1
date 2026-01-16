import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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
    const { userId, newRole } = body;

    if (!userId || !newRole) {
      return NextResponse.json({ error: 'Missing userId or newRole' }, { status: 400 });
    }

    if (!['admin', 'user'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Prevent admin from removing their own admin role
    if (userId === currentUser.id && newRole !== 'admin') {
      return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 });
    }

    // Update the user's role using service client (bypasses RLS)
    const { error: updateError } = await serviceClient
      .schema('appointments_app')
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (updateError) {
      console.error('[api/users/role] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId, newRole });
  } catch (error) {
    console.error('[api/users/role] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
