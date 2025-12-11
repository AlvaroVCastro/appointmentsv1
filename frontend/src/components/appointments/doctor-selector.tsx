"use client";

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DoctorSearchResult } from '@/lib/glintt-api';

interface DoctorSelectorProps {
  onDoctorSelected: (doctor: DoctorSearchResult) => void;
  onDoctorCodeSubmit: (code: string) => void; // for Enter on pure numeric input
  initialValue?: string;
}

export function DoctorSelector({
  onDoctorSelected,
  onDoctorCodeSubmit,
  initialValue = '',
}: DoctorSelectorProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [searchResults, setSearchResults] = useState<DoctorSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter results based on input (numeric vs text, case-insensitive)
  const filterResults = (results: DoctorSearchResult[], searchText: string): DoctorSearchResult[] => {
    if (!searchText || searchText.length < 3) {
      return [];
    }

    const isNumeric = /^\d+$/.test(searchText);
    const lowerSearch = searchText.toLowerCase();

    return results.filter(doctor => {
      if (isNumeric) {
        // Match doctors whose code starts with the number
        return doctor.code?.startsWith(searchText) || doctor.id.startsWith(searchText);
      } else {
        // Match doctors whose name starts with the text, case-insensitive
        return doctor.name.toLowerCase().startsWith(lowerSearch);
      }
    });
  };

  // Search for doctors when input changes
  useEffect(() => {
    const searchText = inputValue.trim();
    
    if (searchText.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    // Debounce the search
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch('/api/glintt/human-resources/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ searchString: searchText }),
        });

        if (response.ok) {
          const data = await response.json();
          const filtered = filterResults(data.doctors || [], searchText);
          setSearchResults(filtered);
          setShowDropdown(filtered.length > 0);
        } else {
          setSearchResults([]);
          setShowDropdown(false);
        }
      } catch (error) {
        console.error('Error searching doctors:', error);
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Use the input ref value directly to handle fast typing
      const currentValue = inputRef.current?.value || inputValue;
      const trimmedValue = currentValue.trim();
      
      // If input is only digits, treat as direct doctor code
      if (/^\d+$/.test(trimmedValue) && trimmedValue.length > 0) {
        onDoctorCodeSubmit(trimmedValue);
        setShowDropdown(false);
      }
      // For text input, do nothing (user must select from dropdown)
    }
  };

  const handleDoctorClick = (doctor: DoctorSearchResult) => {
    setInputValue(doctor.name);
    setShowDropdown(false);
    onDoctorSelected(doctor);
  };

  const handleLoadClick = () => {
    const currentValue = inputRef.current?.value || inputValue;
    const trimmedValue = currentValue.trim();
    
    if (/^\d+$/.test(trimmedValue) && trimmedValue.length > 0) {
      onDoctorCodeSubmit(trimmedValue);
      setShowDropdown(false);
    }
  };

  return (
    <div className="flex-1 relative">
      <Label htmlFor="doctorCode">Doctor Code or Name</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            id="doctorCode"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter doctor code (e.g. 112) or name (e.g. Ramiro)"
            className="pr-8"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleLoadClick}
          className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-700 transition-colors"
        >
          Load
        </button>
      </div>
      
      {showDropdown && searchResults.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {searchResults.map((doctor) => (
            <button
              key={doctor.id}
              type="button"
              onClick={() => handleDoctorClick(doctor)}
              className="w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors border-b border-slate-100 last:border-b-0"
            >
              <div className="font-medium text-slate-900">{doctor.name}</div>
              <div className="text-sm text-slate-500">Code: {doctor.code || doctor.id}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

