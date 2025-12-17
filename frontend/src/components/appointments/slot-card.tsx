"use client";

import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, ChevronDown, ChevronUp } from 'lucide-react';
import type { ScheduleSlot } from '@/lib/appointment-utils';
import { formatDateTime, formatFullDate } from '@/lib/appointment-utils';

interface SlotCardProps {
  slot: ScheduleSlot;
  previousSlotDateTime?: string;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (slot: ScheduleSlot) => void;
  onToggleExpand: (slotDateTime: string, event: React.MouseEvent) => void;
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

export function SlotCard({
  slot,
  previousSlotDateTime,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}: SlotCardProps) {
  const { date, time } = formatDateTime(slot.dateTime);
  const isEmpty = !slot.isOccupied;
  const hasAppointment = slot.appointment && slot.isOccupied;
  // Show details when expanded (for occupied slots only)
  const shouldShowDetails = isExpanded && hasAppointment;
  
  // For merged empty slots, show time range and total duration
  const isMergedGroup = slot.isMergedGroup && slot.mergedSlots && slot.mergedSlots.length > 1;
  const endTime = slot.endDateTime ? formatTime(slot.endDateTime) : null;
  const durationMinutes = slot.durationMinutes || 30;
  
  // Get the date string for comparison (without time)
  const currentDate = new Date(slot.dateTime).toDateString();
  const previousDate = previousSlotDateTime 
    ? new Date(previousSlotDateTime).toDateString()
    : null;
  const isNewDay = currentDate !== previousDate;
  
  // Format full date for separator
  const daySeparatorText = formatFullDate(slot.dateTime);

  return (
    <Fragment>
      {/* Day Separator - Direct child of scrollable container */}
      {isNewDay && (
        <div className="sticky top-0 z-10 bg-slate-50 py-2 mb-2 -mx-2 px-2 border-b-2 border-slate-300 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700 uppercase">
              {daySeparatorText}
            </span>
          </div>
        </div>
      )}
      
      {/* Slot Card - Direct child of scrollable container */}
      <div
        onClick={() => {
          if (isEmpty) {
            onSelect(slot);
          }
        }}
        className={`rounded-lg border-2 transition-all ${
          isEmpty ? 'cursor-pointer' : 'cursor-default'
        } ${
          isEmpty
            ? isSelected
              ? 'border-orange-500 bg-orange-50'
              : 'border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100'
            : 'border-slate-200 bg-slate-50'
        }`}
      >
        {/* Compact Header */}
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Clock className={`h-4 w-4 flex-shrink-0 ${
              hasAppointment ? 'text-slate-400' : 
              isEmpty ? 'text-orange-600' : 
              'text-slate-500'
            }`} />
            <div className="flex items-baseline gap-2 min-w-0">
              <div className="flex items-baseline gap-2">
                {/* Time display - show range for empty slots */}
                {isEmpty && endTime ? (
                  <div className={`text-lg font-semibold ${
                    isEmpty ? 'text-orange-700' : 'text-slate-900'
                  }`}>
                    {time} – {endTime}
                  </div>
                ) : (
                  <div className={`text-lg font-semibold ${
                    hasAppointment ? 'text-slate-600' : 
                    isEmpty ? 'text-orange-700' : 
                    'text-slate-900'
                  }`}>{time}</div>
                )}
                {/* Duration display */}
                {isEmpty && (
                  <div className="text-sm font-medium text-orange-600">
                    ({durationMinutes} min)
                  </div>
                )}
                {hasAppointment && slot.appointment?.duration && (
                  <div className={`text-xs ${
                    hasAppointment ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    ({slot.appointment.duration})
                  </div>
                )}
              </div>
              <div className={`text-xs flex items-center gap-1 ${
                hasAppointment ? 'text-slate-400' : 
                isEmpty ? 'text-orange-600' : 
                'text-slate-500'
              }`}>
                <Calendar className="h-3 w-3" />
                {date}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isEmpty ? (
              isMergedGroup ? (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 font-semibold">
                  Livre ({slot.mergedSlots?.length} slots)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 font-semibold">
                  Livre
                </Badge>
              )
            ) : hasAppointment ? (
              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                <User className="h-3 w-3 mr-1" />
                {slot.appointment?.patientName || 'Ocupado'}
              </Badge>
            ) : (
              <Badge variant="outline">Ocupado</Badge>
            )}
            {/* Expand/Collapse Button - only for occupied slots with appointments */}
            {hasAppointment && (
              <button
                onClick={(e) => onToggleExpand(slot.dateTime, e)}
                className="p-1 hover:bg-slate-200 rounded transition-colors"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-600" />
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Expandable Details - only for occupied slots with appointments */}
        {shouldShowDetails && slot.appointment && (
          <div className="px-3 pb-3 space-y-2">
            <div className="pt-3 border-t space-y-2 rounded p-3 bg-slate-50 border-slate-200">
              <div className="text-sm font-semibold text-slate-600 mb-2">
                Detalhes da Marcação
              </div>
              <div className="text-sm text-slate-600">
                <span className="font-medium">Paciente:</span> {slot.appointment.patientName || 'N/A'}
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <div>
                  <span className="font-medium">ID:</span> {slot.appointment.patientId}
                </div>
                {slot.appointment.serviceCode && (
                  <div>
                    <span className="font-medium">Serviço:</span> {slot.appointment.serviceCode}
                  </div>
                )}
                {slot.appointment.medicalActCode && (
                  <div>
                    <span className="font-medium">Ato:</span> {slot.appointment.medicalActCode}
                  </div>
                )}
                {slot.appointment.duration && (
                  <div>
                    <span className="font-medium">Duração:</span> {slot.appointment.duration}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Fragment>
  );
}

