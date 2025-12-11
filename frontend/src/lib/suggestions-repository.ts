// Server-only suggestions repository. Do not import this file in client components.

import { getSupabaseServerClient } from './supabase-server';

/**
 * Status values for suggestions.
 */
export type SuggestionStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'error'
  | 'in_progress';

/**
 * Input type for creating a suggestion (maps to DB columns).
 */
export interface CreateSuggestionInput {
  doctorCode: string;
  patientId: string;
  patientName?: string;
  originalDatetime: string;        // ISO timestamp
  originalDurationMin: number;
  originalServiceCode?: string;
  originalMedicalActCode?: string;
  suggestedDatetime: string;       // ISO timestamp
  suggestedDurationMin: number;
  anticipationDays: number;
  impact?: string;                 // 'high' | 'medium' | 'low'
  notes?: string;
}

/**
 * Row shape returned from DB.
 */
export interface Suggestion extends CreateSuggestionInput {
  id: string;                      // uuid
  status: SuggestionStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Creates a new suggestion in the database with status = 'pending'.
 */
export async function createSuggestion(input: CreateSuggestionInput): Promise<Suggestion> {
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
    suggested_datetime: input.suggestedDatetime,
    suggested_duration_min: input.suggestedDurationMin,
    anticipation_days: input.anticipationDays,
    status: 'pending',
    impact: input.impact ?? null,
    notes: input.notes ?? null,
  };

  // Debug: Log what we're inserting
  console.log('[createSuggestion] inserting row:', {
    doctor_code: rowToInsert.doctor_code,
    patient_id: rowToInsert.patient_id,
    original_datetime: rowToInsert.original_datetime,
    suggested_datetime: rowToInsert.suggested_datetime,
    anticipation_days: rowToInsert.anticipation_days,
    original_duration_min: rowToInsert.original_duration_min,
    suggested_duration_min: rowToInsert.suggested_duration_min,
  });

  // Schema is set at client level (appointments_app)
  const { data, error } = await supabase
    .from('suggestions')
    .insert(rowToInsert)
    .select()
    .single();

  if (error) {
    console.error('[createSuggestion] Supabase error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to create suggestion: ${error.message}`);
  }

  if (!data) {
    console.error('[createSuggestion] No data returned from insert');
    throw new Error('Failed to create suggestion: No data returned');
  }

  console.log('[createSuggestion] success, row id:', data.id);

  // Map snake_case response back to camelCase for our Suggestion type
  return {
    id: data.id,
    doctorCode: data.doctor_code,
    patientId: data.patient_id,
    patientName: data.patient_name,
    originalDatetime: data.original_datetime,
    originalDurationMin: data.original_duration_min,
    originalServiceCode: data.original_service_code,
    originalMedicalActCode: data.original_medical_act_code,
    suggestedDatetime: data.suggested_datetime,
    suggestedDurationMin: data.suggested_duration_min,
    anticipationDays: data.anticipation_days,
    status: data.status as SuggestionStatus,
    impact: data.impact,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Updates the status of an existing suggestion.
 * (Not used yet, but implemented for future phases.)
 */
export async function updateSuggestionStatus(
  id: string,
  status: SuggestionStatus
): Promise<Suggestion> {
  const supabase = getSupabaseServerClient();

  // Schema is set at client level (appointments_app)
  const { data, error } = await supabase
    .from('suggestions')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateSuggestionStatus] Supabase error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to update suggestion status: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to update suggestion: No data returned');
  }

  // Map snake_case response back to camelCase for our Suggestion type
  return {
    id: data.id,
    doctorCode: data.doctor_code,
    patientId: data.patient_id,
    patientName: data.patient_name,
    originalDatetime: data.original_datetime,
    originalDurationMin: data.original_duration_min,
    originalServiceCode: data.original_service_code,
    originalMedicalActCode: data.original_medical_act_code,
    suggestedDatetime: data.suggested_datetime,
    suggestedDurationMin: data.suggested_duration_min,
    anticipationDays: data.anticipation_days,
    status: data.status as SuggestionStatus,
    impact: data.impact,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}


