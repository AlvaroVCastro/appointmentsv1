"use client";

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Clock, Calendar, Users, ArrowRight } from 'lucide-react';
import Loader from '@/components/ui/loader';
import type { ReplacementCandidate } from '@/hooks/use-replacement-patients';
import type { ScheduleSlot } from '@/lib/appointment-utils';

interface ReplacementPatientsListProps {
  candidates: ReplacementCandidate[];
  loading: boolean;
  hasSelection: boolean;
  error?: string | null;
  selectedSlot?: ScheduleSlot | null;
  doctorCode?: string;
}

/**
 * Formats a datetime string to a readable format.
 */
function formatAppointmentDateTime(dateTimeStr: string): { date: string; time: string } {
  const date = new Date(dateTimeStr);
  return {
    date: date.toLocaleDateString('pt-PT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }),
    time: date.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

/**
 * Displays a list of replacement candidates for an empty slot.
 * Shows conciliated blocks with patient details, current appointment info,
 * and contact information.
 * 
 * Layout: Full height flex container with scrollable candidate list.
 */
export function ReplacementPatientsList({
  candidates,
  loading,
  hasSelection,
  error,
  selectedSlot,
  doctorCode,
}: ReplacementPatientsListProps) {
  const router = useRouter();

  /**
   * Navigate to confirmation page with slot and candidate data
   */
  const handleSelectCandidate = (candidate: ReplacementCandidate) => {
    if (!selectedSlot || !doctorCode) return;

    // Prepare slot data for URL
    const slotData = {
      dateTime: selectedSlot.dateTime,
      endDateTime: selectedSlot.endDateTime,
      durationMinutes: selectedSlot.durationMinutes,
      doctorCode: doctorCode,
      // Include appointment info if exists (e.g., from cancelled slot)
      appointment: selectedSlot.appointment ? {
        patientName: selectedSlot.appointment.patientName,
        patientId: selectedSlot.appointment.patientId,
        serviceCode: selectedSlot.appointment.serviceCode,
        medicalActCode: selectedSlot.appointment.medicalActCode,
      } : undefined,
    };

    // Prepare candidate data for URL
    const candidateData = {
      blockId: candidate.blockId,
      patientId: candidate.patientId,
      patientName: candidate.patientName,
      phoneNumber1: candidate.phoneNumber1,
      phoneNumber2: candidate.phoneNumber2,
      email: candidate.email,
      currentAppointmentDateTime: candidate.currentAppointmentDateTime,
      currentDurationMinutes: candidate.currentDurationMinutes,
      anticipationDays: candidate.anticipationDays,
      appointments: candidate.appointments.map(apt => ({
        appointmentId: apt.appointmentId,
        serviceCode: apt.serviceCode,
        medicalActCode: apt.medicalActCode,
        durationMinutes: apt.durationMinutes,
      })),
    };

    // Build URL with encoded data
    const params = new URLSearchParams({
      slot: encodeURIComponent(JSON.stringify(slotData)),
      candidate: encodeURIComponent(JSON.stringify(candidateData)),
      doctorCode: doctorCode,
    });

    router.push(`/appointments/confirm?${params.toString()}`);
  };
  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader message="A procurar pacientes elegíveis..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-red-500 mb-2">Erro ao carregar sugestões</div>
        <div className="text-sm text-slate-500 text-center">{error}</div>
      </div>
    );
  }

  // Candidates found - show scrollable list
  if (hasSelection && candidates.length > 0) {
    return (
      <div>
        {/* Header - fixed at top */}
        <div className="pb-3 border-b border-slate-100 mb-3">
          <div className="text-sm font-medium text-slate-700">
            {candidates.length} paciente{candidates.length !== 1 ? 's' : ''} elegível{candidates.length !== 1 ? 'eis' : ''} para antecipar
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Ordenados por proximidade (mais próximos primeiro)
          </div>
        </div>
        
        {/* Scrollable candidate list - explicit max-height for scroll */}
        <div className="max-h-[calc(100vh-350px)] overflow-y-auto space-y-3 pr-1">
          {candidates.map((candidate) => {
            const { date, time } = formatAppointmentDateTime(candidate.currentAppointmentDateTime);
            const isBlock = candidate.appointments.length > 1;
            
            return (
              <div
                key={candidate.blockId}
                className="p-4 border border-slate-200 rounded-lg bg-white hover:border-slate-300 hover:shadow-sm transition-all"
              >
                {/* Header: Patient name and ID */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {candidate.patientName || 'Paciente Desconhecido'}
                    </div>
                    <Badge variant="outline" className="mt-1 text-xs">
                      ID: {candidate.patientId}
                    </Badge>
                  </div>
                  {isBlock && (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200 ml-2 flex-shrink-0">
                      <Users className="h-3 w-3 mr-1" />
                      Bloco ({candidate.appointments.length})
                    </Badge>
                  )}
                </div>

                {/* Current appointment info */}
                <div className="bg-slate-50 rounded-md p-3 mb-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                    Marcação Atual
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{date}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>{time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="text-slate-400">|</span>
                      <span>{candidate.currentDurationMinutes} min</span>
                    </div>
                  </div>
                  
                  {/* Anticipation badge */}
                  <div className="mt-2">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        candidate.anticipationDays <= 3 
                          ? 'bg-green-100 text-green-800' 
                          : candidate.anticipationDays <= 7 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Em {candidate.anticipationDays} dia{candidate.anticipationDays !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>

                {/* Block details (if multiple appointments) */}
                {isBlock && (
                  <div className="mb-3 text-xs">
                    <div className="text-slate-500 mb-1">Marcações do bloco:</div>
                    <div className="space-y-1">
                      {candidate.appointments.map((apt, idx) => {
                        const aptTime = formatAppointmentDateTime(apt.startDateTime);
                        return (
                          <div key={apt.appointmentId || idx} className="flex items-center gap-2 text-slate-600">
                            <span className="text-slate-400">{idx + 1}.</span>
                            <span>{aptTime.time}</span>
                            <span className="text-slate-400">({apt.durationMinutes}min)</span>
                            {apt.serviceCode && (
                              <span className="text-slate-400">• Service {apt.serviceCode}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Contact information */}
                {(candidate.phoneNumber1 || candidate.phoneNumber2 || candidate.email) && (
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                    {candidate.phoneNumber1 && (
                      <a 
                        href={`tel:${candidate.phoneNumber1}`}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {candidate.phoneNumber1}
                      </a>
                    )}
                    {candidate.phoneNumber2 && (
                      <a 
                        href={`tel:${candidate.phoneNumber2}`}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {candidate.phoneNumber2}
                      </a>
                    )}
                    {candidate.email && (
                      <a 
                        href={`mailto:${candidate.email}`}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {candidate.email}
                      </a>
                    )}
                  </div>
                )}

                {/* Navigate to confirmation button */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 hover:border-orange-400"
                    onClick={() => handleSelectCandidate(candidate)}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Selecionar para antecipação
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Has selection but no candidates found
  if (hasSelection && candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-slate-400 mb-3">
          <Users className="h-12 w-12 mx-auto opacity-50" />
        </div>
        <div className="text-slate-600 font-medium mb-1 text-center">
          Sem marcações elegíveis
        </div>
        <div className="text-sm text-slate-500 text-center">
          Não existem marcações após este slot (nos próximos 30 dias) que caibam neste período.
        </div>
      </div>
    );
  }

  // No selection - neutral state
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-slate-300 mb-3">
        <Calendar className="h-12 w-12 mx-auto" />
      </div>
      <div className="text-slate-500 text-center">
        Selecione um slot livre para ver potenciais antecipações.
      </div>
    </div>
  );
}
