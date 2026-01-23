import { useState } from 'react';
import type { ScheduleSlot } from '@/lib/appointment-utils';
import type { ComparableAppointment, ConciliatedBlock } from '@/lib/glintt-api';
import { buildConciliatedBlocks } from '@/lib/glintt-api';

/**
 * Input type for creating a reschedule record via the API.
 * (Mirrors the server-side CreateRescheduleInput type)
 */
interface CreateReschedulePayload {
  doctorCode: string;
  patientId: string;
  patientName?: string;
  originalDatetime: string;
  originalDurationMin: number;
  originalServiceCode?: string;
  originalMedicalActCode?: string;
  newDatetime: string;
  newDurationMin: number;
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
 * Calculates the minimum allowed date for suggestions.
 * Requires 2 BUSINESS DAYS gap from the slot date (not from now).
 * Business days = weekdays (Monday-Friday), skipping Saturday and Sunday.
 * 
 * Example: If slot is Wednesday Feb 4th, minimum suggestion is Monday Feb 9th
 * (Thursday 5th, Friday 6th = 2 business days, then weekend, then Monday)
 */
function getMinimumAllowedDate(slotDateTime: Date): Date {
  const minDate = new Date(slotDateTime);
  
  // Reset to start of next day
  minDate.setHours(0, 0, 0, 0);
  minDate.setDate(minDate.getDate() + 1);
  
  // Add 2 business days (skip weekends)
  let businessDaysToAdd = 2;
  while (businessDaysToAdd > 0) {
    const dayOfWeek = minDate.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDaysToAdd--;
    }
    if (businessDaysToAdd > 0) {
      minDate.setDate(minDate.getDate() + 1);
    }
  }
  
  // Ensure we land on a weekday (in case we end on a weekend)
  while (minDate.getDay() === 0 || minDate.getDay() === 6) {
    minDate.setDate(minDate.getDate() + 1);
  }
  
  return minDate;
}

/**
 * Gets dates for the same weekday over the next N weeks.
 * Example: If slotDate is Friday, returns the next 2 Fridays.
 */
function getSameWeekdayDates(slotDate: Date, weeks: number = 2): Date[] {
  const dates: Date[] = [];
  const dayOfWeek = slotDate.getDay();
  
  for (let week = 1; week <= weeks; week++) {
    const date = new Date(slotDate);
    date.setDate(date.getDate() + (7 * week));
    // Ensure we land on the same day of week
    const dateDayOfWeek = date.getDay();
    if (dateDayOfWeek !== dayOfWeek) {
      const diff = (dayOfWeek - dateDayOfWeek + 7) % 7;
      date.setDate(date.getDate() + diff);
    }
    dates.push(date);
  }
  return dates;
}

/**
 * Checks if a candidate's appointment matches the target weekday and hour range.
 */
function matchesWeekdayAndHour(
  candidateDateTime: Date,
  targetWeekday: number,
  targetHour: number,
  hourExpansion: number
): boolean {
  if (candidateDateTime.getDay() !== targetWeekday) return false;
  const candidateHour = candidateDateTime.getHours();
  return candidateHour >= targetHour && candidateHour <= targetHour + hourExpansion;
}

/**
 * Finds the top 3 ideal candidates based on:
 * 1. 48-hour minimum gap
 * 2. Same weekday as the slot
 * 3. Same hour (with expansion if needed)
 * 4. Next 3 weeks priority
 */
