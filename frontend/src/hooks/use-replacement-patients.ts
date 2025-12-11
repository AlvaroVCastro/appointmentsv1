import { useState } from 'react';
import type { ScheduleSlot } from '@/lib/appointment-utils';
import type { ComparableAppointment, ConciliatedBlock } from '@/lib/glintt-api';
import { buildConciliatedBlocks } from '@/lib/glintt-api';

/**
 * Input type for creating a suggestion via the API.
 * (Mirrors the server-side CreateSuggestionInput type)
 */
interface CreateSuggestionPayload {
  doctorCode: string;
  patientId: string;
  patientName?: string;
  originalDatetime: string;
  originalDurationMin: number;
  originalServiceCode?: string;
  originalMedicalActCode?: string;
  suggestedDatetime: string;
  suggestedDurationMin: number;
  anticipationDays: number;
  impact?: string;
  notes?: string | null;
}

/**
 * Computes impact level based on anticipation days.
 * - 3 days or less: 'high'
 * - 7 days or less: 'medium'
 * - More than 7 days: 'low'
 */
function computeImpactFromAnticipation(anticipationDays: number): string {
  if (anticipationDays <= 3) return 'high';
  if (anticipationDays <= 7) return 'medium';
  return 'low';
}

/**
 * Patient contact information
 */
interface PatientContact {
  id: string;
  name: string;
  contacts?: {
    phoneNumber1?: string;
    phoneNumber2?: string;
    email?: string;
  };
}

/**
 * A replacement candidate - a conciliated block with patient details
 */
export interface ReplacementCandidate {
  blockId: string;
  patientId: string;
  patientName?: string;
  phoneNumber1?: string;
  phoneNumber2?: string;
  email?: string;
  currentAppointmentDateTime: string; // block.startDateTime
  currentDurationMinutes: number;     // block.durationMinutes
  appointments: ComparableAppointment[]; // individual appointments in the block
  anticipationDays: number; // days until this appointment
}

/**
 * Helper to parse duration string (HH:MM:SS) to minutes.
 */
function parseDurationToMinutes(duration: string): number {
  if (!duration) return 0;
  const parts = duration.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }
  return 0;
}

/**
 * Checks if a slot is eligible for suggestions (Empty, Rescheduled, or Annulled).
 */
function isSlotEligibleForSuggestions(slot: ScheduleSlot): boolean {
  // A slot is eligible if it's not occupied OR if it's empty due to status (Rescheduled/Annulled)
  return !slot.isOccupied || slot.isEmptyDueToStatus === true;
}

/**
 * Hook for managing replacement patients recommendations.
 * Implements the recommendation engine with:
 * - 30-day time window
 * - Conciliated (aggregated) appointment blocks
 * - Duration compatibility filtering
 * - Forward-in-time only (block.startDateTime > slot.dateTime)
 * - Sorting by "coming up sooner"
 * - Top 20 candidates limit
 */
