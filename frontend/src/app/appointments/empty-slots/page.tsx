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
import { formatFullDate, isEmptySlot, formatDateKey, parseDurationToMinutes, mergeConsecutiveEmptySlots } from '@/lib/appointment-utils';
import type { DoctorSearchResult } from '@/lib/glintt-api';
import type { ScheduleSlot } from '@/lib/appointment-utils';
import { Clock, Calendar, User, Loader2 } from 'lucide-react';
import React from 'react';

type FreeSlotSortOption = 'largest-gap' | 'soonest-date';

interface FreeSlotInboxItem {
  id: string;
  dateKey: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  previousGapMinutes: number;
  slot: ScheduleSlot;
}

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  doctorCode: string | null;
  doctorCodes: string[];
  isAdmin: boolean;
  isDoctor: boolean;
  hasMultipleDoctorCodes: boolean;
}

export default function EmptySlotsPage() {
  return (
    <Suspense fallback={<Loader message="A carregar..." className="min-h-[400px]" />}>
      <EmptySlotsContent />
    </Suspense>
  );
}

function EmptySlotsContent() {
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

  // User profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Load user profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/dashboard/profile');
        if (response.ok) {
          const data = await response.json();
          setProfile(data.profile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, []);

  // Auto-load doctor's schedule if they're a doctor (not admin) with single code
  useEffect(() => {
    if (!profileLoading && profile && !profile.isAdmin && !profile.hasMultipleDoctorCodes && profile.doctorCode && !doctorCode && !loading) {
      loadSchedule(profile.doctorCode);
    }
  }, [profileLoading, profile, doctorCode, loading, loadSchedule]);

  // Handle multi-code selection
  const handleMultiCodeSelection = (code: string) => {
    loadSchedule(code);
  };

  // Auto-load doctor from query params if provided (admin or matching user)
  useEffect(() => {
    if (initialDoctorCode && schedule.length === 0 && !loading && !profileLoading) {
      if (profile?.isAdmin || initialDoctorCode === profile?.doctorCode) {
        loadSchedule(initialDoctorCode);
      }
    }
  }, [initialDoctorCode, schedule.length, loading, loadSchedule, profileLoading, profile]);

  const {
    selectedSlot,
    idealCandidates,
    allCandidates,
    hasMoreCandidates,
    showAllCandidates,
    toggleShowAllCandidates,
    loadingReplacements,
    error: replacementError,
    handleSlotClick: handleSlotClickFromHook,
  } = useReplacementPatients(doctorCode);

  const [sortOption, setSortOption] = useState<FreeSlotSortOption>('largest-gap');

  // Merge consecutive empty slots first (same logic as Calendário)
  const mergedSchedule = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    return mergeConsecutiveEmptySlots(schedule);
  }, [schedule]);

  // Get free slots inbox items (now using merged slots)
  const freeSlotsItems = useMemo((): FreeSlotInboxItem[] => {
    if (!mergedSchedule || mergedSchedule.length === 0) return [];
    
    // Filter for empty slots (which are now merged/conciliated)
    const freeSlots = mergedSchedule.filter(slot => isEmptySlot(slot));
    
    const items: FreeSlotInboxItem[] = freeSlots.map((slot, index) => {
      const start = new Date(slot.dateTime);
      // Use the merged duration (already calculated by mergeConsecutiveEmptySlots)
      const durationMinutes = slot.durationMinutes ?? parseDurationToMinutes(slot.slot?.Duration || '00:30:00');
      const end = new Date(start.getTime() + durationMinutes * 60000);
      
      // Calculate gap from previous slot (useful for sorting by largest gap)
      let previousGapMinutes = durationMinutes;
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
  }, [mergedSchedule]);

  // Sort free slots
  const sortedFreeSlots = useMemo(() => {
    const sorted = [...freeSlotsItems];
    
    if (sortOption === 'largest-gap') {
      sorted.sort((a, b) => {
        if (b.previousGapMinutes !== a.previousGapMinutes) {
          return b.previousGapMinutes - a.previousGapMinutes;
        }
        return a.start.getTime() - b.start.getTime();
      });
    } else if (sortOption === 'soonest-date') {
      sorted.sort((a, b) => a.start.getTime() - b.start.getTime());
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
    handleSlotClickFromHook(item.slot);
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

  const isAdmin = profile?.isAdmin;
  const showDoctorSelector = isAdmin;
  const showMultiCodeSelector = !isAdmin && profile?.hasMultipleDoctorCodes && profile?.doctorCodes?.length > 1;

  // Show loading while profile is being fetched
  if (profileLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Show message if user is not a doctor and not an admin
  if (!isAdmin && !profile?.isDoctor) {
    return (
      <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <div className="text-center">
                <User className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Código de Médico Não Associado
                </h2>
                <p className="text-slate-500">
                  O seu perfil não tem um código de médico associado.
                  Contacte um administrador para associar o seu código.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {doctorName ? `Médico: ${doctorName}` : 'Slots Livres'}
                  </CardTitle>
                  <CardDescription>
                    {doctorName 
                      ? 'Ver todos os slots livres e encontrar pacientes para antecipar'
                      : isAdmin
                        ? 'Selecione um médico para ver os slots livres nos próximos 10 dias úteis'
                        : 'A carregar os seus slots livres...'
                    }
                  </CardDescription>
                </div>
                <Button asChild variant="outline">
                  <Link href="/appointments">Voltar à Agenda</Link>
                </Button>
              </div>
            </CardHeader>
            {showDoctorSelector && (
              <CardContent>
                <DoctorSelector
                  onDoctorSelected={handleDoctorSelected}
                  onDoctorCodeSubmit={handleDoctorCodeSubmit}
                  initialValue={initialDoctorName || initialDoctorCode || doctorCode}
                />
              </CardContent>
            )}
            {showMultiCodeSelector && (
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">Selecione o médico:</span>
                  <Select value={doctorCode || ''} onValueChange={handleMultiCodeSelection}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Escolha um médico" />
                    </SelectTrigger>
                    <SelectContent>
                      {profile?.doctorCodes?.map((code) => (
                        <SelectItem key={code} value={code}>
                          Código {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            )}
          </Card>

          {(error || replacementError) && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-800">{error || replacementError}</p>
              </CardContent>
            </Card>
          )}

          {loading && <Loader message="A carregar agenda..." className="min-h-[400px]" />}

          {!loading && schedule.length > 0 && (
            <div className={`grid gap-6 ${selectedSlot ? 'grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]' : 'grid-cols-1'}`}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Slots Livres</CardTitle>
                      <CardDescription>
                        {sortedFreeSlots.length} slot{sortedFreeSlots.length !== 1 ? 's' : ''} livre{sortedFreeSlots.length !== 1 ? 's' : ''} encontrado{sortedFreeSlots.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sort-option" className="text-sm">Ordenar por:</Label>
                      <Select value={sortOption} onValueChange={(value) => setSortOption(value as FreeSlotSortOption)}>
                        <SelectTrigger id="sort-option" className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="largest-gap">Maior intervalo</SelectItem>
                          <SelectItem value="soonest-date">Mais próximo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {sortedFreeSlots.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        Nenhum slot livre encontrado nos próximos 10 dias úteis
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
                                    {item.durationMinutes} min – livre
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                  <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                  <span>{formatFullDate(item.start.toISOString())}</span>
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <div className="text-sm font-medium text-slate-700">
                                  Gap: {formatGap(item.durationMinutes)}
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
                    <CardTitle>Pacientes para Antecipação</CardTitle>
                    <CardDescription>
                      Pacientes com marcações futuras do mesmo tipo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ReplacementPatientsList
                      candidates={showAllCandidates ? allCandidates : idealCandidates}
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
