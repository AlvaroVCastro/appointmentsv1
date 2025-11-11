import { NextRequest, NextResponse } from 'next/server';
import { getFutureAppointments } from '@/lib/glintt-api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const serviceCode = searchParams.get('serviceCode');
    const doctorCode = searchParams.get('doctorCode');

    if (!startDate || !endDate || !serviceCode || !doctorCode) {
      return NextResponse.json(
        {
          error:
            'Missing required parameters: startDate, endDate, serviceCode, doctorCode',
        },
        { status: 400 }
      );
    }

    const appointments = await getFutureAppointments(
      startDate,
      endDate,
      serviceCode,
      doctorCode
    );
    return NextResponse.json({ appointments });
  } catch (error: unknown) {
    console.error('Error fetching appointments:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch appointments';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

