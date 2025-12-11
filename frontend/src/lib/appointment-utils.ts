import type { Slot, Appointment } from '@/lib/glintt-api';

export interface ScheduleSlot {
  dateTime: string;
  isOccupied: boolean;
  appointment?: Appointment;
  slot?: Slot;
  isRescheduled?: boolean;
  originalDate?: string;
  isEmptyDueToStatus?: boolean; // For ANNULLED or RESCHEDULED appointments
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

export function processScheduleData(slots: Slot[], appointments: Appointment[]): ScheduleSlot[] {
  const scheduleMap = new Map<string, ScheduleSlot>();
  
  // Process slots - check both Occupation and OccupationReason.Code
  // OccupationReason.Code === "C" means "Slot totalmente ocupado" (totally occupied)
  // OccupationReason.Code === "N" means "Slot livre" (free slot)
  slots.forEach((slot: Slot) => {
    const dateTime = new Date(slot.SlotDateTime).toISOString();
    const occupationReasonCode = slot.OccupationReason?.Code;
    // Slot is occupied if Occupation is true OR OccupationReason.Code is "C"
    const isOccupied = slot.Occupation === true || occupationReasonCode === "C";
    scheduleMap.set(dateTime, {
      dateTime,
      isOccupied,
      slot,
    });
  });

  // Process appointments - prioritize scheduled appointments over rescheduled/annulled
  // First pass: Process scheduled appointments (not ANNULLED or RESCHEDULED)
  appointments.forEach((apt: Appointment) => {
    const aptDateTime = new Date(apt.scheduleDate);
    const isAnnulledOrRescheduled = apt.status === 'ANNULLED' || apt.status === 'RESCHEDULED';
    
    // Skip annulled/rescheduled in first pass
    if (isAnnulledOrRescheduled) return;
    
    // Try to match with slots that are close in time (within 30 minutes)
    let matched = false;
    for (const [dateTime, slot] of scheduleMap.entries()) {
      const slotDateTime = new Date(dateTime);
      const timeDiff = Math.abs(aptDateTime.getTime() - slotDateTime.getTime());
      // Match if within 30 minutes
      if (timeDiff < 30 * 60 * 1000) {
        slot.isOccupied = true;
        slot.appointment = apt;
        matched = true;
        break;
      }
    }
    
    // If no match found, add as a standalone appointment
    if (!matched) {
      scheduleMap.set(aptDateTime.toISOString(), {
        dateTime: aptDateTime.toISOString(),
        isOccupied: true,
        appointment: apt,
      });
    }
  });

  // Second pass: Process ANNULLED/RESCHEDULED appointments, but only if slot doesn't have a scheduled appointment
  appointments.forEach((apt: Appointment) => {
    const aptDateTime = new Date(apt.scheduleDate);
    const isAnnulledOrRescheduled = apt.status === 'ANNULLED' || apt.status === 'RESCHEDULED';
    
    // Only process annulled/rescheduled in second pass
    if (!isAnnulledOrRescheduled) return;
    
    // Try to match with slots that are close in time (within 30 minutes)
    let matched = false;
    for (const [dateTime, slot] of scheduleMap.entries()) {
      const slotDateTime = new Date(dateTime);
      const timeDiff = Math.abs(aptDateTime.getTime() - slotDateTime.getTime());
      // Match if within 30 minutes
      if (timeDiff < 30 * 60 * 1000) {
        // Only add if slot doesn't already have an appointment (scheduled appointments take priority)
        if (!slot.appointment) {
          slot.isOccupied = false;
          slot.appointment = apt;
          slot.isEmptyDueToStatus = true;
          matched = true;
          break;
        }
        // If slot already has a scheduled appointment, skip this annulled/rescheduled one
        matched = true; // Mark as matched to skip standalone addition
        break;
      }
    }
    
    // If no match found, add as a standalone appointment
    if (!matched) {
      scheduleMap.set(aptDateTime.toISOString(), {
        dateTime: aptDateTime.toISOString(),
        isOccupied: false, // Empty if annulled/rescheduled
        appointment: apt,
        isEmptyDueToStatus: true,
      });
    }
  });

  // Sort by date
  return Array.from(scheduleMap.values()).sort(
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
 */
export function getNextDaysArray(count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: Date[] = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
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
 * Parse duration string (HH:MM:SS or HH:MM) to minutes.
 */
export function parseDurationToMinutes(duration: string): number {
  if (!duration) return 30; // Default 30 minutes
  const parts = duration.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
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

