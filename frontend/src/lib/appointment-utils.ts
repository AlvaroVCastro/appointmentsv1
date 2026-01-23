import type { Slot, Appointment, MergedSlot } from '@/lib/glintt-api';

export interface ScheduleSlot {
  dateTime: string;
  isOccupied: boolean;
  appointment?: Appointment;
  slot?: Slot;
  isRescheduled?: boolean;
  originalDate?: string;
  isEmptyDueToStatus?: boolean; // For ANNULLED or RESCHEDULED appointments
  missingAppointmentDetails?: boolean; // Occupied slot with no matching appointment found
  // Fields for merged empty slot groups
  durationMinutes?: number;      // Duration of this slot (or total duration if merged)
  endDateTime?: string;          // End time (important for merged slots)
  isMergedGroup?: boolean;       // True if this represents multiple consecutive empty slots
  mergedSlots?: ScheduleSlot[];  // The individual slots that were merged
}

export function getNextDays(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export function formatDateTime(dateTime: string) {
  const date = new Date(dateTime);
  return {
    time: date.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    date: date.toLocaleDateString('pt-PT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }),
  };
}

export function formatFullDate(dateTime: string) {
  const date = new Date(dateTime);
  return date.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Checks if a date falls on a Saturday.
 */
function isSaturday(dateTime: string): boolean {
  return new Date(dateTime).getDay() === 6;
}

/**
 * Processes merged slots from the API into ScheduleSlot[] for the UI.
 *
 * Since merging is now done server-side in glintt-api.ts, this function
 * is a simple mapper that:
 * 1. Defensive filter: skip any blocked slots (Code "B") that slipped through
 * 2. Skip Saturdays (clinic doesn't operate on Saturdays)
 * 3. Maps MergedSlot fields to ScheduleSlot fields
 * 4. Sorts by datetime
 *
 * The slots parameter is actually MergedSlot[] from getDoctorSchedule().
 * The appointments parameter is kept for backward compatibility but not used.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function processScheduleData(slots: MergedSlot[], _appointments: Appointment[]): ScheduleSlot[] {
  console.log(`[processScheduleData] Processing ${slots.length} pre-merged slots`);

  const result: ScheduleSlot[] = [];

  for (const slot of slots) {
    // Defensive: skip blocked slots (should already be filtered server-side)
    if (slot.OccupationReason?.Code === 'B') {
      continue;
    }

    // Skip Saturdays - clinic doesn't operate on Saturdays
    if (isSaturday(slot.SlotDateTime)) {
      continue;
    }

    // Map MergedSlot to ScheduleSlot
    const scheduleSlot: ScheduleSlot = {
      dateTime: slot.SlotDateTime,
      isOccupied: slot.isOccupied,
      slot: slot, // Keep raw slot data for reference
      appointment: slot.appointment,
      missingAppointmentDetails: slot.missingAppointmentDetails,
    };

    result.push(scheduleSlot);
  }
  
  const emptyCount = result.filter(s => !s.isOccupied).length;
  const occupiedCount = result.filter(s => s.isOccupied).length;
  const missingCount = result.filter(s => s.missingAppointmentDetails).length;
  
  console.log(`[processScheduleData] Result: ${result.length} slots (${emptyCount} free, ${occupiedCount} occupied, ${missingCount} missing appointment details)`);
  
  // Sort by datetime
  return result.sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
}

/**
 * Returns a YYYY-MM-DD string from a Date object or ISO string.
 * Used as a consistent key for grouping/filtering slots by day.
 */
export function formatDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns an array of Date objects for the next `count` days starting from today.
 * Different from getNextDays() which returns {startDate, endDate} strings.
 * Skips Saturdays (getDay() === 6) and Sundays (getDay() === 0) to only include weekdays.
 */
export function getNextDaysArray(count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  let dayOffset = 0;

  while (days.length < count) {
    const d = new Date(today);
    d.setDate(today.getDate() + dayOffset);
    // Skip Saturdays (getDay() === 6) and Sundays (getDay() === 0)
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(d);
    }
    dayOffset++;
  }

  return days;
}

/**
 * Filters slots to only include those matching the target date.
 */
export function getSlotsForDate(allSlots: ScheduleSlot[], targetDate: Date): ScheduleSlot[] {
  const targetKey = formatDateKey(targetDate);

  return allSlots.filter(slot => {
    const slotKey = formatDateKey(slot.dateTime);
    return slotKey === targetKey;
  });
}

/**
 * Determines if a slot is empty (available for booking).
 * A slot is empty if it's not occupied OR if it was freed due to annulled/rescheduled status.
 * This matches the existing UI logic for displaying "Empty" labels.
 */
export function isEmptySlot(slot: ScheduleSlot): boolean {
  return !slot.isOccupied || slot.isEmptyDueToStatus === true;
}

/**
 * Checks if there's at least one empty slot for a given date.
 * Used to show the orange indicator dot on the day strip.
 */
export function hasEmptySlotsForDate(allSlots: ScheduleSlot[], targetDate: Date): boolean {
  const slotsForDate = getSlotsForDate(allSlots, targetDate);
  return slotsForDate.some(isEmptySlot);
}

/**
 * Parse duration string to minutes.
 * Handles multiple formats:
 * - Glintt datetime format: "2020-05-01T00:30:00" (time part is the duration)
 * - Time format: "HH:MM:SS" or "HH:MM"
 */
export function parseDurationToMinutes(duration: string): number {
  if (!duration) return 30; // Default 30 minutes
  
  // Check if it's a datetime string (Glintt format: "2020-05-01T00:30:00")
  // The time part after 'T' represents the actual duration
  let timePart = duration;
  if (duration.includes('T')) {
    const parts = duration.split('T');
    if (parts.length >= 2) {
      timePart = parts[1]; // Get the time part: "00:30:00"
    }
  }
  
  // Now parse the time part (HH:MM:SS or HH:MM)
  const timeParts = timePart.split(':');
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0], 10) || 0;
    const minutes = parseInt(timeParts[1], 10) || 0;
    return hours * 60 + minutes;
  }
  return 30; // Default 30 minutes
}

