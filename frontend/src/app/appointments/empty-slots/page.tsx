"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Calendar } from 'lucide-react';
import Link from 'next/link';
import Loader from '@/components/ui/loader';
import { useSchedule } from '@/hooks/use-schedule';
import { DoctorSelector } from '@/components/appointments/doctor-selector';
import type { DoctorSearchResult } from '@/lib/glintt-api';
import {
  getNextDaysArray,
  mergeConsecutiveEmptySlots,
  isEmptySlot,
  formatDateKey,
} from '@/lib/appointment-utils';

export default function EmptySlotsInboxPage() {
  const {
    doctorCode,
    doctorName,
    loading,
    schedule,
    error,
    loadSchedule,
  } = useSchedule();

  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  // Generate 10 days array
  const tenDays = useMemo(() => getNextDaysArray(10), []);

  // Merge consecutive empty slots and filter to only empty ones
  const emptySlots = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    const merged = mergeConsecutiveEmptySlots(schedule);
    return merged.filter(slot => isEmptySlot(slot));
  }, [schedule]);

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
    setSelectedSlotKey(null);
    loadSchedule(code);
  };

  const handleDoctorCodeSubmit = (code: string) => {
    setSelectedSlotKey(null);
    loadSchedule(code);
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
        <div className="max-w-4xl mx-auto space-y-6">
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

          {/* Empty Slots List */}
          {!loading && emptySlots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {emptySlots.length} Empty Slot{emptySlots.length !== 1 ? 's' : ''} Found
                </CardTitle>
                <CardDescription>
                  {doctorName ? `Available slots for ${doctorName}` : 'Click a slot to select it'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Array.from(slotsByDate.entries()).map(([dateKey, slots]) => (
                  <div key={dateKey}>
                    <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                      {formatDate(dateKey)}
                    </h3>
                    <div className="space-y-2">
                      {slots.map((slot) => {
                        const isSelected = selectedSlotKey === slot.dateTime;
                        const startTime = formatTime(slot.dateTime);
                        const endTime = slot.endDateTime ? formatTime(slot.endDateTime) : null;
                        const duration = slot.durationMinutes || 30;

                        return (
                          <div
                            key={slot.dateTime}
                            onClick={() => setSelectedSlotKey(isSelected ? null : slot.dateTime)}
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
          )}

          {/* Action Panel (when slot selected) */}
          {selectedSlotKey && (
            <Card className="border-orange-300 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-orange-800">Slot Selected</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-orange-700">
                  You selected the slot at {formatTime(selectedSlotKey)}
                </p>
                <div className="flex gap-2">
                  <Link href={`/appointments?doctorCode=${doctorCode}`}>
                    <Button variant="outline">
                      View Full Schedule
                    </Button>
                  </Link>
                  <Button 
                    variant="default" 
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => {
                      // For now, just show an alert - you can expand this later
                      alert(`Selected slot: ${selectedSlotKey}\nDoctor: ${doctorCode}`);
                    }}
                  >
                    Find Patients to Fill
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

