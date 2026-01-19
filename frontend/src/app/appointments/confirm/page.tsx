"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Clock, User, Phone, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

/**
 * Data structure for the empty slot (new suggested time)
 */
interface SlotData {
  dateTime: string;
  endDateTime?: string;
  durationMinutes?: number;
  doctorCode?: string;
  doctorName?: string;
  // Required for reschedule - from ExternalSearchSlots
  bookingId?: string;    // BookingID from the slot
  duration?: string;     // Duration from the slot (e.g., "2008-09-01T00:30:00")
  // If the empty slot has appointment info (e.g., from cancelled appointment)
  appointment?: {
    patientName?: string;
    patientId?: string;
    serviceCode?: string;
    medicalActCode?: string;
  };
}

/**
 * Data structure for the candidate (appointment to move)
 */
interface CandidateData {
  blockId: string;
  patientId: string;
  patientName?: string;
  phoneNumber1?: string;
  phoneNumber2?: string;
  email?: string;
  currentAppointmentDateTime: string;
  currentDurationMinutes: number;
  anticipationDays: number;
  appointments: Array<{
    appointmentId?: string;
    serviceCode?: string;
    medicalActCode?: string;
    durationMinutes?: number;
  }>;
}

/**
 * Formats a datetime string to readable format
 */
