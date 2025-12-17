"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Clock, User, Phone, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Data structure for the empty slot (new suggested time)
 */
interface SlotData {
  dateTime: string;
  endDateTime?: string;
  durationMinutes?: number;
  doctorCode?: string;
  doctorName?: string;
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
        suggestedDatetime: slotData.dateTime,
        suggestedDurationMin: slotData.durationMinutes || 30,
        anticipationDays: candidateData.anticipationDays,
        impact,
        notes: null,
      };

      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to save suggestion');
      }

      toast({
        title: 'Sugestão confirmada',
        description: 'A marcação foi registada com sucesso.',
      });

      // Navigate back to appointments page with doctor code preserved
      router.push(`/appointments?doctorCode=${encodeURIComponent(doctorCode)}`);
    } catch (error) {
      console.error('Failed to save suggestion:', error);
      toast({
        title: 'Erro ao confirmar',
        description: 'Não foi possível registar a marcação. Tente novamente.',
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
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Back button */}
          <Button 
            variant="ghost" 
            onClick={() => router.push('/appointments')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar à Agenda
          </Button>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Confirmar Antecipação</h1>
            <p className="text-slate-500 mt-2">
              Confirme os detalhes antes de registar a marcação
            </p>
          </div>

          {/* Two cards side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Card: Empty Slot (New Time) */}
            <Card className="border-2 border-orange-300 bg-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-orange-800 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Novo Horário (Slot Livre)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-orange-600" />
                    <div>
                      <div className="text-sm text-slate-500">Data</div>
                      <div className="font-semibold text-slate-900">{slotFormatted.fullDate}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <div>
                      <div className="text-sm text-slate-500">Horário</div>
                      <div className="font-semibold text-slate-900">
                        {slotFormatted.time}
                        {endTime && ` – ${endTime}`}
                      </div>
                    </div>
                  </div>

                  {slotData.durationMinutes && (
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 flex items-center justify-center text-orange-600 font-bold text-sm">
                        ⏱
                      </div>
                      <div>
                        <div className="text-sm text-slate-500">Duração Disponível</div>
                        <div className="font-semibold text-slate-900">{slotData.durationMinutes} minutos</div>
                      </div>
                    </div>
                  )}

                  {/* Show appointment info if it exists (e.g., from cancelled appointment) */}
                  {slotData.appointment && (
                    <div className="pt-3 border-t border-orange-200">
                      <div className="text-xs text-orange-700 uppercase tracking-wide mb-2">
                        Informação do Slot
                      </div>
                      {slotData.appointment.patientName && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Paciente anterior:</span> {slotData.appointment.patientName}
                        </div>
                      )}
                      {slotData.appointment.serviceCode && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Serviço:</span> {slotData.appointment.serviceCode}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Card: Appointment to Move */}
            <Card className="border-2 border-slate-300 bg-slate-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-800 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Marcação a Antecipar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white rounded-lg p-4 space-y-3">
                  {/* Patient Name */}
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-slate-600" />
                    <div>
                      <div className="text-sm text-slate-500">Paciente</div>
                      <div className="font-semibold text-slate-900">
                        {candidateData.patientName || 'Paciente Desconhecido'}
                      </div>
                      <div className="text-xs text-slate-500">ID: {candidateData.patientId}</div>
                    </div>
                  </div>

                  {/* Current Date/Time */}
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-slate-600" />
                    <div>
                      <div className="text-sm text-slate-500">Data Atual</div>
                      <div className="font-semibold text-slate-900">{candidateFormatted.fullDate}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-slate-600" />
                    <div>
                      <div className="text-sm text-slate-500">Horário Atual</div>
                      <div className="font-semibold text-slate-900">{candidateFormatted.time}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 flex items-center justify-center text-slate-600 font-bold text-sm">
                      ⏱
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Duração</div>
                      <div className="font-semibold text-slate-900">{candidateData.currentDurationMinutes} minutos</div>
                    </div>
                  </div>

                  {/* Service/Medical Act info */}
                  {candidateData.appointments[0] && (
                    <div className="pt-3 border-t border-slate-200">
                      {candidateData.appointments[0].serviceCode && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Serviço:</span> {candidateData.appointments[0].serviceCode}
                        </div>
                      )}
                      {candidateData.appointments[0].medicalActCode && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Ato Médico:</span> {candidateData.appointments[0].medicalActCode}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contact Info */}
                  {(candidateData.phoneNumber1 || candidateData.phoneNumber2 || candidateData.email) && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <div className="text-xs text-slate-500 uppercase tracking-wide">Contactos</div>
                      {candidateData.phoneNumber1 && (
                        <a 
                          href={`tel:${candidateData.phoneNumber1}`}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Phone className="h-4 w-4" />
                          {candidateData.phoneNumber1}
                        </a>
                      )}
                      {candidateData.phoneNumber2 && (
                        <a 
                          href={`tel:${candidateData.phoneNumber2}`}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Phone className="h-4 w-4" />
                          {candidateData.phoneNumber2}
                        </a>
                      )}
                      {candidateData.email && (
                        <a 
                          href={`mailto:${candidateData.email}`}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Mail className="h-4 w-4" />
                          {candidateData.email}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Anticipation badge */}
                  <div className="pt-3 border-t border-slate-200">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
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
          <Card className="mt-8">
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Checkboxes */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id="lab-confirm" 
                      checked={labConfirmed}
                      onCheckedChange={(checked) => setLabConfirmed(checked === true)}
                    />
                    <Label 
                      htmlFor="lab-confirm" 
                      className="text-base font-medium cursor-pointer"
                    >
                      Confirmação do laboratório
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id="client-confirm" 
                      checked={clientConfirmed}
                      onCheckedChange={(checked) => setClientConfirmed(checked === true)}
                    />
                    <Label 
                      htmlFor="client-confirm" 
                      className="text-base font-medium cursor-pointer"
                    >
                      Confirmação do cliente
                    </Label>
                  </div>
                </div>

                {/* Confirm Button */}
                <Button
                  size="lg"
                  className={`w-full text-lg py-6 transition-all ${
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

                {!canConfirm && (
                  <p className="text-center text-sm text-slate-500">
                    Marque ambas as confirmações para prosseguir
                  </p>
                )}
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

