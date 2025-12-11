"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Loader from '@/components/ui/loader';
import { useSchedule } from '@/hooks/use-schedule';
import { useReplacementPatients } from '@/hooks/use-replacement-patients';
import { ReplacementPatientsList } from '@/components/appointments/replacement-patients-list';
import { DoctorSelector } from '@/components/appointments/doctor-selector';
import { formatFullDate, isEmptySlot, formatDateKey, parseDurationToMinutes } from '@/lib/appointment-utils';
import type { DoctorSearchResult } from '@/lib/glintt-api';
import type { ScheduleSlot } from '@/lib/appointment-utils';
import { Clock, Calendar } from 'lucide-react';
import React from 'react';

type FreeSlotSortOption = 'largest-gap' | 'soonest-date';

// Local type for free slot inbox items (demo purposes)
interface FreeSlotInboxItem {
  id: string;
  dateKey: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  previousGapMinutes: number;
  slot: ScheduleSlot;
}

// Main page component with Suspense wrapper for useSearchParams
export default function FreeSlotsPage() {
  return (
    <Suspense fallback={<Loader message="Loading..." className="min-h-[400px]" />}>
      <FreeSlotsContent />
    </Suspense>
  );
}

// Inner content component that uses useSearchParams
function FreeSlotsContent() {
  const searchParams = useSearchParams();
  const initialDoctorCode = searchParams.get('doctorCode');
  const initialDoctorName = searchParams.get('doctorName');

  const {
    doctorCode,
    doctorName,
    loading,
    schedule,
    error,
    loadSchedule,
  } = useSchedule();

  // Auto-load doctor from query params if provided
  useEffect(() => {
    if (initialDoctorCode && schedule.length === 0 && !loading) {
      loadSchedule(initialDoctorCode);
    }
  }, [initialDoctorCode, schedule.length, loading, loadSchedule]);

  const {
    selectedSlot,
    replacementCandidates,
    loadingReplacements,
    error: replacementError,
    loadReplacementPatients,
  } = useReplacementPatients(doctorCode);

  const [sortOption, setSortOption] = useState<FreeSlotSortOption>('largest-gap');

  // Get free slots inbox items - inline computation for demo
  const freeSlotsItems = useMemo((): FreeSlotInboxItem[] => {
    if (!schedule || schedule.length === 0) return [];
    
    // Filter to get empty slots (including annulled/rescheduled)
    const freeSlots = schedule.filter(slot => isEmptySlot(slot));
    
    // Map to inbox items
    const items: FreeSlotInboxItem[] = freeSlots.map((slot, index) => {
      const start = new Date(slot.dateTime);
      const durationMinutes = slot.durationMinutes ?? parseDurationToMinutes(slot.slot?.Duration || '00:30:00');
      const end = new Date(start.getTime() + durationMinutes * 60000);
      
      // Calculate gap from previous slot (simplified - just use slot index difference * 30 min as rough estimate)
      // For a real implementation, we'd calculate actual time gaps
      let previousGapMinutes = durationMinutes; // Default to slot duration as "gap"
      if (index > 0) {
        const prevSlot = freeSlots[index - 1];
        const prevEnd = new Date(prevSlot.dateTime).getTime() + (prevSlot.durationMinutes ?? 30) * 60000;
        const gap = (start.getTime() - prevEnd) / 60000;
        previousGapMinutes = Math.max(0, gap);
      }
      
      return {
        id: slot.dateTime,
        dateKey: formatDateKey(start),
        start,
        end,
        durationMinutes,
        previousGapMinutes,
        slot,
      };
    });
    
    return items;
  }, [schedule]);

  // Sort free slots based on selected option
  const sortedFreeSlots = useMemo(() => {
    const sorted = [...freeSlotsItems];
    
    if (sortOption === 'largest-gap') {
      sorted.sort((a, b) => {
        // Sort descending by previousGapMinutes
        if (b.previousGapMinutes !== a.previousGapMinutes) {
          return b.previousGapMinutes - a.previousGapMinutes;
        }
        // Tie-breaker: earlier date/time first
        return a.start.getTime() - b.start.getTime();
      });
    } else if (sortOption === 'soonest-date') {
      sorted.sort((a, b) => {
        // Sort ascending by date, then time
        return a.start.getTime() - b.start.getTime();
      });
    }
    
    return sorted;
  }, [freeSlotsItems, sortOption]);

  const handleDoctorSelected = (doctor: DoctorSearchResult) => {
    const code = doctor.code || doctor.id;
    loadSchedule(code);
  };

  const handleDoctorCodeSubmit = (code: string) => {
    loadSchedule(code);
  };

  const handleSlotClick = (item: FreeSlotInboxItem) => {
    loadReplacementPatients(item.slot);
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatGap = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {doctorName ? `Doctor: ${doctorName}` : 'Free Slots Inbox'}
                  </CardTitle>
                  <CardDescription>
                    {doctorName 
                      ? `View all free slots and find replacement patients`
                      : 'Select a doctor to view free slots in the next 10 working days'
                    }
                  </CardDescription>
                </div>
                <Button asChild variant="outline">
                  <Link href="/appointments">Back to Schedule</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DoctorSelector
                onDoctorSelected={handleDoctorSelected}
                onDoctorCodeSubmit={handleDoctorCodeSubmit}
                initialValue={initialDoctorName || initialDoctorCode || doctorCode}
              />
            </CardContent>
          </Card>

          {(error || replacementError) && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-800">{error || replacementError}</p>
              </CardContent>
            </Card>
          )}

          {loading && <Loader message="Loading schedule..." className="min-h-[400px]" />}

          {!loading && schedule.length > 0 && (
            <div className={`grid gap-6 ${selectedSlot ? 'grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]' : 'grid-cols-1'}`}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Free Slots</CardTitle>
                      <CardDescription>
                        {sortedFreeSlots.length} free slot{sortedFreeSlots.length !== 1 ? 's' : ''} found
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sort-option" className="text-sm">Sort by:</Label>
                      <Select value={sortOption} onValueChange={(value) => setSortOption(value as FreeSlotSortOption)}>
                        <SelectTrigger id="sort-option" className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="largest-gap">Largest gap</SelectItem>
                          <SelectItem value="soonest-date">Soonest in date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {sortedFreeSlots.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No free slots found in the next 10 working days
                      </div>
                    ) : (
                      sortedFreeSlots.map((item) => {
                        const isSelected = selectedSlot?.dateTime === item.slot.dateTime;
                        return (
                          <div
                            key={`${item.dateKey}-${item.start.getTime()}`}
                            onClick={() => handleSlotClick(item)}
                            className={`
                              p-4 rounded-lg border-2 transition-all cursor-pointer
                              ${isSelected
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/50'
                              }
                            `}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <Clock className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                  <div className="font-semibold text-lg text-slate-900">
                                    {formatTime(item.start)} – {formatTime(item.end)}
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    {item.durationMinutes} min – free
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                  <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                  <span>{formatFullDate(item.start.toISOString())}</span>
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <div className="text-sm font-medium text-slate-700">
                                  Gap: {formatGap(item.previousGapMinutes)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {selectedSlot && (
                <Card>
                  <CardHeader>
                    <CardTitle>Replacement Patients</CardTitle>
                    <CardDescription>
                      Patients with future appointments of the same type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ReplacementPatientsList
                      candidates={replacementCandidates}
                      loading={loadingReplacements}
                      hasSelection={!!selectedSlot}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