/**
 * Get hour from a datetime string (0-23).
 */
function getHour(dateTime: string): number {
  return new Date(dateTime).getHours();
}

/**
 * Check if a time is within the lunch break barrier (13:00-14:00).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isLunchBreak(hour: number): boolean {
  return hour >= 13 && hour < 14;
}

/**
 * Check if a time is past the end of day barrier (18:00+).
 */
function isPastEndOfDay(hour: number): boolean {
  return hour >= 18;
}

/**
 * Merges consecutive empty slots into single slots that represent
 * the actual available time window.
 * 
 * Rules:
 * 1. Empty slots are merged until we hit an occupied slot
 * 2. The merged slot ENDS at the START of the next occupied slot
 * 3. Barriers that break merging:
 *    - Lunch break (13:00-14:00)
 *    - End of day (18:00+)
 *    - Different day
 * 4. Only ONE merged slot is created per continuous empty period
 */
export function mergeConsecutiveEmptySlots(slots: ScheduleSlot[]): ScheduleSlot[] {
  if (slots.length === 0) return [];

  // Sort slots by start time
  const sortedSlots = [...slots].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );

  const result: ScheduleSlot[] = [];
  let i = 0;

  while (i < sortedSlots.length) {
    const slot = sortedSlots[i];
    const slotIsEmpty = isEmptySlot(slot);

    if (!slotIsEmpty) {
      // Occupied slot - add as-is with duration info
      const durationStr = slot.slot?.Duration || slot.appointment?.duration || '00:30:00';
      const durationMinutes = parseDurationToMinutes(durationStr);
      const startTime = new Date(slot.dateTime).getTime();
      const endDateTime = new Date(startTime + durationMinutes * 60 * 1000).toISOString();
      
      result.push({
        ...slot,
        durationMinutes,
        endDateTime,
      });
      i++;
    } else {
      // Empty slot - find the end of this empty period
      const emptyStartSlot = slot;
      const emptyStartTime = new Date(emptyStartSlot.dateTime).getTime();
      const emptyStartHour = getHour(emptyStartSlot.dateTime);
      const emptyStartDay = formatDateKey(emptyStartSlot.dateTime);
      
      // Skip past end of day slots (18:00+)
      if (isPastEndOfDay(emptyStartHour)) {
        i++;
        continue;
      }

      // Collect all consecutive empty slots in this group
      const emptySlots: ScheduleSlot[] = [emptyStartSlot];
      let j = i + 1;
      
      // Find where this empty period ends
      let endDateTime: string | null = null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let _endReason: string = 'end_of_schedule';
      
      while (j < sortedSlots.length) {
        const nextSlot = sortedSlots[j];
        const nextSlotDay = formatDateKey(nextSlot.dateTime);
        const nextSlotHour = getHour(nextSlot.dateTime);
        const nextIsEmpty = isEmptySlot(nextSlot);
        
        // Check for barriers
        
        // Different day - stop
        if (nextSlotDay !== emptyStartDay) {
          // End at end of the last empty slot
          const lastEmpty = emptySlots[emptySlots.length - 1];
          const lastDuration = parseDurationToMinutes(lastEmpty.slot?.Duration || lastEmpty.appointment?.duration || '00:30:00');
          const lastStart = new Date(lastEmpty.dateTime).getTime();
          endDateTime = new Date(lastStart + lastDuration * 60 * 1000).toISOString();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _endReason = 'different_day';
          break;
        }
        
        // Lunch break barrier - if we started before lunch and next slot is after lunch
        if (emptyStartHour < 13 && nextSlotHour >= 14) {
          // End at 13:00 (lunch start)
          const lunchStart = new Date(emptyStartSlot.dateTime);
          lunchStart.setHours(13, 0, 0, 0);
          endDateTime = lunchStart.toISOString();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _endReason = 'lunch_break';
          break;
        }
        
        // End of day barrier (18:00+)
        if (nextSlotHour >= 18 && !isPastEndOfDay(emptyStartHour)) {
          // End at 18:00
          const dayEnd = new Date(emptyStartSlot.dateTime);
          dayEnd.setHours(18, 0, 0, 0);
          endDateTime = dayEnd.toISOString();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _endReason = 'end_of_day';
          break;
        }
        
        // Found an occupied slot - this is where empty period ends
        if (!nextIsEmpty) {
          endDateTime = nextSlot.dateTime; // End at START of occupied slot
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _endReason = 'occupied_slot';
          break;
        }
        
        // Still empty and no barriers - add to group
        emptySlots.push(nextSlot);
        j++;
      }
      
      // If we reached end of schedule without finding an end
      if (!endDateTime && emptySlots.length > 0) {
        const lastEmpty = emptySlots[emptySlots.length - 1];
        const lastDuration = parseDurationToMinutes(lastEmpty.slot?.Duration || lastEmpty.appointment?.duration || '00:30:00');
        const lastStart = new Date(lastEmpty.dateTime).getTime();
        
        // Check if this would go past 18:00
        const potentialEnd = new Date(lastStart + lastDuration * 60 * 1000);
        if (potentialEnd.getHours() >= 18) {
          // Cap at 18:00
          const dayEnd = new Date(lastEmpty.dateTime);
          dayEnd.setHours(18, 0, 0, 0);
          endDateTime = dayEnd.toISOString();
        } else {
          endDateTime = potentialEnd.toISOString();
        }
      }
      
      // Calculate duration
      const endTime = new Date(endDateTime!).getTime();
      const durationMinutes = Math.round((endTime - emptyStartTime) / (60 * 1000));
      
      // Only add if duration is positive
      if (durationMinutes > 0) {
        // Check if any slot in the group is empty due to status
        const hasEmptyDueToStatus = emptySlots.some(s => s.isEmptyDueToStatus);
        
        result.push({
          dateTime: emptyStartSlot.dateTime,
          endDateTime: endDateTime!,
          isOccupied: false,
          isEmptyDueToStatus: hasEmptyDueToStatus,
          durationMinutes,
          isMergedGroup: emptySlots.length > 1,
          mergedSlots: emptySlots.length > 1 ? emptySlots : undefined,
          slot: emptyStartSlot.slot,
          appointment: emptySlots.find(s => s.appointment)?.appointment,
        });
      }
      
      // Skip all the empty slots we just processed
      i = j;
    }
  }

  // Sort result by time (should already be sorted, but ensure)
  return result.sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
}
