#!/usr/bin/env python3
"""
Glintt Schedule Test - Creates a new appointment.

This script is for developer testing only. It creates a real appointment
in the Glintt TEST environment.

Usage:
    python glintt_schedule.py [--auto]
    
Options:
    --auto    Auto-select first available slot (non-interactive mode)

Environment variables required (see env.example.txt):
    GLINTT_BASE_URL, GLINTT_CLIENT_ID, GLINTT_CLIENT_SECRET, etc.
"""

import sys
import json
from datetime import datetime
from glintt_client import GlinttTestClient


def display_slots(slots):
    """Display available slots for user selection."""
    print("\n" + "=" * 70)
    print("AVAILABLE SLOTS")
    print("=" * 70)
    
    for i, slot in enumerate(slots, 1):
        slot_time = slot['SlotDateTime']
        doctor = slot.get('HumanResourceCode', 'N/A')
        booking_id = slot.get('BookingID', 'N/A')
        duration = slot.get('Duration', 'N/A')
        
        print(f"  {i:2d}. {slot_time} | Doctor: {doctor} | Duration: {duration}")
    
    print("=" * 70)


def select_slot_interactive(slots):
    """Interactive slot selection."""
    display_slots(slots)
    
    while True:
        try:
            choice = input(f"\nSelect slot (1-{len(slots)}) or 'q' to quit: ").strip()
            
            if choice.lower() == 'q':
                return None
            
            index = int(choice) - 1
            if 0 <= index < len(slots):
                return slots[index]
            else:
                print(f"Invalid choice. Enter 1-{len(slots)}")
                
        except ValueError:
            print("Invalid input. Enter a number or 'q'")
        except KeyboardInterrupt:
            print("\nCancelled")
            return None


def main():
    """Main schedule workflow."""
    auto_mode = '--auto' in sys.argv
    
    print("=" * 70)
    print("GLINTT SCHEDULE TEST")
    print("=" * 70)
    
    # Initialize client
    try:
        client = GlinttTestClient()
    except EnvironmentError as e:
        print(f"FAIL: {e}")
        return None
    
    print(f"Patient ID: {client.patient_id}")
    print(f"Service: {client.service_code}")
    print(f"Medical Act: {client.medical_act_code}")
    
    start_date, end_date = client.get_date_range()
    print(f"Date Range: {start_date} to {end_date}")
    print("=" * 70)
    
    # Step 1: Authenticate
    print("\n[Step 1] Authentication")
    if not client.authenticate():
        print("FAIL: Authentication failed")
        return None
    
    # Step 2: Search slots
    print("\n[Step 2] Search available slots")
    slots = client.search_slots(start_date, end_date, is_reschedule=False)
    
    if not slots:
        print("FAIL: No available slots found")
        return None
    
    # Step 3: Select slot
    print("\n[Step 3] Slot selection")
    if auto_mode:
        selected_slot = slots[0]
        print(f"  Auto-selected: {selected_slot['SlotDateTime']}")
    else:
        selected_slot = select_slot_interactive(slots)
        if not selected_slot:
            print("FAIL: No slot selected")
            return None
    
    # Step 4: Schedule appointment
    print("\n[Step 4] Schedule appointment")
    result = client.schedule_appointment(selected_slot, is_reschedule=False)
    
    if not result:
        print("FAIL: Schedule failed")
        return None
    
    # Extract appointment info
    appointment_id = result.get('appointmentID')
    
    print("\n" + "=" * 70)
    print("SCHEDULE RESULT")
    print("=" * 70)
    print(f"Appointment ID: {appointment_id}")
    print(f"Scheduled Time: {selected_slot['SlotDateTime']}")
    print(f"Doctor: {selected_slot['HumanResourceCode']}")
    print("=" * 70)
    
    # Save result for reschedule test
    output = {
        'appointmentId': appointment_id,
        'scheduledTime': selected_slot['SlotDateTime'],
        'doctorCode': selected_slot['HumanResourceCode'],
        'bookingId': selected_slot['BookingID'],
        'patientId': client.patient_id,
        'serviceCode': client.service_code,
        'result': result,
    }
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"schedule_result_{timestamp}.json"
    
    with open(filename, 'w') as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\nResult saved to: {filename}")
    
    return output


if __name__ == "__main__":
    result = main()
    sys.exit(0 if result else 1)








