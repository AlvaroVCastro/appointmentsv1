import { NextRequest, NextResponse } from 'next/server';
import { getDoctorSchedule } from '@/lib/glintt-api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const doctorCode = searchParams.get('doctorCode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!doctorCode || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: doctorCode, startDate, endDate' },
        { status: 400 }
      );
    }

    const schedule = await getDoctorSchedule(doctorCode, startDate, endDate);
    return NextResponse.json(schedule);
  } catch (error: any) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}

