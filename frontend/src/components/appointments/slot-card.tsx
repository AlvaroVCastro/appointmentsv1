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
  const isEmptyDueToStatus = slot.isEmptyDueToStatus && slot.appointment;
  const hasAppointment = slot.appointment && !isEmptyDueToStatus;
  // Scheduled appointments are collapsed by default
  const shouldShowDetails = isExpanded || isEmptyDueToStatus;
  
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
              : isEmptyDueToStatus
                ? 'border-amber-300 bg-amber-50 hover:border-amber-400 hover:bg-amber-100'
                : 'border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100'
            : hasAppointment
              ? 'border-slate-200 bg-slate-50'
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
                <div className={`text-lg font-semibold ${
                  hasAppointment ? 'text-slate-600' : 
                  isEmpty ? 'text-orange-700' : 
                  'text-slate-900'
                }`}>{time}</div>
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
              isEmptyDueToStatus ? (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-semibold">
                  {slot.appointment?.status === 'ANNULLED' ? 'Annulled' : 'Rescheduled'}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 font-semibold">
                  Empty
                </Badge>
              )
            ) : hasAppointment ? (
              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                <User className="h-3 w-3 mr-1" />
                {slot.appointment?.patientName || 'Appointment'}
              </Badge>
            ) : (
              <Badge variant="outline">Occupied</Badge>
            )}
            {/* Expand/Collapse Button */}
            {(hasAppointment || isEmptyDueToStatus || (slot.slot && slot.slot.OccupationReason?.Description)) && (
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
        
        {/* Expandable Details */}
        {shouldShowDetails && (
          <div className="px-3 pb-3 space-y-2">
            {slot.appointment && (
              <div className={`pt-3 border-t space-y-2 rounded p-3 ${
                isEmptyDueToStatus 
                  ? 'bg-amber-50 border-amber-200' 
                  : 'bg-slate-50 border-slate-200'
              }`}>
                {isEmptyDueToStatus ? (
                  <>
                    <div className="text-sm font-semibold text-amber-800 mb-2">
                      {slot.appointment.status === 'ANNULLED' ? 'Annulled Appointment' : 'Rescheduled Appointment'}
                    </div>
                    <div className="text-sm text-amber-700">
                      <span className="font-medium">Patient:</span> {slot.appointment.patientName || 'N/A'}
                    </div>
                    <div className="text-xs text-amber-600 flex flex-wrap gap-x-4 gap-y-1 mt-1">
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
                      <div className="text-xs text-amber-600 mt-2 italic">
                        {slot.appointment.observations}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-slate-600 mb-2">
                      Appointment Details
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">Patient:</span> {slot.appointment.patientName || 'N/A'}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 mt-1">
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
            {slot.slot && slot.slot.OccupationReason?.Description && (
              <div className="text-xs text-slate-500">
                {slot.slot.OccupationReason.Description}
              </div>
            )}
          </div>
        )}
      </div>
    </Fragment>
  );
}

