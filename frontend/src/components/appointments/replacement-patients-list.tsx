"use client";

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Clock, Calendar, Users, Save, Loader2 } from 'lucide-react';
import Loader from '@/components/ui/loader';
import type { ReplacementCandidate } from '@/hooks/use-replacement-patients';

interface ReplacementPatientsListProps {
  candidates: ReplacementCandidate[];
  loading: boolean;
  hasSelection: boolean;
  error?: string | null;
  onSaveSuggestion?: (candidate: ReplacementCandidate) => Promise<boolean>;
  savingCandidateId?: string | null;
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
  onSaveSuggestion,
  savingCandidateId,
}: ReplacementPatientsListProps) {
  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader message="Finding eligible patients..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-red-500 mb-2">Error loading candidates</div>
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
            Found {candidates.length} eligible patient{candidates.length !== 1 ? 's' : ''} to move
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Sorted by proximity (coming up sooner first)
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
                      {candidate.patientName || 'Unknown Patient'}
                    </div>
                    <Badge variant="outline" className="mt-1 text-xs">
                      ID: {candidate.patientId}
                    </Badge>
                  </div>
                  {isBlock && (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200 ml-2 flex-shrink-0">
                      <Users className="h-3 w-3 mr-1" />
                      Block ({candidate.appointments.length})
                    </Badge>
                  )}
                </div>

                {/* Current appointment info */}
                <div className="bg-slate-50 rounded-md p-3 mb-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                    Current Appointment
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
                      In {candidate.anticipationDays} day{candidate.anticipationDays !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>

                {/* Block details (if multiple appointments) */}
                {isBlock && (
                  <div className="mb-3 text-xs">
                    <div className="text-slate-500 mb-1">Block appointments:</div>
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

                {/* Save suggestion button */}
                {onSaveSuggestion && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={savingCandidateId === candidate.blockId}
                      onClick={() => onSaveSuggestion(candidate)}
                    >
                      {savingCandidateId === candidate.blockId ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          A guardar...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar sugestão
                        </>
                      )}
                    </Button>
                  </div>
                )}
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
          No eligible appointments found
        </div>
        <div className="text-sm text-slate-500 text-center">
          There are no appointments after this slot (in the next 30 days) that can fit into this time slot.
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
        Select an empty, rescheduled, or annulled slot to see potential replacement patients.
      </div>
    </div>
  );
}
