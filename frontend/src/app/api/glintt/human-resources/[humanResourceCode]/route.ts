import { NextRequest, NextResponse } from 'next/server';
import { getHumanResource } from '@/lib/glintt-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ humanResourceCode: string }> }
) {
  try {
    const { humanResourceCode } = await params;
    const humanResource = await getHumanResource(humanResourceCode);
    
    if (!humanResource) {
      return NextResponse.json(
        { error: 'Human resource not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ humanResource });
  } catch (error: unknown) {
    console.error('Error fetching human resource:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch human resource';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

