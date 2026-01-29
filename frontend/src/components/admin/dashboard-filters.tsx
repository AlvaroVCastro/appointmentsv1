'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface FilterState {
  clinic: string | null;
  doctorCode: string | null;
}

export interface FilterOptions {
  clinics: string[];
  doctors: { code: string; name: string }[];
}

interface DashboardFiltersProps {
  filters: FilterState;
  options: FilterOptions;
  onFiltersChange: (filters: FilterState) => void;
  loading?: boolean;
}

export function DashboardFilters({
  filters,
  options,
  onFiltersChange,
  loading = false,
}: DashboardFiltersProps) {
  const hasFilters = filters.clinic || filters.doctorCode;

  const handleClinicChange = (value: string) => {
    onFiltersChange({
      ...filters,
      clinic: value === 'all' ? null : value,
    });
  };

  const handleDoctorChange = (value: string) => {
    onFiltersChange({
      ...filters,
      doctorCode: value === 'all' ? null : value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({ clinic: null, doctorCode: null });
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Filtro de Clínica */}
      <Select
        value={filters.clinic || 'all'}
        onValueChange={handleClinicChange}
        disabled={loading}
      >
        <SelectTrigger className="w-[180px] bg-white">
          <SelectValue placeholder="Todas as clínicas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as clínicas</SelectItem>
          {options.clinics.map((clinic) => (
            <SelectItem key={clinic} value={clinic}>
              {clinic}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filtro de Médico */}
      <Select
        value={filters.doctorCode || 'all'}
        onValueChange={handleDoctorChange}
        disabled={loading}
      >
        <SelectTrigger className="w-[220px] bg-white">
          <SelectValue placeholder="Todos os médicos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os médicos</SelectItem>
          {options.doctors.map((doctor) => (
            <SelectItem key={doctor.code} value={doctor.code}>
              {doctor.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Botão limpar filtros */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-slate-500 hover:text-slate-700"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
