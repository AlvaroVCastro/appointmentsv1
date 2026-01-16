"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Loader from '@/components/ui/loader';
import { useSchedule } from '@/hooks/use-schedule';
import { useReplacementPatients } from '@/hooks/use-replacement-patients';
import { SlotCard } from '@/components/appointments/slot-card';
import { ReplacementPatientsList } from '@/components/appointments/replacement-patients-list';
import { DayStrip } from '@/components/appointments/day-strip';
import { DoctorSelector } from '@/components/appointments/doctor-selector';
import type { DoctorSearchResult } from '@/lib/glintt-api';
import {
  getNextDaysArray,
  getSlotsForDate,
  hasEmptySlotsForDate,
  formatDateKey,
  mergeConsecutiveEmptySlots,
} from '@/lib/appointment-utils';

function AppointmentsPageContent() {
  const searchParams = useSearchParams();
  const {
    doctorCode,
    doctorName,
    loading,
    schedule,
    error,
    expandedSlots,
    loadSchedule,
    toggleSlotExpansion,
  } = useSchedule();

  const {
    selectedSlot,
    replacementCandidates,
    idealCandidates,
    allCandidates,
    hasMoreCandidates,
    showAllCandidates,
    toggleShowAllCandidates,
    loadingReplacements,
    error: replacementError,
    handleSlotClick,
    clearSelection,
  } = useReplacementPatients(doctorCode);

  // Day strip state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Generate 10 days array (stable reference)
  const tenDays = useMemo(() => getNextDaysArray(10), []);

  // Merge consecutive empty slots into groups
  // This is the key transformation: 3 consecutive 30-min empty slots become 1 x 90-min slot
  const mergedSchedule = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    return mergeConsecutiveEmptySlots(schedule);
  }, [schedule]);

  // Build set of date keys that have at least one empty slot
  const emptyDaysSet = useMemo(() => {
    if (mergedSchedule.length === 0) return new Set<string>();
    const set = new Set<string>();

    tenDays.forEach(day => {
      if (hasEmptySlotsForDate(mergedSchedule, day)) {
        set.add(formatDateKey(day));
      }
    });

    return set;
  }, [mergedSchedule, tenDays]);

  // Filter slots for the selected day (using merged schedule)
  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return mergedSchedule;
    return getSlotsForDate(mergedSchedule, selectedDate);
  }, [mergedSchedule, selectedDate]);

  // Auto-load doctor from URL params (e.g., after returning from confirmation page)
  useEffect(() => {
    const urlDoctorCode = searchParams.get('doctorCode');
    if (urlDoctorCode && !doctorCode && !loading) {
      loadSchedule(urlDoctorCode);
    }
  }, [searchParams, doctorCode, loading, loadSchedule]);

  // Auto-select the first day that has slots when schedule loads
  useEffect(() => {
    if (!loading && mergedSchedule.length > 0 && !selectedDate) {
      // Find the first day that has slots
      const firstDayWithSlots = tenDays.find(day => {
        return getSlotsForDate(mergedSchedule, day).length > 0;
      });
      setSelectedDate(firstDayWithSlots || tenDays[0]);
    }
  }, [loading, mergedSchedule.length, selectedDate, tenDays, mergedSchedule]);

  const handleToggleExpansion = (slotDateTime: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering handleSlotClick
    toggleSlotExpansion(slotDateTime);
  };

  // Handle doctor selection from dropdown
  const handleDoctorSelected = (doctor: DoctorSearchResult) => {
    const code = doctor.code || doctor.id;
    setSelectedDate(null); // Reset selected date for new doctor
    clearSelection();      // Clear replacement candidates when changing doctor
    loadSchedule(code);    // Pass the code directly to avoid stale closure
  };

  // Handle direct doctor code submission (Enter on numeric input)
  const handleDoctorCodeSubmit = (code: string) => {
    setSelectedDate(null); // Reset selected date for new doctor
    clearSelection();      // Clear replacement candidates when changing doctor
    loadSchedule(code);    // Pass the code directly to avoid stale closure
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
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

          {loading && <Loader message="Loading schedule..." className="min-h-[400px]" />}

          {!loading && !error && mergedSchedule.length === 0 && doctorCode && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-slate-500">
                  No schedule configuration found for this doctor in the selected period.
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && mergedSchedule.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-3 md:min-h-[700px]">
              {/* Left column: Schedule */}
              <Card className="flex flex-col min-w-0 overflow-hidden">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>Agenda (Próximos 10 Dias)</CardTitle>
                  <CardDescription>
                    Clique num slot livre para encontrar pacientes que podem antecipar
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0">
                  {/* Day strip above the slots list */}
                  <div className="mb-4 flex-shrink-0">
                    <DayStrip
                      days={tenDays}
                      selectedDate={selectedDate}
                      onSelect={setSelectedDate}
                      emptyDaysSet={emptyDaysSet}
                    />
                  </div>

                  {/* Slot list – filtered by selected day */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {slotsForSelectedDate.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">
                        No slots available for this day
                      </p>
                    ) : (
                      slotsForSelectedDate.map((slot, index) => (
                        <SlotCard
                          key={slot.dateTime}
                          slot={slot}
                          previousSlotDateTime={index > 0 ? slotsForSelectedDate[index - 1].dateTime : undefined}
                          isSelected={selectedSlot?.dateTime === slot.dateTime}
                          isExpanded={expandedSlots.has(slot.dateTime)}
                          onSelect={handleSlotClick}
                          onToggleExpand={handleToggleExpansion}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Right column: Replacement Candidates */}
              <Card className="flex flex-col md:sticky md:top-4 md:self-start md:h-[calc(100vh-100px)] overflow-hidden">
                <CardHeader className="flex-shrink-0 pb-3">
                  <CardTitle className="text-base">Sugestões de Antecipação</CardTitle>
                  <CardDescription className="text-xs">
                    {selectedSlot
                      ? `Marcações que podem ser antecipadas (ordenadas por proximidade)`
                      : 'Selecione um slot livre para ver potenciais antecipações'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 pt-0">
                  <ReplacementPatientsList
                    candidates={replacementCandidates}
                    loading={loadingReplacements}
                    hasSelection={!!selectedSlot}
                    error={replacementError}
                    selectedSlot={selectedSlot}
                    doctorCode={doctorCode}
                    idealCandidates={idealCandidates}
                    allCandidates={allCandidates}
                    hasMoreCandidates={hasMoreCandidates}
                    showAllCandidates={showAllCandidates}
                    onToggleShowAll={toggleShowAllCandidates}
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

function AppointmentsPageWrapper() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    }>
      <AppointmentsPageContent />
    </Suspense>
  );
}

export default AppointmentsPageWrapper;
