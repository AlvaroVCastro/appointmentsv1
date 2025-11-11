import { NextRequest, NextResponse } from 'next/server';
import { getPatient } from '@/lib/glintt-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await params;
    const patient = await getPatient(patientId);
    
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ patient });
  } catch (error: unknown) {
    console.error('Error fetching patient:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch patient';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

