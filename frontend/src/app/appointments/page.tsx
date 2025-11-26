"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import Loader from '@/components/ui/loader';
import { useSchedule } from '@/hooks/use-schedule';
import { useReplacementPatients } from '@/hooks/use-replacement-patients';
import { SlotCard } from '@/components/appointments/slot-card';
import { ReplacementPatientsList } from '@/components/appointments/replacement-patients-list';

export default function AppointmentsPage() {
  const {
    doctorCode,
    setDoctorCode,
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
    replacementPatients,
    loadingReplacements,
    error: replacementError,
    loadReplacementPatients,
  } = useReplacementPatients(doctorCode);

  const handleToggleExpansion = (slotDateTime: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering loadReplacementPatients
    toggleSlotExpansion(slotDateTime);
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

          {(error || replacementError) && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-800">{error || replacementError}</p>
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
                    Click on an empty - Rescheduled or Anulled slot to find replacement patients
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto relative">
                    {schedule.map((slot, index) => (
                      <SlotCard
                        key={slot.dateTime}
                        slot={slot}
                        previousSlotDateTime={index > 0 ? schedule[index - 1].dateTime : undefined}
                        isSelected={selectedSlot?.dateTime === slot.dateTime}
                        isExpanded={expandedSlots.has(slot.dateTime)}
                        onSelect={loadReplacementPatients}
                        onToggleExpand={handleToggleExpansion}
                      />
                    ))}
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
                  <ReplacementPatientsList
                    patients={replacementPatients}
                    loading={loadingReplacements}
                    hasSelection={!!selectedSlot}
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
