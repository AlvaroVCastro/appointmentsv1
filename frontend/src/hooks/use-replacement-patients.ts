import { useState } from 'react';
import type { ScheduleSlot } from '@/lib/appointment-utils';
import type { Appointment } from '@/lib/glintt-api';

interface Patient {
  id: string;
  name: string;
  contacts?: {
    phoneNumber1?: string;
    phoneNumber2?: string;
  };
}

export function useReplacementPatients(doctorCode: string) {
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [replacementPatients, setReplacementPatients] = useState<Array<Appointment & { patient?: Patient }>>([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReplacementPatients = async (slot: ScheduleSlot) => {
    // Need either a slot object or an appointment to get service/doctor info
    if (!slot.slot && !slot.appointment) return;

    setLoadingReplacements(true);
    setSelectedSlot(slot);
    setError(null);

    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Get service code and doctor code from slot or appointment
      const serviceCode = slot.slot?.ServiceCode || slot.appointment?.serviceCode;
      const slotDoctorCode = slot.slot?.HumanResourceCode || slot.appointment?.humanResourceCode || doctorCode;
      
      if (!serviceCode || !slotDoctorCode) {
        throw new Error('Missing service code or doctor code');
      }
      
      const response = await fetch(
        `/api/glintt/appointments?startDate=${today.toISOString().split('T')[0]}&endDate=${nextWeek.toISOString().split('T')[0]}&serviceCode=${serviceCode}&doctorCode=${slotDoctorCode}`
      );

      if (!response.ok) {
        throw new Error('Failed to load replacement appointments');
      }

      const data = await response.json();
      const appointments = (data.appointments || []).slice(0, 10); // Limit to 10

      // Load patient details for each appointment in parallel
      const patientsWithDetails = await Promise.all(
        appointments.map(async (apt: Appointment) => {
          try {
            const patientResponse = await fetch(`/api/glintt/patients/${apt.patientId}`);
            if (patientResponse.ok) {
              const patientData = await patientResponse.json();
              return { ...apt, patient: patientData.patient };
            }
          } catch (err) {
            console.error(`Failed to load patient ${apt.patientId}:`, err);
          }
          return apt;
        })
      );

      setReplacementPatients(patientsWithDetails);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load replacement patients';
      setError(errorMessage);
    } finally {
      setLoadingReplacements(false);
    }
  };

  const clearSelection = () => {
    setSelectedSlot(null);
    setReplacementPatients([]);
  };

  return {
    selectedSlot,
    replacementPatients,
    loadingReplacements,
    error,
    loadReplacementPatients,
    clearSelection,
  };
}

