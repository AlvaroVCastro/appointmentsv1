import { createReschedule, type CreateRescheduleInput } from '@/lib/reschedules-repository';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Debug: Log received body (sanitized)
    console.log('[POST /api/reschedules] received body', {
      doctorCode: body.doctorCode,
      patientId: body.patientId,
      patientName: body.patientName,
      originalDatetime: body.originalDatetime,
      originalDurationMin: body.originalDurationMin,
      newDatetime: body.newDatetime,
      newDurationMin: body.newDurationMin,
      anticipationDays: body.anticipationDays,
      impact: body.impact,
      createdBy: body.createdBy,
    });

    // Validate required fields
    const requiredFields = [
      'doctorCode',
      'patientId',
      'originalDatetime',
      'originalDurationMin',
      'newDatetime',
      'newDurationMin',
      'anticipationDays',
    ] as const;

    const missingFields: string[] = [];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      console.error('[POST /api/reschedules] missing fields:', missingFields);
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missingFields.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate types for numeric fields
    if (typeof body.originalDurationMin !== 'number') {
      console.error('[POST /api/reschedules] originalDurationMin is not a number:', typeof body.originalDurationMin);
      return new Response(
        JSON.stringify({ error: 'originalDurationMin must be a number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof body.newDurationMin !== 'number') {
      console.error('[POST /api/reschedules] newDurationMin is not a number:', typeof body.newDurationMin);
      return new Response(
        JSON.stringify({ error: 'newDurationMin must be a number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof body.anticipationDays !== 'number') {
      console.error('[POST /api/reschedules] anticipationDays is not a number:', typeof body.anticipationDays);
      return new Response(
        JSON.stringify({ error: 'anticipationDays must be a number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build input object
    const input: CreateRescheduleInput = {
      doctorCode: body.doctorCode,
      patientId: body.patientId,
      patientName: body.patientName,
      originalDatetime: body.originalDatetime,
      originalDurationMin: body.originalDurationMin,
      originalServiceCode: body.originalServiceCode,
      originalMedicalActCode: body.originalMedicalActCode,
      newDatetime: body.newDatetime,
      newDurationMin: body.newDurationMin,
      anticipationDays: body.anticipationDays,
      impact: body.impact,
      notes: body.notes,
      createdBy: body.createdBy,  // User ID who performed the reschedule
    };

    console.log('[POST /api/reschedules] calling createReschedule...');
    const reschedule = await createReschedule(input);
    console.log('[POST /api/reschedules] reschedule record created successfully, id:', reschedule.id);

    return new Response(
      JSON.stringify({ reschedule }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[POST /api/reschedules] failed to create reschedule record:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Failed to create reschedule record: ${errorMessage}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}


