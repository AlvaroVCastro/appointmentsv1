"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Calendar } from 'lucide-react';
import Link from 'next/link';
import Loader from '@/components/ui/loader';
import { useSchedule } from '@/hooks/use-schedule';
import { useReplacementPatients } from '@/hooks/use-replacement-patients';
import { DoctorSelector } from '@/components/appointments/doctor-selector';
import { ReplacementPatientsList } from '@/components/appointments/replacement-patients-list';
import type { DoctorSearchResult } from '@/lib/glintt-api';
import type { ScheduleSlot } from '@/lib/appointment-utils';
import {
  getNextDaysArray,
  mergeConsecutiveEmptySlots,
  isEmptySlot,
  formatDateKey,
} from '@/lib/appointment-utils';

function EmptySlotsInboxContent() {
  const searchParams = useSearchParams();
  const {
    doctorCode,
    doctorName,
    loading,
    schedule,
    error,
    loadSchedule,
  } = useSchedule();

  const {
    selectedSlot,
    replacementCandidates,
    loadingReplacements,
    error: replacementError,
    handleSlotClick,
    clearSelection,
  } = useReplacementPatients(doctorCode);

  // Auto-load doctor from URL params
  useEffect(() => {
    const urlDoctorCode = searchParams.get('doctorCode');
    if (urlDoctorCode && !doctorCode && !loading) {
      loadSchedule(urlDoctorCode);
    }
  }, [searchParams, doctorCode, loading, loadSchedule]);

  // Generate 10 days array
  const tenDays = useMemo(() => getNextDaysArray(10), []);

  // Merge consecutive empty slots and filter to only empty ones
  const emptySlots = useMemo(() => {
    console.log('[EmptySlots] schedule.length:', schedule?.length, 'loading:', loading, 'doctorCode:', doctorCode);
    if (!schedule || schedule.length === 0) return [];
    const merged = mergeConsecutiveEmptySlots(schedule);
    const filtered = merged.filter(slot => isEmptySlot(slot));
    console.log('[EmptySlots] merged:', merged.length, 'filtered (empty):', filtered.length);
    return filtered;
  }, [schedule, loading, doctorCode]);

  // Group empty slots by date
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, typeof emptySlots>();
    emptySlots.forEach(slot => {
      const dateKey = formatDateKey(slot.dateTime);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(slot);
    });
    return grouped;
  }, [emptySlots]);

  const handleDoctorSelected = (doctor: DoctorSearchResult) => {
    const code = doctor.code || doctor.id;
    clearSelection();
    loadSchedule(code);
  };

  const handleDoctorCodeSubmit = (code: string) => {
    clearSelection();
    loadSchedule(code);
  };

  const handleSlotSelect = (slot: ScheduleSlot) => {
    handleSlotClick(slot);
  };

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateKey: string) => {
    const date = new Date(dateKey);
    return date.toLocaleDateString('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/appointments">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Empty Slots Inbox</h1>
          </div>

          {/* Doctor Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-orange-700">
                <Calendar className="inline h-5 w-5 mr-2" />
                Select Doctor
              </CardTitle>
              <CardDescription>
                View all empty/available slots for a doctor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DoctorSelector
                onDoctorSelected={handleDoctorSelected}
                onDoctorCodeSubmit={handleDoctorCodeSubmit}
                initialValue={doctorCode}
              />
              {loading && (
                <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading schedule...
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-800">{error}</p>
              </CardContent>
            </Card>
          )}

          {loading && <Loader message="Loading empty slots..." className="min-h-[300px]" />}

          {!loading && !error && doctorCode && emptySlots.length === 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <p className="text-center text-orange-800">
                  No empty slots found for {doctorName || `doctor ${doctorCode}`} in the next 10 days.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Side-by-side layout: Empty Slots List + Suggestions */}
          {!loading && emptySlots.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 lg:min-h-[700px]">
              {/* Left column: Empty Slots */}
              <Card className="flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>
                    {emptySlots.length} Empty Slot{emptySlots.length !== 1 ? 's' : ''} Found
                  </CardTitle>
                  <CardDescription>
                    {doctorName 
                      ? `Clique num slot para ver sugestões de antecipação` 
                      : 'Click a slot to see anticipation suggestions'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto space-y-6">
                  {Array.from(slotsByDate.entries()).map(([dateKey, slots]) => (
                    <div key={dateKey}>
                      <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                        {formatDate(dateKey)}
                      </h3>
                      <div className="space-y-2">
                        {slots.map((slot) => {
                          const isSelected = selectedSlot?.dateTime === slot.dateTime;
                          const startTime = formatTime(slot.dateTime);
                          const endTime = slot.endDateTime ? formatTime(slot.endDateTime) : null;
                          const duration = slot.durationMinutes || 30;

                          return (
                            <div
                              key={slot.dateTime}
                              onClick={() => handleSlotSelect(slot)}
                              className={`
                                p-4 rounded-lg border-2 cursor-pointer transition-all
                                ${isSelected 
                                  ? 'border-orange-500 bg-orange-100 shadow-md' 
                                  : 'border-orange-200 bg-orange-50 hover:border-orange-300 hover:bg-orange-100'
                                }
                              `}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-lg font-semibold text-orange-800">
                                    {startTime}
                                    {endTime && ` – ${endTime}`}
                                  </span>
                                  <span className="ml-2 text-sm text-orange-600">
                                    ({duration} min)
                                  </span>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-200 text-orange-800">
                                  Available
                                </span>
                              </div>
                              {slot.isMergedGroup && (
                                <p className="text-xs text-orange-600 mt-1">
                                  {slot.mergedSlots?.length || 0} consecutive slots merged
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Right column: Replacement Candidates (Suggestions) */}
              <Card className="flex flex-col lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-120px)]">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>Sugestões de Antecipação</CardTitle>
                  <CardDescription>
                    {selectedSlot
                      ? `Marcações que podem ser antecipadas (ordenadas por proximidade)`
                      : 'Selecione um slot livre para ver potenciais antecipações'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ReplacementPatientsList
                    candidates={replacementCandidates}
                    loading={loadingReplacements}
                    hasSelection={!!selectedSlot}
                    error={replacementError}
                    selectedSlot={selectedSlot}
                    doctorCode={doctorCode}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmptySlotsInboxPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    }>
      <EmptySlotsInboxContent />
    </Suspense>
  );
}

