import { createSuggestion, type CreateSuggestionInput } from '@/lib/suggestions-repository';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Debug: Log received body (sanitized)
    console.log('[POST /api/suggestions] received body', {
      doctorCode: body.doctorCode,
      patientId: body.patientId,
      patientName: body.patientName,
      originalDatetime: body.originalDatetime,
      originalDurationMin: body.originalDurationMin,
      suggestedDatetime: body.suggestedDatetime,
      suggestedDurationMin: body.suggestedDurationMin,
      anticipationDays: body.anticipationDays,
      impact: body.impact,
    });

    // Validate required fields
    const requiredFields = [
      'doctorCode',
      'patientId',
      'originalDatetime',
      'originalDurationMin',
      'suggestedDatetime',
      'suggestedDurationMin',
      'anticipationDays',
    ] as const;

    const missingFields: string[] = [];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      console.error('[POST /api/suggestions] missing fields:', missingFields);
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missingFields.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate types for numeric fields
    if (typeof body.originalDurationMin !== 'number') {
      console.error('[POST /api/suggestions] originalDurationMin is not a number:', typeof body.originalDurationMin);
      return new Response(
        JSON.stringify({ error: 'originalDurationMin must be a number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof body.suggestedDurationMin !== 'number') {
      console.error('[POST /api/suggestions] suggestedDurationMin is not a number:', typeof body.suggestedDurationMin);
      return new Response(
        JSON.stringify({ error: 'suggestedDurationMin must be a number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof body.anticipationDays !== 'number') {
      console.error('[POST /api/suggestions] anticipationDays is not a number:', typeof body.anticipationDays);
      return new Response(
        JSON.stringify({ error: 'anticipationDays must be a number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build input object
    const input: CreateSuggestionInput = {
      doctorCode: body.doctorCode,
      patientId: body.patientId,
      patientName: body.patientName,
      originalDatetime: body.originalDatetime,
      originalDurationMin: body.originalDurationMin,
      originalServiceCode: body.originalServiceCode,
      originalMedicalActCode: body.originalMedicalActCode,
      suggestedDatetime: body.suggestedDatetime,
      suggestedDurationMin: body.suggestedDurationMin,
      anticipationDays: body.anticipationDays,
      impact: body.impact,
      notes: body.notes,
    };

    console.log('[POST /api/suggestions] calling createSuggestion...');
    const suggestion = await createSuggestion(input);
    console.log('[POST /api/suggestions] suggestion created successfully, id:', suggestion.id);

    return new Response(
      JSON.stringify({ suggestion }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[POST /api/suggestions] failed to create suggestion:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Failed to create suggestion: ${errorMessage}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}


