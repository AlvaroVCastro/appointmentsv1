import { useState } from 'react';
import type { ScheduleSlot } from '@/lib/appointment-utils';
import { getNextDays, processScheduleData } from '@/lib/appointment-utils';
import type { MergedSlot, Appointment } from '@/lib/glintt-api';

export function useSchedule() {
  const [doctorCode, setDoctorCode] = useState('');
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());

  const loadSchedule = async (codeOverride?: string) => {
    const codeToUse = codeOverride ?? doctorCode;

    if (!codeToUse.trim()) {
      setError('Please enter a doctor code');
      return;
    }

    // If using override, also update the state
    if (codeOverride) {
      setDoctorCode(codeOverride);
    }

    setLoading(true);
    setError(null);
    setDoctorName(null);
    setExpandedSlots(new Set()); // Reset expanded slots when loading new schedule

    try {
      // Load doctor name
      try {
        const hrResponse = await fetch(`/api/glintt/human-resources/${codeToUse}`);
        if (hrResponse.ok) {
          const hrData = await hrResponse.json();
          setDoctorName(hrData.humanResource?.HumanResourceName || null);
        }
      } catch (err) {
        console.error('Failed to load doctor name:', err);
        // Continue even if doctor name fails
      }

      const { startDate, endDate } = getNextDays(8);
      const response = await fetch(
        `/api/glintt/schedule?doctorCode=${encodeURIComponent(codeToUse)}&startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load schedule');
      }

      const data = await response.json();
      const processedSchedule = processScheduleData(
        (data.slots || []) as MergedSlot[],
        (data.appointments || []) as Appointment[]
      );

      setSchedule(processedSchedule);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load schedule';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleSlotExpansion = (slotDateTime: string) => {
    setExpandedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slotDateTime)) {
        newSet.delete(slotDateTime);
      } else {
        newSet.add(slotDateTime);
      }
      return newSet;
    });
  };

  return {
    doctorCode,
    setDoctorCode,
    doctorName,
    loading,
    schedule,
    error,
    expandedSlots,
    loadSchedule,
    toggleSlotExpansion,
  };
}

