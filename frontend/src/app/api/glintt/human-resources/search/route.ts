import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/glintt-api';

const GLINTT_URL = process.env.GLINTT_URL || '';

export interface HumanResourceSearchResponse {
  HumanResourceCode?: string;
  ID?: string;
  HumanResourceName?: string;
  Name?: string;
  ServiceCode?: string;
  ServiceDescription?: string;
  Type?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchString = '' } = body;

    if (!searchString || searchString.trim().length < 3) {
      return NextResponse.json(
        { error: 'Search string must be at least 3 characters' },
        { status: 400 }
      );
    }

    const token = await getAuthToken();
    
    const hrUrl = `${GLINTT_URL}/Glintt.HMS.CoreWebAPI/api/hms/humanresources/search`;
    const params = new URLSearchParams({
      skip: '0',
      take: '50', // Limit results for search
    });

    const requestBody = {
      SearchString: searchString.trim(),
      HumanResourceIDs: [], // Empty array to search all
      Types: ['MED'], // Filter by doctor type only
    };

    const response = await fetch(`${hrUrl}?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to search human resources: ${response.statusText}`);
    }

    const data: HumanResourceSearchResponse[] = await response.json();
    
    // Transform to DoctorSearchResult format
    const doctors = (data || []).map((hr) => ({
      id: hr.HumanResourceCode || hr.ID || '',
      code: hr.HumanResourceCode || hr.ID,
      name: hr.HumanResourceName || hr.Name || '',
    }));

    return NextResponse.json({ doctors });
  } catch (error: unknown) {
    console.error('Error searching human resources:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search human resources';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

