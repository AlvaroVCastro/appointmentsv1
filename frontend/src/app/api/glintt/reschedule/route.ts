import { NextRequest, NextResponse } from 'next/server';
import { rescheduleAppointment, RescheduleResult } from '@/lib/glintt-api';

/**
 * Request body for rescheduling appointments.
 */
interface RescheduleRequestBody {
  // The appointments to reschedule (can be multiple for conciliated blocks)
  appointments: Array<{
    appointmentId: string;
    serviceCode: string;
    medicalActCode: string;
    durationMinutes: number;  // Used to calculate slot offset for next appt
  }>;
  patientId: string;
  // Target slot info (from the empty slot)
  targetSlotDateTime: string;
  targetBookingID: string;
  targetDuration: string;
  targetDoctorCode: string;
}

/**
 * Response structure for reschedule operations.
 */
interface RescheduleResponse {
  success: boolean;
  results?: RescheduleResult[];
  error?: string;
  partialResults?: RescheduleResult[];  // Included on failure for debugging
}

/**
 * POST /api/glintt/reschedule
 *
 * Reschedules one or more appointments (conciliated block) to a new slot.
 * For blocks with multiple appointments, they are rescheduled sequentially
 * with incrementing slot times.
 *
 * Example: A block with 2 appointments (each 30min) targeting 14:00:
 * - Appointment 1 → 14:00
 * - Appointment 2 → 14:30
 */
export async function POST(request: NextRequest): Promise<NextResponse<RescheduleResponse>> {
  console.log('[POST /api/glintt/reschedule] Request received');

  try {
    const body: RescheduleRequestBody = await request.json();

    console.log('[POST /api/glintt/reschedule] Request body:', JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.appointments || !Array.isArray(body.appointments) || body.appointments.length === 0) {
      console.error('[POST /api/glintt/reschedule] Missing or empty appointments array');
      return NextResponse.json(
        { success: false, error: 'Missing or empty appointments array' },
        { status: 400 }
      );
    }

    if (!body.patientId) {
      console.error('[POST /api/glintt/reschedule] Missing patientId');
      return NextResponse.json(
        { success: false, error: 'Missing patientId' },
        { status: 400 }
      );
    }

    if (!body.targetSlotDateTime || !body.targetBookingID || !body.targetDuration || !body.targetDoctorCode) {
      console.error('[POST /api/glintt/reschedule] Missing target slot info');
      return NextResponse.json(
        { success: false, error: 'Missing target slot info (targetSlotDateTime, targetBookingID, targetDuration, targetDoctorCode)' },
        { status: 400 }
      );
    }

    // Validate each appointment has required fields
    for (let i = 0; i < body.appointments.length; i++) {
      const appt = body.appointments[i];
      if (!appt.appointmentId) {
        console.error(`[POST /api/glintt/reschedule] Appointment ${i} missing appointmentId`);
        return NextResponse.json(
          { success: false, error: `Appointment ${i} missing appointmentId` },
          { status: 400 }
        );
      }
    }

    console.log(`[POST /api/glintt/reschedule] Processing ${body.appointments.length} appointment(s) for patient ${body.patientId}`);

    // Process each appointment in the block sequentially
    const results: RescheduleResult[] = [];
    let currentSlotTime = new Date(body.targetSlotDateTime);

    for (let i = 0; i < body.appointments.length; i++) {
      const appt = body.appointments[i];
      const slotDateTime = currentSlotTime.toISOString();

      console.log(`[POST /api/glintt/reschedule] Processing appointment ${i + 1}/${body.appointments.length}:`);
      console.log(`  - appointmentId: ${appt.appointmentId}`);
      console.log(`  - targetSlotDateTime: ${slotDateTime}`);

      const result = await rescheduleAppointment({
        appointmentId: appt.appointmentId,
        patientId: body.patientId,
        serviceCode: appt.serviceCode || '36',  // Default service code
        medicalActCode: appt.medicalActCode || '1',  // Default medical act
        targetSlotDateTime: slotDateTime,
        targetBookingID: body.targetBookingID,
        targetDuration: body.targetDuration,
        targetDoctorCode: body.targetDoctorCode,
      });

      results.push(result);

      if (!result.success) {
        // Reschedule failed - log and return error
        console.error(`[POST /api/glintt/reschedule] FAILED for appointment ${appt.appointmentId}:`, result.error);
        console.error(`[POST /api/glintt/reschedule] Completed ${i}/${body.appointments.length} appointments before failure`);

        return NextResponse.json(
          {
            success: false,
            error: `Failed to reschedule appointment ${appt.appointmentId}: ${result.error}`,
            partialResults: results,  // Include what succeeded for debugging
          },
          { status: 500 }
        );
      }

      console.log(`[POST /api/glintt/reschedule] SUCCESS for appointment ${appt.appointmentId}`);

      // Move to next slot time for next appointment in block
      const durationMinutes = appt.durationMinutes || 30;
      currentSlotTime = new Date(currentSlotTime.getTime() + durationMinutes * 60 * 1000);
    }

    console.log(`[POST /api/glintt/reschedule] All ${body.appointments.length} appointment(s) rescheduled successfully`);

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/glintt/reschedule] Exception:', errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
