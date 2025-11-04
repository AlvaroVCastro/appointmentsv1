import { NextRequest, NextResponse } from 'next/server';
import { getFutureAppointments } from '@/lib/glintt-api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const medicalActCode = searchParams.get('medicalActCode');
    const serviceCode = searchParams.get('serviceCode');

    if (!startDate || !endDate || !medicalActCode || !serviceCode) {
      return NextResponse.json(
        {
          error:
            'Missing required parameters: startDate, endDate, medicalActCode, serviceCode',
        },
        { status: 400 }
      );
    }

    const appointments = await getFutureAppointments(
      startDate,
      endDate,
      medicalActCode,
      serviceCode
    );
    return NextResponse.json({ appointments });
  } catch (error: any) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