export function useReplacementPatients(doctorCode: string) {
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [replacementCandidates, setReplacementCandidates] = useState<ReplacementCandidate[]>([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingCandidateId, setSavingCandidateId] = useState<string | null>(null);

  /**
   * Handles a slot click. If the slot is eligible (Empty/Rescheduled/Annulled),
   * runs the recommendation engine. Otherwise, clears the suggestions.
   */
  const handleSlotClick = async (slot: ScheduleSlot) => {
    const isEligible = isSlotEligibleForSuggestions(slot);

    if (isEligible) {
      // Run recommendation engine for eligible slots
      await loadReplacementPatients(slot);
    } else {
      // Clear suggestions for non-eligible (occupied) slots
      console.log('[handleSlotClick] Slot is occupied, clearing suggestions');
      setSelectedSlot(null);
      setReplacementCandidates([]);
      setError(null);
    }
  };

  /**
   * Loads replacement candidates for a given empty/rescheduled/annulled slot.
   * Only called internally for eligible slots.
   * 
   * The slot may be a MERGED group of consecutive empty slots.
   * In that case, we use the total duration of the group.
   */
  const loadReplacementPatients = async (slot: ScheduleSlot) => {
    // Need some slot data - slot object, appointment, merged group, or at least duration
    if (!slot.slot && !slot.appointment && !slot.isMergedGroup && slot.durationMinutes === undefined) {
      console.log('[loadReplacementPatients] No slot or appointment data');
      return;
    }

    setLoadingReplacements(true);
    setSelectedSlot(slot);
    setError(null);
    setReplacementCandidates([]); // Clear previous candidates while loading

    try {
      // Extract slot information
      const slotDoctorCode = slot.slot?.HumanResourceCode || slot.appointment?.humanResourceCode || doctorCode;
      
      // IMPORTANT: Use the pre-computed durationMinutes from merged slots
      // This is the total duration of consecutive empty slots combined
      let slotDurationMinutes: number;
      if (slot.durationMinutes !== undefined) {
        // Use pre-computed duration (from merged slot groups)
        slotDurationMinutes = slot.durationMinutes;
      } else {
        // Fallback: parse from raw duration string
        const slotDuration = slot.slot?.Duration || slot.appointment?.duration || '00:30:00';
        slotDurationMinutes = parseDurationToMinutes(slotDuration);
      }
      
      const selectedSlotDateTime = new Date(slot.dateTime);

      console.log('[loadReplacementPatients] slot info:', {
        dateTime: slot.dateTime,
        endDateTime: slot.endDateTime,
        durationMinutes: slotDurationMinutes,
        isMergedGroup: slot.isMergedGroup,
        mergedSlotsCount: slot.mergedSlots?.length || 1,
        doctor: slotDoctorCode,
      });

      // Calculate 30-day window from today
      const now = new Date();
      const fromDateObj = new Date(now);
      fromDateObj.setHours(0, 0, 0, 0);
      const toDateObj = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      toDateObj.setHours(23, 59, 59, 999);

      const fromDate = fromDateObj.toISOString().split('T')[0];
      const toDate = toDateObj.toISOString().split('T')[0];

      // Step 1: Fetch appointments for 30-day window
      const response = await fetch(
        `/api/glintt/appointments-window?doctorCode=${encodeURIComponent(slotDoctorCode)}&fromDate=${fromDate}&toDate=${toDate}`
      );

      if (!response.ok) {
        throw new Error('Failed to load appointments for recommendation');
      }

      const data = await response.json();
      const appointments: ComparableAppointment[] = data.appointments || [];

      console.log('[loadReplacementPatients] Fetched', appointments.length, 'appointments in 30-day window');

      // Step 2: Build conciliated blocks
      const blocks = buildConciliatedBlocks(appointments, slotDoctorCode);
      console.log('[loadReplacementPatients] Built', blocks.length, 'conciliated blocks');

      // Step 3: Filter eligible blocks
      // Requirements:
      // - duration <= slot duration (duration compatibility)
      // - block.startDateTime > selectedSlotDateTime (forward in time ONLY)
      // - block.startDateTime within 30-day window
      const selectedSlotTime = selectedSlotDateTime.getTime();
      const fromTime = fromDateObj.getTime();
      const toTime = toDateObj.getTime();

      const eligibleBlocks = blocks.filter(block => {
        const blockTime = new Date(block.startDateTime).getTime();
        const passesDuration = block.durationMinutes <= slotDurationMinutes;
        const passesForward = blockTime > selectedSlotTime;
        const passesFromTime = blockTime >= fromTime;
        const passesToTime = blockTime <= toTime;
        
        return passesDuration && passesForward && passesFromTime && passesToTime;
      });

      console.log(
        '[loadReplacementPatients] Eligible blocks:', eligibleBlocks.length,
        '(duration <=', slotDurationMinutes, 'min, after slot', slot.dateTime, ')'
      );

      // Step 4: Sort by "coming up sooner" (smallest anticipation first)
      const nowTime = now.getTime();
      eligibleBlocks.sort((a, b) => {
        const deltaA = new Date(a.startDateTime).getTime() - nowTime;
        const deltaB = new Date(b.startDateTime).getTime() - nowTime;
        return deltaA - deltaB;
      });

      // Step 5: Limit to top 20
      const top20 = eligibleBlocks.slice(0, 20);

      // Step 6: Fetch patient details for each candidate
      const candidates = await enrichBlocksWithPatientDetails(top20, nowTime);

      console.log('[loadReplacementPatients] Final candidates:', candidates.length);
      setReplacementCandidates(candidates);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load replacement candidates';
      console.error('[loadReplacementPatients] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoadingReplacements(false);
    }
  };

  /**
   * Clears the current selection and candidates.
   */
  const clearSelection = () => {
    setSelectedSlot(null);
    setReplacementCandidates([]);
    setError(null);
  };

  /**
   * Saves a replacement candidate as a suggestion in the database.
   * Returns true on success, false on failure.
   */
  const saveSuggestion = async (candidate: ReplacementCandidate): Promise<boolean> => {
    if (!selectedSlot || !doctorCode) {
      console.warn('[saveSuggestion] missing selectedSlot or doctorCode');
      return false;
    }

    try {
      setSavingCandidateId(candidate.blockId);

      // Get data from the first appointment in the block
      const originalAppointment = candidate.appointments[0];

      // Compute impact based on anticipation days
      const impact = computeImpactFromAnticipation(candidate.anticipationDays);

      // Get duration from selected slot (use pre-computed if available from merged slots)
      let suggestedDurationMin: number;
      if (selectedSlot.durationMinutes !== undefined) {
        suggestedDurationMin = selectedSlot.durationMinutes;
      } else {
        const slotDuration = selectedSlot.slot?.Duration || selectedSlot.appointment?.duration || '00:30:00';
        suggestedDurationMin = parseDurationToMinutes(slotDuration);
      }

      const payload: CreateSuggestionPayload = {
        doctorCode,
        patientId: candidate.patientId,
        patientName: candidate.patientName,
        originalDatetime: candidate.currentAppointmentDateTime,
        originalDurationMin: candidate.currentDurationMinutes,
        originalServiceCode: originalAppointment?.serviceCode,
        originalMedicalActCode: originalAppointment?.medicalActCode,
        suggestedDatetime: selectedSlot.dateTime,
        suggestedDurationMin,
        anticipationDays: candidate.anticipationDays,
        impact,
        notes: null,
      };

      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error('[saveSuggestion] HTTP error', res.status);
        return false;
      }

      const json = await res.json();
      if (!json.suggestion) {
        console.error('[saveSuggestion] missing suggestion in response');
        return false;
      }

      return true;
    } catch (err) {
      console.error('[saveSuggestion] exception', err);
      return false;
    } finally {
      setSavingCandidateId(null);
    }
  };

  return {
    selectedSlot,
    replacementCandidates,
    loadingReplacements,
    error,
    handleSlotClick,        // New: unified click handler
    loadReplacementPatients, // Keep for direct use if needed
    clearSelection,
    saveSuggestion,         // Save a candidate as a suggestion
    savingCandidateId,      // ID of the candidate currently being saved
  };
}

/**
 * Fetches patient contact details for each block and transforms to ReplacementCandidate.
 */
async function enrichBlocksWithPatientDetails(
  blocks: ConciliatedBlock[],
  nowTime: number
): Promise<ReplacementCandidate[]> {
  // Get unique patient IDs
  const uniquePatientIds = [...new Set(blocks.map(b => b.patientId))];

  // Fetch patient details in parallel
  const patientDetailsMap = new Map<string, PatientContact>();
  
  await Promise.all(
    uniquePatientIds.map(async (patientId) => {
      try {
        const response = await fetch(`/api/glintt/patients/${patientId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.patient) {
            patientDetailsMap.set(patientId, data.patient);
          }
        }
      } catch (err) {
        console.warn(`[enrichBlocksWithPatientDetails] Failed to fetch patient ${patientId}:`, err);
      }
    })
  );

  // Transform blocks to ReplacementCandidate
  return blocks.map(block => {
    const patient = patientDetailsMap.get(block.patientId);
    const blockTime = new Date(block.startDateTime).getTime();
    const anticipationMs = blockTime - nowTime;
    const anticipationDays = Math.ceil(anticipationMs / (24 * 60 * 60 * 1000));

    return {
      blockId: block.blockId,
      patientId: block.patientId,
      patientName: patient?.name || block.patientName,
      phoneNumber1: patient?.contacts?.phoneNumber1,
      phoneNumber2: patient?.contacts?.phoneNumber2,
      email: patient?.contacts?.email,
      currentAppointmentDateTime: block.startDateTime,
      currentDurationMinutes: block.durationMinutes,
      appointments: block.appointments,
      anticipationDays,
    };
  });
}
