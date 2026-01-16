// Server-only reschedules repository. Do not import this file in client components.

import { getSupabaseServerClient } from './supabase-server';

/**
 * Status values for reschedules.
 */
export type RescheduleStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Input type for creating a reschedule record (maps to DB columns).
 */
export interface CreateRescheduleInput {
  doctorCode: string;
  patientId: string;
  patientName?: string;
  originalDatetime: string;        // ISO timestamp
  originalDurationMin: number;
  originalServiceCode?: string;
  originalMedicalActCode?: string;
  newDatetime: string;             // ISO timestamp (was suggestedDatetime)
  newDurationMin: number;          // (was suggestedDurationMin)
  anticipationDays: number;
  impact?: string;                 // 'high' | 'medium' | 'low'
  notes?: string;
  createdBy?: string;              // User ID (auth.users.id) who performed the reschedule
}

/**
 * Row shape returned from DB.
 */
export interface Reschedule extends CreateRescheduleInput {
  id: string;                      // uuid
  status: RescheduleStatus;
  createdBy?: string;              // User ID who performed the reschedule
  created_at: string;
  updated_at: string;
}

/**
 * Creates a new reschedule record in the database with status = 'completed'.
 */
export async function createReschedule(input: CreateRescheduleInput): Promise<Reschedule> {
  const supabase = getSupabaseServerClient();

  // Build the row to insert
  const rowToInsert = {
    doctor_code: input.doctorCode,
    patient_id: input.patientId,
    patient_name: input.patientName ?? null,
    original_datetime: input.originalDatetime,
    original_duration_min: input.originalDurationMin,
    original_service_code: input.originalServiceCode ?? null,
    original_medical_act_code: input.originalMedicalActCode ?? null,
    new_datetime: input.newDatetime,
    new_duration_min: input.newDurationMin,
    anticipation_days: input.anticipationDays,
    status: 'completed',  // Reschedule already happened in Glintt
    impact: input.impact ?? null,
    notes: input.notes ?? null,
    created_by: input.createdBy ?? null,  // User who performed the reschedule
  };

  // Debug: Log what we're inserting
  console.log('[createReschedule] inserting row:', {
    doctor_code: rowToInsert.doctor_code,
    patient_id: rowToInsert.patient_id,
    original_datetime: rowToInsert.original_datetime,
    new_datetime: rowToInsert.new_datetime,
    anticipation_days: rowToInsert.anticipation_days,
    original_duration_min: rowToInsert.original_duration_min,
    new_duration_min: rowToInsert.new_duration_min,
    created_by: rowToInsert.created_by,
  });

  // Schema is set at client level (appointments_app)
  const { data, error } = await supabase
    .from('reschedules')
    .insert(rowToInsert)
    .select()
    .single();

  if (error) {
    console.error('[createReschedule] Supabase error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to create reschedule record: ${error.message}`);
  }

  if (!data) {
    console.error('[createReschedule] No data returned from insert');
    throw new Error('Failed to create reschedule record: No data returned');
  }

  console.log('[createReschedule] success, row id:', data.id);

  // Map snake_case response back to camelCase for our Reschedule type
  return {
    id: data.id,
    doctorCode: data.doctor_code,
    patientId: data.patient_id,
    patientName: data.patient_name,
    originalDatetime: data.original_datetime,
    originalDurationMin: data.original_duration_min,
    originalServiceCode: data.original_service_code,
    originalMedicalActCode: data.original_medical_act_code,
    newDatetime: data.new_datetime,
    newDurationMin: data.new_duration_min,
    anticipationDays: data.anticipation_days,
    status: data.status as RescheduleStatus,
    impact: data.impact,
    notes: data.notes,
    createdBy: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Updates the status of an existing reschedule.
 */
export async function updateRescheduleStatus(
  id: string,
  status: RescheduleStatus
): Promise<Reschedule> {
  const supabase = getSupabaseServerClient();

  // Schema is set at client level (appointments_app)
  const { data, error } = await supabase
    .from('reschedules')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateRescheduleStatus] Supabase error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to update reschedule status: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to update reschedule: No data returned');
  }

  // Map snake_case response back to camelCase for our Reschedule type
  return {
    id: data.id,
    doctorCode: data.doctor_code,
    patientId: data.patient_id,
    patientName: data.patient_name,
    originalDatetime: data.original_datetime,
    originalDurationMin: data.original_duration_min,
    originalServiceCode: data.original_service_code,
    originalMedicalActCode: data.original_medical_act_code,
    newDatetime: data.new_datetime,
    newDurationMin: data.new_duration_min,
    anticipationDays: data.anticipation_days,
    status: data.status as RescheduleStatus,
    impact: data.impact,
    notes: data.notes,
    createdBy: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}


