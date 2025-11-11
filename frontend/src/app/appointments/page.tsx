"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Phone, User, Loader2 } from 'lucide-react';
import Loader from '@/components/ui/loader';
import type { Slot, Appointment as GlinttAppointment } from '@/lib/glintt-api';

// Use the Appointment type from glintt-api, but keep a local alias for clarity
type Appointment = GlinttAppointment;

interface Patient {
  id: string;
  name: string;
  contacts?: {
    phoneNumber1?: string;
    phoneNumber2?: string;
  };
}

interface ScheduleSlot {
  dateTime: string;
  isOccupied: boolean;
  appointment?: Appointment;
  slot?: Slot;
  isRescheduled?: boolean;
  originalDate?: string;
  isEmptyDueToStatus?: boolean; // For ANNULLED or RESCHEDULED appointments
}

export default function AppointmentsPage() {
  const [doctorCode, setDoctorCode] = useState('');
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [replacementPatients, setReplacementPatients] = useState<Array<Appointment & { patient?: Patient }>>([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNextDays = (days: number) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  };

  const loadSchedule = async () => {
    if (!doctorCode.trim()) {
      setError('Please enter a doctor code');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedSlot(null);
    setReplacementPatients([]);
    setDoctorName(null);

    try {
      // Load doctor name
      try {
        const hrResponse = await fetch(`/api/glintt/human-resources/${doctorCode}`);
        if (hrResponse.ok) {
          const hrData = await hrResponse.json();
          setDoctorName(hrData.humanResource?.HumanResourceName || null);
        }
      } catch (err) {
        console.error('Failed to load doctor name:', err);
        // Continue even if doctor name fails
      }

      const { startDate, endDate } = getNextDays(7);
      const response = await fetch(
        `/api/glintt/schedule?doctorCode=${encodeURIComponent(doctorCode)}&startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load schedule');
      }

      const data = await response.json();
      
      // Combine slots and appointments
      const scheduleMap = new Map<string, ScheduleSlot>();
      
      // Process slots
      (data.slots || []).forEach((slot: Slot) => {
        const dateTime = new Date(slot.SlotDateTime).toISOString();
        scheduleMap.set(dateTime, {
          dateTime,
          isOccupied: slot.Occupation,
          slot,
        });
      });

      // Process appointments
      (data.appointments || []).forEach((apt: Appointment) => {
        const aptDateTime = new Date(apt.scheduleDate);
        const isAnnulledOrRescheduled = apt.status === 'ANNULLED' || apt.status === 'RESCHEDULED';
        
        // Try to match with slots that are close in time (within 30 minutes)
        let matched = false;
        for (const [dateTime, slot] of scheduleMap.entries()) {
          const slotDateTime = new Date(dateTime);
          const timeDiff = Math.abs(aptDateTime.getTime() - slotDateTime.getTime());
          // Match if within 30 minutes
          if (timeDiff < 30 * 60 * 1000) {
            // If appointment is ANNULLED or RESCHEDULED, mark as empty slot with info
            if (isAnnulledOrRescheduled) {
              slot.isOccupied = false;
              slot.appointment = apt;
              slot.isEmptyDueToStatus = true;
            } else {
              slot.isOccupied = true;
              slot.appointment = apt;
            }
            matched = true;
            break;
          }
        }
        
        // If no match found, add as a standalone appointment
        if (!matched) {
          scheduleMap.set(aptDateTime.toISOString(), {
            dateTime: aptDateTime.toISOString(),
            isOccupied: !isAnnulledOrRescheduled, // Empty if annulled/rescheduled
            appointment: apt,
            isEmptyDueToStatus: isAnnulledOrRescheduled,
          });
        }
      });

      // Sort by date
      const sortedSchedule = Array.from(scheduleMap.values()).sort(
        (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
      );

      setSchedule(sortedSchedule);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load schedule';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadReplacementPatients = async (slot: ScheduleSlot) => {
    if (!slot.slot) return;

    setLoadingReplacements(true);
    setSelectedSlot(slot);

    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Get doctor code from the slot or the current doctor
      const slotDoctorCode = slot.slot.HumanResourceCode || doctorCode;
      
      const response = await fetch(
        `/api/glintt/appointments?startDate=${today.toISOString().split('T')[0]}&endDate=${nextWeek.toISOString().split('T')[0]}&serviceCode=${slot.slot.ServiceCode}&doctorCode=${slotDoctorCode}`
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

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
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
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {doctorName ? `Doctor: ${doctorName}` : 'Doctor Schedule Manager'}
            </CardTitle>
            <CardDescription>
              {doctorName 
                ? `View schedules and find replacement patients for empty slots`
                : 'View doctor schedules and find replacement patients for empty slots'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="doctorCode">Doctor Code</Label>
                <Input
                  id="doctorCode"
                  value={doctorCode}
                  onChange={(e) => setDoctorCode(e.target.value)}
                  placeholder="Enter doctor code"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      loadSchedule();
                    }
                  }}
                />
              </div>
              <Button onClick={loadSchedule} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load Schedule'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-800">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading && <Loader message="Loading schedule..." className="min-h-[400px]" />}

        {!loading && schedule.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Schedule (Next 7 Days)</CardTitle>
                <CardDescription>
                  Click on an empty slot to find replacement patients
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {schedule.map((slot, index) => {
                    const { date, time } = formatDateTime(slot.dateTime);
                    const isEmpty = !slot.isOccupied;
                    const isSelected = selectedSlot?.dateTime === slot.dateTime;
                    const isEmptyDueToStatus = slot.isEmptyDueToStatus && slot.appointment;

                    return (
                      <div
                        key={index}
                        onClick={() => isEmpty && loadReplacementPatients(slot)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isEmpty ? 'cursor-pointer' : 'cursor-not-allowed'
                        } ${
                          isEmpty
                            ? isSelected
                              ? 'border-cyan-500 bg-cyan-50'
                              : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            <div>
                              <div className="font-medium">{date}</div>
                              <div className="text-sm text-slate-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {time}
                              </div>
                            </div>
                          </div>
                          {isEmpty ? (
                            isEmptyDueToStatus ? (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                {slot.appointment?.status === 'ANNULLED' ? 'Annulled' : 'Rescheduled'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Empty
                              </Badge>
                            )
                          ) : slot.appointment ? (
                            <Badge className="bg-blue-100 text-blue-800">
                              <User className="h-3 w-3 mr-1" />
                              {slot.appointment.patientName || 'Appointment'}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Occupied</Badge>
                          )}
                        </div>
                        {slot.appointment && (
                          <div className={`mt-3 pt-3 border-t border-slate-200 space-y-2 rounded p-3 ${
                            isEmptyDueToStatus ? 'bg-yellow-50' : 'bg-blue-50'
                          }`}>
                            {isEmptyDueToStatus ? (
                              <>
                                <div className="text-sm font-semibold text-slate-800 mb-2">
                                  {slot.appointment.status === 'ANNULLED' ? 'Annulled Appointment' : 'Rescheduled Appointment'}
                                </div>
                                <div className="text-sm text-slate-700">
                                  <span className="font-medium">Patient:</span> {slot.appointment.patientName || 'N/A'}
                                </div>
                                <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                  <div>
                                    <span className="font-medium">ID:</span> {slot.appointment.patientId}
                                  </div>
                                  {slot.appointment.serviceCode && (
                                    <div>
                                      <span className="font-medium">Service:</span> {slot.appointment.serviceCode}
                                    </div>
                                  )}
                                  {slot.appointment.medicalActCode && (
                                    <div>
                                      <span className="font-medium">Act:</span> {slot.appointment.medicalActCode}
                                    </div>
                                  )}
                                </div>
                                {slot.appointment.observations && (
                                  <div className="text-xs text-slate-600 mt-2 italic">
                                    {slot.appointment.observations}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="text-sm font-semibold text-slate-800 mb-2">
                                  Appointment Details
                                </div>
                                <div className="text-sm text-slate-700">
                                  <span className="font-medium">Patient:</span> {slot.appointment.patientName || 'N/A'}
                                </div>
                                <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                  <div>
                                    <span className="font-medium">ID:</span> {slot.appointment.patientId}
                                  </div>
                                  {slot.appointment.serviceCode && (
                                    <div>
                                      <span className="font-medium">Service:</span> {slot.appointment.serviceCode}
                                    </div>
                                  )}
                                  {slot.appointment.medicalActCode && (
                                    <div>
                                      <span className="font-medium">Act:</span> {slot.appointment.medicalActCode}
                                    </div>
                                  )}
                                  {slot.appointment.duration && (
                                    <div>
                                      <span className="font-medium">Duration:</span> {slot.appointment.duration}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {isEmpty && slot.slot && !isEmptyDueToStatus && (
                          <div className="mt-2 text-xs text-slate-500">
                            {slot.slot.OccupationReason?.Description || 'Available slot'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Replacement Patients</CardTitle>
                <CardDescription>
                  {selectedSlot
                    ? 'Patients with future appointments of the same type'
                    : 'Select an empty slot to see potential replacements'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingReplacements ? (
                  <Loader message="Loading patients..." />
                ) : selectedSlot && replacementPatients.length > 0 ? (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {replacementPatients.map((apt) => {
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
                ) : selectedSlot && !loadingReplacements ? (
                  <div className="text-center py-8 text-slate-500">
                    No replacement patients found
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    Select an empty slot to view potential replacements
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

