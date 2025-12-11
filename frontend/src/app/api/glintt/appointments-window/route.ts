import { NextRequest, NextResponse } from 'next/server';
import { getDoctorAppointmentsForWindow } from '@/lib/glintt-api';

/**
 * API route for fetching appointments within a time window (for recommendation engine).
 * Used to find replacement candidates for empty slots.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const doctorCode = searchParams.get('doctorCode');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (!doctorCode || !fromDate || !toDate) {
      return NextResponse.json(
        {
          error: 'Missing required parameters: doctorCode, fromDate, toDate',
        },
        { status: 400 }
      );
    }

    const appointments = await getDoctorAppointmentsForWindow(
      doctorCode,
      fromDate,
      toDate
    );

    return NextResponse.json({ appointments });
  } catch (error: unknown) {
    console.error('[appointments-window] Error fetching appointments:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch appointments';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

