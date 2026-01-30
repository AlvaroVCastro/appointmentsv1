"use client";

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Clock, Calendar, Users, ArrowRight, ChevronDown, ChevronUp, Star } from 'lucide-react';
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
  // New props for ideal vs all candidates
  idealCandidates?: ReplacementCandidate[];
  allCandidates?: ReplacementCandidate[];
  hasMoreCandidates?: boolean;
  showAllCandidates?: boolean;
  onToggleShowAll?: () => void;
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
 * Calculates the correct anticipation days: originalDate - slotDate (not today)
 */
function calculateAnticipationDays(originalDateTime: string, slotDateTime: string | undefined): number {
  if (!slotDateTime) return 0;
  const originalDate = new Date(originalDateTime);
  const slotDate = new Date(slotDateTime);
  const diffMs = originalDate.getTime() - slotDate.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

/**
 * Displays a list of replacement candidates for an empty slot.
 * Shows ideal candidates (top 3) by default, with option to view all.
 */
export function ReplacementPatientsList({
  candidates: _candidates, // Kept for backwards compat, use idealCandidates/allCandidates
  loading,
  hasSelection,
  error,
  selectedSlot,
  doctorCode,
  idealCandidates = [],
  allCandidates = [],
  hasMoreCandidates: _hasMoreCandidates = false, // Computed from allCandidates.length > idealCandidates.length
  showAllCandidates = false,
  onToggleShowAll,
}: ReplacementPatientsListProps) {
  const router = useRouter();

  // Determine which candidates to display
  const displayCandidates = showAllCandidates ? allCandidates : idealCandidates;
  const totalAllCandidates = allCandidates.length;

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
      // Required for reschedule - from ExternalSearchSlots raw slot data
      bookingId: selectedSlot.slot?.BookingID,
      duration: selectedSlot.slot?.Duration,
      // Include appointment info if exists (e.g., from cancelled slot)
      appointment: selectedSlot.appointment ? {
        patientName: selectedSlot.appointment.patientName,
        patientId: selectedSlot.appointment.patientId,
        serviceCode: selectedSlot.appointment.serviceCode,
        medicalActCode: selectedSlot.appointment.medicalActCode,
      } : undefined,
    };

    // Prepare candidate data for URL
    // Calculate correct anticipation: originalDate - slotDate (not today)
    const correctAnticipationDays = calculateAnticipationDays(
      candidate.currentAppointmentDateTime,
      selectedSlot?.dateTime
    );

    const candidateData = {
      blockId: candidate.blockId,
      patientId: candidate.patientId,
      patientName: candidate.patientName,
      phoneNumber1: candidate.phoneNumber1,
      phoneNumber2: candidate.phoneNumber2,
      email: candidate.email,
      currentAppointmentDateTime: candidate.currentAppointmentDateTime,
      currentDurationMinutes: candidate.currentDurationMinutes,
      anticipationDays: correctAnticipationDays,
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

  // Has selection - show candidates or empty state
  if (hasSelection) {
    // No ideal candidates but has all candidates
    if (idealCandidates.length === 0 && allCandidates.length > 0) {
      return (
        <div className="flex flex-col h-full">
          {/* No ideal recommendations message */}
          <div className="flex flex-col items-center justify-center py-8 px-4 border-b border-slate-100">
            <div className="text-slate-400 mb-2">
              <Star className="h-10 w-10 mx-auto opacity-50" />
            </div>
            <div className="text-slate-600 font-medium mb-1 text-center">
              Não há remarcações ideais
            </div>
            <div className="text-sm text-slate-500 text-center">
              Não encontrámos marcações no mesmo dia da semana/hora para as próximas 2 semanas.
            </div>
          </div>

          {/* Button to view other suggestions */}
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onToggleShowAll}
            >
              {showAllCandidates ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Ocultar outras sugestões
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Ver outras sugestões ({totalAllCandidates})
                </>
              )}
            </Button>
          </div>

          {/* Show all candidates when toggled */}
          {showAllCandidates && (
            <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 space-y-3">
              <CandidatesList
                candidates={allCandidates}
                onSelectCandidate={handleSelectCandidate}
                slotDateTime={selectedSlot?.dateTime}
              />
            </div>
          )}
        </div>
      );
    }

    // Has ideal candidates
    if (idealCandidates.length > 0) {
      return (
        <div className="flex flex-col h-full">
          {/* Header - ideal recommendations */}
          {!showAllCandidates && (
            <div className="pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Star className="h-4 w-4 text-amber-500" />
                Top {idealCandidates.length} Recomendações Ideais
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Baseadas no mesmo dia da semana e horário similar
              </div>
            </div>
          )}

          {/* Header - all recommendations */}
          {showAllCandidates && (
            <div className="pb-3 border-b border-slate-100 mb-3">
              <div className="text-sm font-medium text-slate-700">
                Todas as {totalAllCandidates} recomendações
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Ordenadas por proximidade (mais próximas primeiro)
              </div>
            </div>
          )}

          {/* Scrollable candidate list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
            <CandidatesList
              candidates={displayCandidates}
              onSelectCandidate={handleSelectCandidate}
              highlightIdeal={showAllCandidates}
              idealBlockIds={idealCandidates.map(c => c.blockId)}
              slotDateTime={selectedSlot?.dateTime}
            />
          </div>

          {/* Button to toggle view - always show if there are more candidates */}
          {totalAllCandidates > idealCandidates.length && (
            <div className="pt-3 mt-3 border-t border-slate-100">
              <Button
                variant="outline"
                className="w-full gap-2 text-sm"
                onClick={onToggleShowAll}
              >
                {showAllCandidates ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Ver apenas as ideais ({idealCandidates.length})
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Ver outras sugestões ({totalAllCandidates - idealCandidates.length})
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      );
    }

    // No candidates at all
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-slate-400 mb-3">
          <Users className="h-12 w-12 mx-auto opacity-50" />
        </div>
        <div className="text-slate-600 font-medium mb-1 text-center">
          Sem marcações elegíveis
        </div>
        <div className="text-sm text-slate-500 text-center">
          Não existem marcações após este slot (nos próximos 30 dias, com mínimo 48h) que caibam neste período.
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

/**
 * Renders the list of candidate cards.
 */
function CandidatesList({
  candidates,
  onSelectCandidate,
  highlightIdeal = false,
  idealBlockIds = [],
  slotDateTime,
}: {
  candidates: ReplacementCandidate[];
  onSelectCandidate: (candidate: ReplacementCandidate) => void;
  highlightIdeal?: boolean;
  idealBlockIds?: string[];
  slotDateTime?: string;
}) {
  return (
    <>
      {candidates.map((candidate) => {
        const { date, time } = formatAppointmentDateTime(candidate.currentAppointmentDateTime);
        const isBlock = candidate.slotCount > 1;
        const isIdeal = highlightIdeal && idealBlockIds.includes(candidate.blockId);
        // Calculate correct anticipation: originalDate - slotDate (not today)
        const anticipationDays = calculateAnticipationDays(candidate.currentAppointmentDateTime, slotDateTime);

        return (
          <div
            key={candidate.blockId}
            className={`p-4 border rounded-lg bg-white transition-all ${
              isIdeal
                ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            {/* Header: Patient name and badges */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {isIdeal && (
                    <Star className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="font-semibold text-slate-900 truncate">
                    {candidate.patientName || 'Paciente Desconhecido'}
                  </span>
                </div>
                <Badge variant="outline" className="mt-1 text-xs">
                  ID: {candidate.patientId}
                </Badge>
              </div>
              {isBlock && (
                <Badge className="bg-orange-100 text-orange-800 border-orange-200 ml-2 flex-shrink-0">
                  <Users className="h-3 w-3 mr-1" />
                  Slot ({candidate.slotCount})
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
                    anticipationDays <= 3
                      ? 'bg-green-100 text-green-800'
                      : anticipationDays <= 7
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Antecipação de {anticipationDays} dia{anticipationDays !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            {/* Block details (if multiple consecutive slots) */}
            {isBlock && (
              <div className="mb-3 text-xs">
                <div className="text-slate-500 mb-1">Marcações do slot ({candidate.slotCount} slots consecutivos):</div>
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
                onClick={() => onSelectCandidate(candidate)}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Selecionar para antecipação
              </Button>
            </div>
          </div>
        );
      })}
    </>
  );
}
