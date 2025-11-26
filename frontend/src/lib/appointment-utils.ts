import type { Slot, Appointment } from '@/lib/glintt-api';

export interface ScheduleSlot {
  dateTime: string;
  isOccupied: boolean;
  appointment?: Appointment;
  slot?: Slot;
  isRescheduled?: boolean;
  originalDate?: string;
  isEmptyDueToStatus?: boolean; // For ANNULLED or RESCHEDULED appointments
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