function formatDateTime(dateTimeStr: string): { date: string; time: string; fullDate: string } {
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
    fullDate: date.toLocaleDateString('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}

/**
 * Format time from ISO string to HH:MM format.
 */
function formatTime(dateTime: string): string {
  const date = new Date(dateTime);
  return date.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ConfirmPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Parse URL params
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [candidateData, setCandidateData] = useState<CandidateData | null>(null);
  const [doctorCode, setDoctorCode] = useState<string>('');

  // Checkbox states
  const [labConfirmed, setLabConfirmed] = useState(false);
  const [clientConfirmed, setClientConfirmed] = useState(false);

  // Loading state for saving
  const [saving, setSaving] = useState(false);

  // Parse data from URL on mount
  useEffect(() => {
    const slotParam = searchParams.get('slot');
    const candidateParam = searchParams.get('candidate');
    const doctorParam = searchParams.get('doctorCode');

    if (slotParam) {
      try {
        setSlotData(JSON.parse(decodeURIComponent(slotParam)));
      } catch (e) {
        console.error('Failed to parse slot data:', e);
      }
    }

    if (candidateParam) {
      try {
        setCandidateData(JSON.parse(decodeURIComponent(candidateParam)));
      } catch (e) {
        console.error('Failed to parse candidate data:', e);
      }
    }

    if (doctorParam) {
      setDoctorCode(doctorParam);
    }
  }, [searchParams]);

  // Both checkboxes must be checked to enable the button
  const canConfirm = labConfirmed && clientConfirmed;

  // Handle confirmation
  const handleConfirm = async () => {
    if (!slotData || !candidateData || !doctorCode) {
      toast({
        title: 'Erro',
        description: 'Dados insuficientes para confirmar a marcação.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      // ========== STEP 1: Execute reschedule in Glintt ==========
      console.log('[handleConfirm] Starting Glintt reschedule...');

      // Check for required slot data
      if (!slotData.bookingId || !slotData.duration) {
        console.error('[handleConfirm] Missing bookingId or duration from slot data');
        toast({
          title: 'Erro de dados',
          description: 'Dados do slot incompletos (bookingId ou duration em falta). Por favor, selecione novamente.',
          variant: 'destructive',
        });
        return;
      }

      const reschedulePayload = {
        appointments: candidateData.appointments.map(apt => ({
          appointmentId: apt.appointmentId,
          serviceCode: apt.serviceCode || candidateData.appointments[0]?.serviceCode || '36',
          medicalActCode: apt.medicalActCode || '1',
          durationMinutes: apt.durationMinutes || 30,
        })),
        patientId: candidateData.patientId,
        targetSlotDateTime: slotData.dateTime,
        targetBookingID: slotData.bookingId,
        targetDuration: slotData.duration,
        targetDoctorCode: doctorCode,
      };

      console.log('[handleConfirm] Reschedule payload:', JSON.stringify(reschedulePayload, null, 2));

      const rescheduleRes = await fetch('/api/glintt/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reschedulePayload),
      });

      const rescheduleData = await rescheduleRes.json();

      if (!rescheduleRes.ok || !rescheduleData.success) {
        console.error('[handleConfirm] Reschedule failed:', rescheduleData);
        toast({
          title: 'Erro no reagendamento',
          description: rescheduleData.error || 'Não foi possível reagendar no Glintt. Tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      console.log('[handleConfirm] Reschedule succeeded:', rescheduleData);

      // ========== STEP 2: Save reschedule record to database ==========
      console.log('[handleConfirm] Saving reschedule record to database...');

      // Get the current user's ID for created_by
      const supabase = createSupabaseBrowserClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Get data from the first appointment in the block
      const originalAppointment = candidateData.appointments[0];

      // Compute impact based on anticipation days
      const impact = candidateData.anticipationDays <= 3
        ? 'high'
        : candidateData.anticipationDays <= 7
        ? 'medium'
        : 'low';

      const payload = {
        doctorCode,
        patientId: candidateData.patientId,
        patientName: candidateData.patientName,
        originalDatetime: candidateData.currentAppointmentDateTime,
        originalDurationMin: candidateData.currentDurationMinutes,
        originalServiceCode: originalAppointment?.serviceCode,
        originalMedicalActCode: originalAppointment?.medicalActCode,
        newDatetime: slotData.dateTime,
        newDurationMin: slotData.durationMinutes || 30,
        anticipationDays: candidateData.anticipationDays,
        impact,
        notes: null,
        createdBy: currentUser?.id,  // Track who performed the reschedule
      };

      const res = await fetch('/api/reschedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Reschedule succeeded but saving record failed - log warning but don't block
        console.warn('[handleConfirm] Failed to save reschedule record to database, but Glintt reschedule was successful');
      } else {
        console.log('[handleConfirm] Reschedule record saved to database successfully');
      }

      toast({
        title: 'Reagendamento confirmado',
        description: 'A marcação foi reagendada com sucesso no Glintt.',
      });

      // Navigate back to appointments page with doctor code preserved
      router.push(`/appointments?doctorCode=${encodeURIComponent(doctorCode)}`);
    } catch (error) {
      console.error('[handleConfirm] Error:', error);
      toast({
        title: 'Erro ao confirmar',
        description: 'Não foi possível processar o reagendamento. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // If data isn't loaded yet or is invalid
  if (!slotData || !candidateData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-slate-500">
              Dados de confirmação não encontrados. Por favor, volte à página de agenda.
            </p>
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => router.push('/appointments')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar à Agenda
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const slotFormatted = formatDateTime(slotData.dateTime);
  const candidateFormatted = formatDateTime(candidateData.currentAppointmentDateTime);
  const endTime = slotData.endDateTime ? formatTime(slotData.endDateTime) : null;

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 p-3">
        <div className="max-w-5xl mx-auto space-y-2 h-full flex flex-col">
          {/* Back button + Header inline */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={() => router.push('/appointments')}
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <div className="text-center flex-1">
              <h1 className="text-lg font-bold text-slate-900">Confirmar Antecipação</h1>
            </div>
            <div className="w-20"></div> {/* Spacer for centering */}
          </div>

          {/* Two cards side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
            {/* Left Card: Empty Slot (New Time) */}
            <Card className="border-2 border-orange-300 bg-orange-50">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-orange-800 flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Novo Horário (Slot Livre)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-1.5 pt-0">
                <div className="bg-white rounded-lg px-2 py-1.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-600" />
                    <div>
                      <div className="text-xs text-slate-500">Data</div>
                      <div className="font-semibold text-sm text-slate-900">{slotFormatted.fullDate}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <div>
                      <div className="text-xs text-slate-500">Horário</div>
                      <div className="font-semibold text-sm text-slate-900">
                        {slotFormatted.time}
                        {endTime && ` – ${endTime}`}
                      </div>
                    </div>
                  </div>

                  {slotData.durationMinutes && (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 flex items-center justify-center text-orange-600 font-bold text-xs">
                        ⏱
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Duração</div>
                        <div className="font-semibold text-sm text-slate-900">{slotData.durationMinutes} min</div>
                      </div>
                    </div>
                  )}

                  {/* Show appointment info if it exists (e.g., from cancelled appointment) */}
                  {slotData.appointment && (
                    <div className="pt-1.5 border-t border-orange-200">
                      <div className="text-xs text-orange-700 uppercase tracking-wide mb-0.5">
                        Info do Slot
                      </div>
                      {slotData.appointment.patientName && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Anterior:</span> {slotData.appointment.patientName}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Card: Appointment to Move */}
            <Card className="border-2 border-slate-300 bg-slate-50">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-slate-800 flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  Marcação a Antecipar
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-1.5 pt-0">
                <div className="bg-white rounded-lg px-2 py-1.5 space-y-1">
                  {/* Patient Name */}
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-600" />
                    <div>
                      <div className="text-xs text-slate-500">Paciente</div>
                      <div className="font-semibold text-sm text-slate-900">
                        {candidateData.patientName || 'Paciente Desconhecido'}
                      </div>
                    </div>
                  </div>

                  {/* Current Date/Time - inline */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-600" />
                      <div>
                        <div className="text-xs text-slate-500">Data</div>
                        <div className="font-semibold text-sm text-slate-900">{candidateFormatted.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-600" />
                      <div>
                        <div className="text-xs text-slate-500">Hora</div>
                        <div className="font-semibold text-sm text-slate-900">{candidateFormatted.time}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 flex items-center justify-center text-slate-600 font-bold text-xs">
                        ⏱
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Duração</div>
                        <div className="font-semibold text-sm text-slate-900">{candidateData.currentDurationMinutes} min</div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info - inline */}
                  {(candidateData.phoneNumber1 || candidateData.email) && (
                    <div className="pt-1.5 border-t border-slate-200 flex flex-wrap gap-3">
                      {candidateData.phoneNumber1 && (
                        <a 
                          href={`tel:${candidateData.phoneNumber1}`}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <Phone className="h-3 w-3" />
                          {candidateData.phoneNumber1}
                        </a>
                      )}
                      {candidateData.email && (
                        <a 
                          href={`mailto:${candidateData.email}`}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <Mail className="h-3 w-3" />
                          {candidateData.email}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Anticipation badge */}
                  <div className="pt-1.5 border-t border-slate-200">
                    <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      candidateData.anticipationDays <= 3
                        ? 'bg-green-100 text-green-800'
                        : candidateData.anticipationDays <= 7
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      Antecipação de {candidateData.anticipationDays} dia{candidateData.anticipationDays !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Confirmation Section */}
          <Card className="mt-auto shrink-0">
            <CardContent className="py-2 px-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                {/* Checkboxes - horizontal on desktop */}
                <div className="flex flex-col md:flex-row gap-2 md:gap-5">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="lab-confirm" 
                      checked={labConfirmed}
                      onCheckedChange={(checked) => setLabConfirmed(checked === true)}
                    />
                    <Label 
                      htmlFor="lab-confirm" 
                      className="text-sm font-medium cursor-pointer"
                    >
                      Confirmo que o laboratório tem disponibilidade
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="client-confirm" 
                      checked={clientConfirmed}
                      onCheckedChange={(checked) => setClientConfirmed(checked === true)}
                    />
                    <Label 
                      htmlFor="client-confirm" 
                      className="text-sm font-medium cursor-pointer"
                    >
                      Confirmo que já contactei o cliente
                    </Label>
                  </div>
                </div>

                {/* Confirm Button */}
                <Button
                  size="lg"
                  className={`min-w-[180px] text-base py-4 transition-all ${
                    canConfirm 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                  disabled={!canConfirm || saving}
                  onClick={handleConfirm}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      A processar...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Fazer a marcação
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    }>
      <ConfirmPageContent />
    </Suspense>
  );
}

