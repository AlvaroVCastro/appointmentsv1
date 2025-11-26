"use client";

import { Badge } from '@/components/ui/badge';
import { Phone } from 'lucide-react';
import { formatDateTime } from '@/lib/appointment-utils';
import type { Appointment } from '@/lib/glintt-api';
import Loader from '@/components/ui/loader';

interface Patient {
  id: string;
  name: string;
  contacts?: {
    phoneNumber1?: string;
    phoneNumber2?: string;
  };
}

interface ReplacementPatientsListProps {
  patients: Array<Appointment & { patient?: Patient }>;
  loading: boolean;
  hasSelection: boolean;
}

export function ReplacementPatientsList({
  patients,
  loading,
  hasSelection,
}: ReplacementPatientsListProps) {
  if (loading) {
    return <Loader message="Loading patients..." />;
  }

  if (hasSelection && patients.length > 0) {
    return (
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {patients.map((apt) => {
          const { date, time } = formatDateTime(apt.scheduleDate);
          return (
            <div
              key={apt.id}
              className="p-4 border border-slate-200 rounded-lg bg-white"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium">
                    {apt.patient?.name || apt.patientName || 'Unknown Patient'}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Current Appointment: {date} at {time}
                  </div>
                </div>
                <Badge variant="outline">ID: {apt.patientId}</Badge>
              </div>
              {apt.patient?.contacts && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {apt.patient.contacts.phoneNumber1 && (
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Phone className="h-3 w-3" />
                      {apt.patient.contacts.phoneNumber1}
                    </div>
                  )}
                  {apt.patient.contacts.phoneNumber2 && (
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Phone className="h-3 w-3" />
                      {apt.patient.contacts.phoneNumber2}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (hasSelection && !loading) {
    return (
      <div className="text-center py-8 text-slate-500">
        No replacement patients found
      </div>
    );
  }

  return (
    <div className="text-center py-8 text-slate-400">
      Select an empty slot to view potential replacements
    </div>
  );
}

