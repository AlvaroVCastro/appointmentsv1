"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatDateKey } from "@/lib/appointment-utils";

interface DayStripProps {
  days: Date[];
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
  emptyDaysSet?: Set<string>; // Set of YYYY-MM-DD strings with at least one empty slot
}

export function DayStrip({
  days,
  selectedDate,
  onSelect,
  emptyDaysSet,
}: DayStripProps) {
  const selectedKey = selectedDate ? formatDateKey(selectedDate) : null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {days.map((day) => {
        const key = formatDateKey(day);
        const isSelected = key === selectedKey;
        const hasEmpty = emptyDaysSet?.has(key);

        const label = day.toLocaleDateString("pt-PT", {
          weekday: "short",
          day: "2-digit",
        });

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(day)}
            className={cn(
              "min-w-[72px] px-3 py-2 rounded-lg border text-sm flex flex-col items-center justify-center transition-colors",
              isSelected
                ? "border-orange-500 bg-orange-50 text-orange-800"
                : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <span className="font-medium">{label}</span>
            {hasEmpty && (
              <span className="mt-1 h-2 w-2 rounded-full bg-orange-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}