function findTop3IdealCandidates(
  allCandidates: ReplacementCandidate[],
  slotDateTime: Date
): { ideal: ReplacementCandidate[]; hasMore: boolean } {
  const minAllowedDate = getMinimumAllowedDate(slotDateTime);
  const slotWeekday = slotDateTime.getDay();
  const slotHour = slotDateTime.getHours();
  
  // Get the next 2 weeks' dates for the same weekday
  const targetDates = getSameWeekdayDates(slotDateTime, 2);
  
  // Filter candidates that pass the 48-hour gap
  const candidatesAfter48h = allCandidates.filter(c => {
    const candidateDate = new Date(c.currentAppointmentDateTime);
    return candidateDate >= minAllowedDate;
  });

  const ideal: ReplacementCandidate[] = [];
  
  // Try with increasing hour expansion until we find 3 or exhaust options
  // Start with exact hour match, then expand by 1 hour at a time
  for (let hourExpansion = 0; hourExpansion <= 8 && ideal.length < 3; hourExpansion++) {
    for (const candidate of candidatesAfter48h) {
      if (ideal.length >= 3) break;
      if (ideal.some(c => c.blockId === candidate.blockId)) continue; // Already added
      
      const candidateDate = new Date(candidate.currentAppointmentDateTime);
      
      // Check if this candidate is on one of our target dates (same weekday, next 3 weeks)
      const isOnTargetWeekday = targetDates.some(targetDate => {
        const sameDay = candidateDate.getDate() === targetDate.getDate() &&
                        candidateDate.getMonth() === targetDate.getMonth() &&
                        candidateDate.getFullYear() === targetDate.getFullYear();
        return sameDay;
      });
      
      // If on target weekday, check hour match with current expansion
      if (isOnTargetWeekday) {
        const candidateHour = candidateDate.getHours();
        const hourMatches = candidateHour >= slotHour && candidateHour <= slotHour + hourExpansion;
        if (hourMatches) {
          ideal.push(candidate);
        }
      }
    }
    
    // If still not 3, expand to match same weekday in any week (not just target 3 weeks)
    if (ideal.length < 3 && hourExpansion > 0) {
      for (const candidate of candidatesAfter48h) {
        if (ideal.length >= 3) break;
        if (ideal.some(c => c.blockId === candidate.blockId)) continue;
        
        const candidateDate = new Date(candidate.currentAppointmentDateTime);
        
        if (matchesWeekdayAndHour(candidateDate, slotWeekday, slotHour, hourExpansion)) {
          ideal.push(candidate);
        }
      }
    }
  }

  // Sort ideal candidates by date (soonest first)
  ideal.sort((a, b) => {
    return new Date(a.currentAppointmentDateTime).getTime() - 
           new Date(b.currentAppointmentDateTime).getTime();
  });

  return {
    ideal: ideal.slice(0, 3),
    hasMore: candidatesAfter48h.length > ideal.length,
  };
}

/**
 * Hook for managing replacement patients recommendations.
 * Implements the recommendation engine with:
 * - 48-hour minimum gap
 * - Top 3 ideal candidates (same weekday/hour priority)
 * - All candidates available via "Ver todas"
 */
export function useReplacementPatients(doctorCode: string) {
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [idealCandidates, setIdealCandidates] = useState<ReplacementCandidate[]>([]);
  const [allCandidates, setAllCandidates] = useState<ReplacementCandidate[]>([]);
  const [hasMoreCandidates, setHasMoreCandidates] = useState(false);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [loadingReplacements, setLoadingReplacements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingCandidateId, setSavingCandidateId] = useState<string | null>(null);

  // Backwards compatibility: replacementCandidates returns ideal or all based on showAll flag
  const replacementCandidates = showAllCandidates ? allCandidates : idealCandidates;

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
      setIdealCandidates([]);
      setAllCandidates([]);
      setHasMoreCandidates(false);
      setShowAllCandidates(false);
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
    setIdealCandidates([]);
    setAllCandidates([]);
    setHasMoreCandidates(false);
    setShowAllCandidates(false);

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

      // Step 5: Fetch patient details for all eligible blocks
      const allEnrichedCandidates = await enrichBlocksWithPatientDetails(eligibleBlocks, nowTime);

      // Step 6: Apply 2-business-days filter for all candidates FIRST
      // The minimum allowed date is calculated from the SLOT date, not from now
      const minAllowedDate = getMinimumAllowedDate(selectedSlotDateTime);
      const filteredAllCandidates = allEnrichedCandidates.filter(c => {
        const candidateDate = new Date(c.currentAppointmentDateTime);
        return candidateDate >= minAllowedDate;
      });

      console.log('[loadReplacementPatients] After 2-business-days filter:', filteredAllCandidates.length, 'candidates (min date:', minAllowedDate.toISOString(), ')');

      // Step 7: Find top 3 ideal candidates FROM the 48h-filtered list (not allEnrichedCandidates!)
      const { ideal, hasMore } = findTop3IdealCandidates(filteredAllCandidates, selectedSlotDateTime);

      console.log('[loadReplacementPatients] Ideal:', ideal.length, 'All:', filteredAllCandidates.length);

      setIdealCandidates(ideal);
      setAllCandidates(filteredAllCandidates);
      setHasMoreCandidates(hasMore || filteredAllCandidates.length > ideal.length);

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
    setIdealCandidates([]);
    setAllCandidates([]);
    setHasMoreCandidates(false);
    setShowAllCandidates(false);
    setError(null);
  };

  /**
   * Toggle between showing ideal candidates and all candidates.
   */
  const toggleShowAllCandidates = () => {
    setShowAllCandidates(prev => !prev);
  };

  /**
   * Saves a reschedule record in the database.
   * Returns true on success, false on failure.
   * Note: This is typically called from the confirm page after Glintt reschedule succeeds.
   */
  const saveReschedule = async (candidate: ReplacementCandidate): Promise<boolean> => {
    if (!selectedSlot || !doctorCode) {
      console.warn('[saveReschedule] missing selectedSlot or doctorCode');
      return false;
    }

    try {
      setSavingCandidateId(candidate.blockId);

      // Get data from the first appointment in the block
      const originalAppointment = candidate.appointments[0];

      // Compute impact based on anticipation days
      const impact = computeImpactFromAnticipation(candidate.anticipationDays);

      // Get duration from selected slot (use pre-computed if available from merged slots)
      let newDurationMin: number;
      if (selectedSlot.durationMinutes !== undefined) {
        newDurationMin = selectedSlot.durationMinutes;
      } else {
        const slotDuration = selectedSlot.slot?.Duration || selectedSlot.appointment?.duration || '00:30:00';
        newDurationMin = parseDurationToMinutes(slotDuration);
      }

      const payload: CreateReschedulePayload = {
        doctorCode,
        patientId: candidate.patientId,
        patientName: candidate.patientName,
        originalDatetime: candidate.currentAppointmentDateTime,
        originalDurationMin: candidate.currentDurationMinutes,
        originalServiceCode: originalAppointment?.serviceCode,
        originalMedicalActCode: originalAppointment?.medicalActCode,
        newDatetime: selectedSlot.dateTime,
        newDurationMin,
        anticipationDays: candidate.anticipationDays,
        impact,
        notes: null,
      };

      const res = await fetch('/api/reschedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error('[saveReschedule] HTTP error', res.status);
        return false;
      }

      const json = await res.json();
      if (!json.reschedule) {
        console.error('[saveReschedule] missing reschedule in response');
        return false;
      }

      return true;
    } catch (err) {
      console.error('[saveReschedule] exception', err);
      return false;
    } finally {
      setSavingCandidateId(null);
    }
  };

  return {
    selectedSlot,
    replacementCandidates,    // Returns ideal or all based on showAllCandidates
    idealCandidates,          // Top 3 ideal candidates
    allCandidates,            // All eligible candidates (after 48h filter)
    hasMoreCandidates,        // Whether there are more than the ideal 3
    showAllCandidates,        // Current view mode
    toggleShowAllCandidates,  // Toggle between ideal and all
    loadingReplacements,
    error,
    handleSlotClick,
    loadReplacementPatients,
    clearSelection,
    saveReschedule,
    savingCandidateId,
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
